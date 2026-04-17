defmodule DohyunDaemon.SocketServer do
  @moduledoc """
  Unix domain socket listener for the dohyun daemon.

  Accepts line-delimited JSON envelopes `{"cmd": string, "args"?: object, "id"?: string}`
  and replies with `{"ok": true, "data": ...}` or `{"ok": false, "error": "..."}`.

  Each connection is handled by a spawned Task so concurrent clients do not block
  one another; all state mutations still funnel through the single StateServer
  mailbox.
  """
  use GenServer
  require Logger

  alias DohyunDaemon.StateServer

  @sock_relative ".dohyun/daemon.sock"

  # ── Public API ────────────────────────────────────────────────

  def start_link(opts) do
    GenServer.start_link(__MODULE__, Map.new(opts))
  end

  # ── Callbacks ────────────────────────────────────────────────

  @impl true
  def init(%{harness_root: root, state_server: state_server}) do
    sock_path = Path.join(root, @sock_relative)
    File.mkdir_p!(Path.dirname(sock_path))
    _ = File.rm(sock_path)

    {:ok, listen} =
      :gen_tcp.listen(0, [
        :binary,
        {:ifaddr, {:local, sock_path}},
        packet: :line,
        active: false,
        reuseaddr: true,
        backlog: 128
      ])

    acceptor = spawn_link(fn -> accept_loop(listen, state_server) end)

    state = %{
      listen: listen,
      sock_path: sock_path,
      state_server: state_server,
      acceptor: acceptor
    }

    {:ok, state}
  end

  @impl true
  def terminate(_reason, state) do
    _ = :gen_tcp.close(state.listen)
    _ = File.rm(state.sock_path)
    :ok
  end

  # ── Acceptor loop ────────────────────────────────────────────

  defp accept_loop(listen, state_server) do
    case :gen_tcp.accept(listen) do
      {:ok, client} ->
        {:ok, _pid} =
          Task.start(fn -> serve(client, state_server) end)

        accept_loop(listen, state_server)

      {:error, :closed} ->
        :ok
    end
  end

  # ── Connection handler ───────────────────────────────────────

  defp serve(client, state_server) do
    case :gen_tcp.recv(client, 0) do
      {:ok, line} ->
        reply = handle_line(line, state_server)
        :gen_tcp.send(client, Jason.encode!(reply) <> "\n")
        serve(client, state_server)

      {:error, _} ->
        :gen_tcp.close(client)
    end
  end

  defp handle_line(line, state_server) do
    trimmed = line |> to_string() |> String.trim_trailing("\n")

    case Jason.decode(trimmed) do
      {:ok, %{"cmd" => cmd} = envelope} -> dispatch(cmd, envelope, state_server)
      {:ok, _} -> %{ok: false, error: "parse"}
      {:error, _} -> %{ok: false, error: "parse"}
    end
  end

  defp dispatch("status", _envelope, state_server) do
    queue = StateServer.get_queue(state_server)
    %{ok: true, data: %{queue: queue}}
  end

  defp dispatch(_unknown, _envelope, _state_server) do
    %{ok: false, error: "unknown_cmd"}
  end
end

defmodule DohyunDaemon.Application do
  @moduledoc false
  use Application

  require Logger

  alias DohyunDaemon.{Lock, SocketServer, StateServer}

  @impl true
  def start(_type, _args) do
    if Application.get_env(:dohyun_daemon, :auto_start, true) do
      boot()
    else
      # Tests (or any embedding host) run children under their own supervisor.
      Supervisor.start_link([], strategy: :one_for_one, name: DohyunDaemon.Supervisor)
    end
  end

  defp boot do
    harness_root = System.get_env("DOHYUN_HARNESS_ROOT") || File.cwd!()

    case Lock.acquire(harness_root) do
      {:ok, _token} ->
        children = [
          {StateServer, [harness_root: harness_root]},
          {SocketServer, [harness_root: harness_root, state_server: StateServer]}
        ]

        opts = [strategy: :one_for_one, name: DohyunDaemon.Supervisor]
        Supervisor.start_link(children, opts)

      {:error, {:already_locked, pid}} ->
        Logger.error("dohyun_daemon already running at pid=#{pid} in #{harness_root}")
        {:error, :already_locked}
    end
  end
end

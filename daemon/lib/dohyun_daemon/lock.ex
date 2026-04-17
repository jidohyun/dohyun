defmodule DohyunDaemon.Lock do
  @moduledoc """
  PID file lock guaranteeing a single daemon instance per harness root.

  On acquire:
    * If no pid file exists — write ours and succeed.
    * If a pid file exists and points at a live process — refuse.
    * If it points at a dead process — overwrite (stale lock take-over).

  The POSIX `kill -0` check is the standard way to ask the kernel whether
  a PID is alive without sending a signal.
  """

  @pid_file ".dohyun/daemon.pid"

  @type token :: %{path: String.t(), pid: String.t()}

  @spec acquire(String.t(), keyword) :: {:ok, token} | {:error, term}
  def acquire(harness_root, opts \\ []) do
    path = Path.join(harness_root, @pid_file)
    own_pid = Keyword.get(opts, :own_pid, System.pid())

    case File.read(path) do
      {:error, :enoent} ->
        write(path, own_pid)

      {:ok, contents} ->
        existing = contents |> String.trim() |> parse_int()

        cond do
          existing == nil -> write(path, own_pid)
          alive?(existing) -> {:error, {:already_locked, existing}}
          true -> write(path, own_pid)
        end
    end
  end

  @spec release(token) :: :ok
  def release(%{path: path}) do
    _ = File.rm(path)
    :ok
  end

  # ── Internal ─────────────────────────────────────────────────

  defp write(path, own_pid) do
    File.mkdir_p!(Path.dirname(path))
    File.write!(path, own_pid)
    {:ok, %{path: path, pid: own_pid}}
  end

  defp parse_int(s) do
    case Integer.parse(s) do
      {n, _} -> n
      :error -> nil
    end
  end

  defp alive?(pid) when is_integer(pid) and pid > 0 do
    case System.cmd("kill", ["-0", Integer.to_string(pid)], stderr_to_stdout: true) do
      {_, 0} -> true
      _ -> false
    end
  end

  defp alive?(_), do: false
end

defmodule DohyunDaemon.LockTest do
  use ExUnit.Case, async: false

  alias DohyunDaemon.Lock

  setup do
    tmp = Path.join(System.tmp_dir!(), "dohyun_lock_test_#{System.unique_integer([:positive])}")
    File.mkdir_p!(Path.join(tmp, ".dohyun"))
    on_exit(fn -> File.rm_rf!(tmp) end)
    {:ok, harness_root: tmp, pid_path: Path.join(tmp, ".dohyun/daemon.pid")}
  end

  test "acquire creates .dohyun/daemon.pid with current OS pid", %{harness_root: root, pid_path: pid_path} do
    assert {:ok, _token} = Lock.acquire(root)
    assert File.exists?(pid_path)
    assert File.read!(pid_path) |> String.trim() |> String.to_integer() == System.pid() |> String.to_integer()
  end

  test "second acquire while first is live returns error", %{harness_root: root} do
    assert {:ok, _} = Lock.acquire(root)
    assert {:error, {:already_locked, _pid}} = Lock.acquire(root)
  end

  test "stale lock (process not alive) is taken over", %{harness_root: root, pid_path: pid_path} do
    # write an impossible PID (init runs as 1, but we use a PID that likely does not exist)
    stale_pid = 999_999
    File.write!(pid_path, Integer.to_string(stale_pid))

    assert {:ok, _} = Lock.acquire(root)
    # our PID has replaced the stale one
    assert File.read!(pid_path) |> String.trim() |> String.to_integer() ==
             String.to_integer(System.pid())
  end

  test "release removes the pid file", %{harness_root: root, pid_path: pid_path} do
    {:ok, token} = Lock.acquire(root)
    assert :ok = Lock.release(token)
    refute File.exists?(pid_path)
  end
end

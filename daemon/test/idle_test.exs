defmodule DohyunDaemon.IdleTest do
  use ExUnit.Case, async: false

  alias DohyunDaemon.StateServer

  setup do
    tmp = Path.join(System.tmp_dir!(), "dohyun_idle_test_#{System.unique_integer([:positive])}")
    File.mkdir_p!(Path.join(tmp, ".dohyun/runtime"))
    on_exit(fn -> File.rm_rf!(tmp) end)

    {:ok, harness_root: tmp}
  end

  test "last_activity bumps on every write call", %{harness_root: root} do
    {:ok, pid} = StateServer.start_link(harness_root: root, name: nil)

    t0 = StateServer.last_activity(pid)
    Process.sleep(10)
    task = %{
      "id" => "t-1", "title" => "x", "status" => "pending", "priority" => "normal",
      "type" => "feature", "dod" => [], "dodChecked" => [],
      "createdAt" => "2026-04-17T00:00:00Z", "updatedAt" => "2026-04-17T00:00:00Z"
    }
    {:ok, _} = StateServer.enqueue(pid, task)
    t1 = StateServer.last_activity(pid)
    assert t1 > t0

    GenServer.stop(pid)
  end

  test "last_activity bumps on reads too (status counts as activity)", %{harness_root: root} do
    {:ok, pid} = StateServer.start_link(harness_root: root, name: nil)

    t0 = StateServer.last_activity(pid)
    Process.sleep(10)
    _ = StateServer.get_queue(pid)
    t1 = StateServer.last_activity(pid)
    assert t1 > t0

    GenServer.stop(pid)
  end

  test "idle_elapsed_ms reports time since last activity", %{harness_root: root} do
    {:ok, pid} = StateServer.start_link(harness_root: root, name: nil)

    _ = StateServer.get_queue(pid)
    Process.sleep(30)
    elapsed = StateServer.idle_elapsed_ms(pid)
    assert elapsed >= 25

    GenServer.stop(pid)
  end
end

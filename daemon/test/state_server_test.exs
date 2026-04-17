defmodule DohyunDaemon.StateServerTest do
  use ExUnit.Case, async: false

  alias DohyunDaemon.StateServer

  setup do
    tmp = Path.join(System.tmp_dir!(), "dohyun_daemon_test_#{System.unique_integer([:positive])}")
    runtime_dir = Path.join(tmp, ".dohyun/runtime")
    File.mkdir_p!(runtime_dir)

    on_exit(fn -> File.rm_rf!(tmp) end)

    {:ok, harness_root: tmp, queue_path: Path.join(runtime_dir, "queue.json")}
  end

  defp write_queue(path, queue) do
    File.write!(path, Jason.encode!(queue))
  end

  defp sample_task(overrides) do
    Map.merge(
      %{
        "id" => "t-#{System.unique_integer([:positive])}",
        "title" => "sample",
        "description" => nil,
        "status" => "pending",
        "priority" => "normal",
        "type" => "feature",
        "dod" => ["one"],
        "dodChecked" => [],
        "createdAt" => "2026-04-17T00:00:00.000Z",
        "updatedAt" => "2026-04-17T00:00:00.000Z",
        "startedAt" => nil,
        "completedAt" => nil,
        "metadata" => %{}
      },
      overrides
    )
  end

  describe "init" do
    test "reads existing queue.json into memory", %{harness_root: root, queue_path: qpath} do
      existing = %{"version" => 1, "tasks" => [sample_task(%{"title" => "loaded"})]}
      write_queue(qpath, existing)

      {:ok, pid} = StateServer.start_link(harness_root: root, name: nil)

      assert %{"version" => 1, "tasks" => [%{"title" => "loaded"}]} = StateServer.get_queue(pid)

      GenServer.stop(pid)
    end

    test "creates a v1 empty queue when file absent", %{harness_root: root} do
      {:ok, pid} = StateServer.start_link(harness_root: root, name: nil)
      assert %{"version" => 1, "tasks" => []} = StateServer.get_queue(pid)
      GenServer.stop(pid)
    end
  end

  describe "enqueue" do
    test "appends task and persists queue.json atomically", %{harness_root: root, queue_path: qpath} do
      {:ok, pid} = StateServer.start_link(harness_root: root, name: nil)

      task = sample_task(%{"title" => "first"})
      assert {:ok, %{"title" => "first"}} = StateServer.enqueue(pid, task)

      # in-memory
      assert %{"tasks" => [%{"title" => "first"}]} = StateServer.get_queue(pid)

      # on-disk
      {:ok, body} = File.read(qpath)
      assert %{"version" => 1, "tasks" => [%{"title" => "first"}]} = Jason.decode!(body)

      # no leftover tmp file (atomic rename consumed it)
      tmp_files =
        qpath
        |> Path.dirname()
        |> File.ls!()
        |> Enum.filter(&String.starts_with?(&1, "queue.json."))

      assert tmp_files == []

      GenServer.stop(pid)
    end

    test "rejects tasks missing required fields", %{harness_root: root} do
      {:ok, pid} = StateServer.start_link(harness_root: root, name: nil)
      assert {:error, :invalid_task} = StateServer.enqueue(pid, %{"title" => "nope"})
      GenServer.stop(pid)
    end

    test "concurrent enqueues preserve all tasks with no loss", %{harness_root: root, queue_path: qpath} do
      {:ok, pid} = StateServer.start_link(harness_root: root, name: nil)

      n = 50
      parent = self()

      for i <- 1..n do
        spawn(fn ->
          task = sample_task(%{"id" => "t#{i}", "title" => "task-#{i}"})
          result = StateServer.enqueue(pid, task)
          send(parent, {:done, i, result})
        end)
      end

      for _ <- 1..n do
        receive do
          {:done, _i, {:ok, _}} -> :ok
        after
          2000 -> flunk("enqueue timeout")
        end
      end

      queue = StateServer.get_queue(pid)
      titles = Enum.map(queue["tasks"], & &1["title"])

      # no losses
      assert length(titles) == n
      # every task present
      assert Enum.sort(titles) == Enum.sort(for i <- 1..n, do: "task-#{i}")

      # on-disk matches in-memory (serialization point held)
      on_disk = qpath |> File.read!() |> Jason.decode!()
      assert length(on_disk["tasks"]) == n

      GenServer.stop(pid)
    end
  end

  describe "schema version" do
    test "preserves version field on enqueue (round-trip v1)", %{harness_root: root, queue_path: qpath} do
      write_queue(qpath, %{"version" => 1, "tasks" => []})
      {:ok, pid} = StateServer.start_link(harness_root: root, name: nil)

      {:ok, _} = StateServer.enqueue(pid, sample_task(%{}))
      on_disk = qpath |> File.read!() |> Jason.decode!()
      assert on_disk["version"] == 1

      GenServer.stop(pid)
    end

    test "refuses to start on unsupported future version", %{harness_root: root, queue_path: qpath} do
      write_queue(qpath, %{"version" => 999, "tasks" => []})
      Process.flag(:trap_exit, true)

      assert {:error, {:unsupported_schema_version, 999}} =
               StateServer.start_link(harness_root: root, name: nil)
    end
  end
end

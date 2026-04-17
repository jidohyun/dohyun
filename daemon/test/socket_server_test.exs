defmodule DohyunDaemon.SocketServerTest do
  use ExUnit.Case, async: false

  alias DohyunDaemon.{SocketServer, StateServer}

  setup do
    tmp = Path.join(System.tmp_dir!(), "dohyun_sock_test_#{System.unique_integer([:positive])}")
    File.mkdir_p!(Path.join(tmp, ".dohyun/runtime"))

    {:ok, state_pid} = StateServer.start_link(harness_root: tmp, name: nil)
    {:ok, sock_pid} = SocketServer.start_link(harness_root: tmp, state_server: state_pid)

    on_exit(fn ->
      if Process.alive?(sock_pid), do: GenServer.stop(sock_pid)
      if Process.alive?(state_pid), do: GenServer.stop(state_pid)
      File.rm_rf!(tmp)
    end)

    {:ok, harness_root: tmp, sock_path: Path.join(tmp, ".dohyun/daemon.sock")}
  end

  defp connect(sock_path) do
    {:ok, sock} = :gen_tcp.connect({:local, sock_path}, 0, [:binary, packet: :line, active: false])
    sock
  end

  defp send_line(sock, line) do
    :ok = :gen_tcp.send(sock, line <> "\n")
  end

  defp recv_line(sock, timeout \\ 1000) do
    {:ok, data} = :gen_tcp.recv(sock, 0, timeout)
    data |> to_string() |> String.trim_trailing("\n") |> Jason.decode!()
  end

  test "socket is bound at .dohyun/daemon.sock", %{sock_path: sock_path} do
    assert File.exists?(sock_path)
    # file is a socket, not a regular file
    {:ok, %File.Stat{type: :other}} = File.stat(sock_path)
  end

  test "status cmd returns ok envelope with data", %{sock_path: sock_path} do
    sock = connect(sock_path)
    send_line(sock, Jason.encode!(%{"cmd" => "status"}))

    response = recv_line(sock)
    assert response["ok"] == true
    assert is_map(response["data"])
    assert Map.has_key?(response["data"], "queue")

    :gen_tcp.close(sock)
  end

  test "unknown cmd returns ok:false with unknown_cmd error", %{sock_path: sock_path} do
    sock = connect(sock_path)
    send_line(sock, Jason.encode!(%{"cmd" => "does_not_exist"}))

    response = recv_line(sock)
    assert response == %{"ok" => false, "error" => "unknown_cmd"}

    :gen_tcp.close(sock)
  end

  test "malformed JSON returns parse error and keeps connection open", %{sock_path: sock_path} do
    sock = connect(sock_path)

    send_line(sock, "this is not json")
    first = recv_line(sock)
    assert first == %{"ok" => false, "error" => "parse"}

    # connection still usable — send a valid command next
    send_line(sock, Jason.encode!(%{"cmd" => "status"}))
    second = recv_line(sock)
    assert second["ok"] == true

    :gen_tcp.close(sock)
  end

  test "enqueue cmd creates task with daemon-generated id/timestamps", %{sock_path: sock_path, harness_root: root} do
    sock = connect(sock_path)

    args = %{
      "title" => "daemon-made",
      "description" => nil,
      "status" => "pending",
      "priority" => "normal",
      "type" => "feature",
      "dod" => ["step-1"],
      "metadata" => %{}
    }

    send_line(sock, Jason.encode!(%{"cmd" => "enqueue", "args" => args}))
    response = recv_line(sock)

    assert response["ok"] == true
    task = response["data"]["task"]
    assert task["title"] == "daemon-made"
    assert task["status"] == "pending"
    assert task["dod"] == ["step-1"]
    assert task["dodChecked"] == []
    assert is_binary(task["id"]) and byte_size(task["id"]) > 0
    assert is_binary(task["createdAt"])
    assert is_binary(task["updatedAt"])

    # persisted on disk
    queue_path = Path.join(root, ".dohyun/runtime/queue.json")
    assert File.exists?(queue_path)
    on_disk = queue_path |> File.read!() |> Jason.decode!()
    assert on_disk["version"] == 1
    assert [%{"title" => "daemon-made"}] = on_disk["tasks"]

    :gen_tcp.close(sock)
  end

  test "enqueue cmd rejects args missing title", %{sock_path: sock_path} do
    sock = connect(sock_path)

    send_line(sock, Jason.encode!(%{"cmd" => "enqueue", "args" => %{"dod" => []}}))
    response = recv_line(sock)

    assert response["ok"] == false
    assert response["error"] in ["invalid_args", "invalid_task"]

    :gen_tcp.close(sock)
  end

  test "dequeue cmd flips first pending task to in_progress", %{sock_path: sock_path} do
    sock = connect(sock_path)

    # seed one task
    enqueue_args = %{
      "title" => "to-dequeue",
      "status" => "pending",
      "priority" => "normal",
      "type" => "feature",
      "dod" => []
    }

    send_line(sock, Jason.encode!(%{"cmd" => "enqueue", "args" => enqueue_args}))
    _ = recv_line(sock)

    send_line(sock, Jason.encode!(%{"cmd" => "dequeue"}))
    response = recv_line(sock)

    assert response["ok"] == true
    task = response["data"]["task"]
    assert task["title"] == "to-dequeue"
    assert task["status"] == "in_progress"
    assert is_binary(task["startedAt"])

    :gen_tcp.close(sock)
  end

  test "dequeue cmd returns task=nil when nothing pending", %{sock_path: sock_path} do
    sock = connect(sock_path)
    send_line(sock, Jason.encode!(%{"cmd" => "dequeue"}))
    response = recv_line(sock)
    assert response["ok"] == true
    assert response["data"]["task"] == nil
    :gen_tcp.close(sock)
  end

  test "complete cmd marks task completed when id matches", %{sock_path: sock_path} do
    sock = connect(sock_path)

    send_line(sock, Jason.encode!(%{"cmd" => "enqueue", "args" => %{
      "title" => "seeded",
      "status" => "pending",
      "priority" => "normal",
      "type" => "feature",
      "dod" => []
    }}))
    enqueue_reply = recv_line(sock)
    task_id = enqueue_reply["data"]["task"]["id"]

    send_line(sock, Jason.encode!(%{"cmd" => "complete", "args" => %{"taskId" => task_id}}))
    response = recv_line(sock)

    assert response["ok"] == true
    assert response["data"]["task"]["status"] == "completed"
    assert is_binary(response["data"]["task"]["completedAt"])

    :gen_tcp.close(sock)
  end

  test "complete cmd returns task=nil for unknown id", %{sock_path: sock_path} do
    sock = connect(sock_path)
    send_line(sock, Jason.encode!(%{"cmd" => "complete", "args" => %{"taskId" => "ghost"}}))
    response = recv_line(sock)
    assert response["ok"] == true
    assert response["data"]["task"] == nil
    :gen_tcp.close(sock)
  end

  test "review_pending cmd flips task status to review-pending", %{sock_path: sock_path} do
    sock = connect(sock_path)

    send_line(sock, Jason.encode!(%{"cmd" => "enqueue", "args" => %{
      "title" => "rp-task", "status" => "pending", "priority" => "normal", "type" => "feature", "dod" => []
    }}))
    task_id = recv_line(sock)["data"]["task"]["id"]

    send_line(sock, Jason.encode!(%{"cmd" => "review_pending", "args" => %{"taskId" => task_id}}))
    response = recv_line(sock)
    assert response["ok"] == true
    assert response["data"]["task"]["status"] == "review-pending"

    :gen_tcp.close(sock)
  end

  test "check_dod cmd appends item to dodChecked", %{sock_path: sock_path} do
    sock = connect(sock_path)

    send_line(sock, Jason.encode!(%{"cmd" => "enqueue", "args" => %{
      "title" => "dod-task", "status" => "pending", "priority" => "normal", "type" => "feature", "dod" => ["a", "b"]
    }}))
    task_id = recv_line(sock)["data"]["task"]["id"]

    send_line(sock, Jason.encode!(%{"cmd" => "check_dod", "args" => %{"taskId" => task_id, "item" => "a"}}))
    response = recv_line(sock)
    assert response["ok"] == true
    assert response["data"]["task"]["dodChecked"] == ["a"]

    :gen_tcp.close(sock)
  end

  test "cancel_all cmd returns {count: N}", %{sock_path: sock_path} do
    sock = connect(sock_path)

    send_line(sock, Jason.encode!(%{"cmd" => "enqueue", "args" => %{
      "title" => "x", "status" => "pending", "priority" => "normal", "type" => "feature", "dod" => []
    }}))
    _ = recv_line(sock)

    send_line(sock, Jason.encode!(%{"cmd" => "cancel_all"}))
    response = recv_line(sock)
    assert response["ok"] == true
    assert response["data"]["count"] == 1

    :gen_tcp.close(sock)
  end

  test "prune_cancelled cmd returns {count: N}", %{sock_path: sock_path} do
    sock = connect(sock_path)

    send_line(sock, Jason.encode!(%{"cmd" => "enqueue", "args" => %{
      "title" => "y", "status" => "cancelled", "priority" => "normal", "type" => "feature", "dod" => []
    }}))
    _ = recv_line(sock)

    send_line(sock, Jason.encode!(%{"cmd" => "prune_cancelled"}))
    response = recv_line(sock)
    assert response["ok"] == true
    assert response["data"]["count"] == 1

    :gen_tcp.close(sock)
  end

  test "reorder cmd target=first moves task to head", %{sock_path: sock_path} do
    sock = connect(sock_path)

    ids =
      for title <- ["a", "b", "c"] do
        send_line(sock, Jason.encode!(%{"cmd" => "enqueue", "args" => %{
          "title" => title, "status" => "pending", "priority" => "normal", "type" => "feature", "dod" => []
        }}))
        recv_line(sock)["data"]["task"]["id"]
      end

    [_a_id, _b_id, c_id] = ids

    send_line(sock, Jason.encode!(%{"cmd" => "reorder", "args" => %{
      "taskId" => c_id, "target" => %{"mode" => "first"}
    }}))
    response = recv_line(sock)
    assert response["ok"] == true

    send_line(sock, Jason.encode!(%{"cmd" => "status"}))
    status = recv_line(sock)
    titles = status["data"]["queue"]["tasks"] |> Enum.map(& &1["title"])
    assert titles == ["c", "a", "b"]

    :gen_tcp.close(sock)
  end

  test "reorder cmd reports ok:false / task_not_pending for non-pending task", %{sock_path: sock_path} do
    sock = connect(sock_path)

    send_line(sock, Jason.encode!(%{"cmd" => "enqueue", "args" => %{
      "title" => "done", "status" => "completed", "priority" => "normal", "type" => "feature", "dod" => []
    }}))
    task_id = recv_line(sock)["data"]["task"]["id"]

    send_line(sock, Jason.encode!(%{"cmd" => "reorder", "args" => %{
      "taskId" => task_id, "target" => %{"mode" => "first"}
    }}))
    response = recv_line(sock)
    assert response["ok"] == false
    assert response["error"] == "task_not_pending"

    :gen_tcp.close(sock)
  end

  test "10 concurrent clients all get responses", %{sock_path: sock_path} do
    parent = self()
    n = 10

    for i <- 1..n do
      spawn(fn ->
        sock = connect(sock_path)
        send_line(sock, Jason.encode!(%{"cmd" => "status", "id" => "c#{i}"}))
        response = recv_line(sock, 2000)
        :gen_tcp.close(sock)
        send(parent, {:resp, i, response})
      end)
    end

    results =
      for _ <- 1..n do
        receive do
          {:resp, i, r} -> {i, r}
        after
          3000 -> flunk("concurrent client timed out")
        end
      end

    assert length(results) == n
    assert Enum.all?(results, fn {_, r} -> r["ok"] == true end)
  end
end

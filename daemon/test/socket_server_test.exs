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

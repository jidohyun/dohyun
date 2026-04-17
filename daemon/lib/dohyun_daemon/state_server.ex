defmodule DohyunDaemon.StateServer do
  @moduledoc """
  Serializes reads and writes to `.dohyun/runtime/queue.json`.

  Single GenServer per harness root. Concurrent callers go through
  one mailbox, eliminating the race where two CLI invocations stomp
  each other's writes.
  """
  use GenServer

  @queue_version 1

  # ── Public API ────────────────────────────────────────────────

  def start_link(opts) do
    harness_root = Keyword.fetch!(opts, :harness_root)
    name = Keyword.get(opts, :name, __MODULE__)
    gen_opts = if name, do: [name: name], else: []
    GenServer.start_link(__MODULE__, %{harness_root: harness_root}, gen_opts)
  end

  def get_queue(server \\ __MODULE__) do
    GenServer.call(server, :get_queue)
  end

  def enqueue(server \\ __MODULE__, task) do
    GenServer.call(server, {:enqueue, task})
  end

  def dequeue(server \\ __MODULE__) do
    GenServer.call(server, :dequeue)
  end

  def complete_task(server \\ __MODULE__, task_id) do
    GenServer.call(server, {:complete_task, task_id})
  end

  def transition_to_review_pending(server \\ __MODULE__, task_id) do
    GenServer.call(server, {:review_pending, task_id})
  end

  def check_dod(server \\ __MODULE__, task_id, item) do
    GenServer.call(server, {:check_dod, task_id, item})
  end

  # ── Callbacks ────────────────────────────────────────────────

  @impl true
  def init(%{harness_root: root}) do
    queue_path = queue_path(root)

    case load_queue(queue_path) do
      {:ok, queue} ->
        {:ok, %{queue_path: queue_path, queue: queue}}

      {:error, reason} ->
        {:stop, reason}
    end
  end

  @impl true
  def handle_call(:get_queue, _from, state) do
    {:reply, state.queue, state}
  end

  def handle_call({:enqueue, task}, _from, state) do
    case validate_task(task) do
      :ok ->
        new_queue = %{state.queue | "tasks" => state.queue["tasks"] ++ [task]}
        :ok = persist_atomic(state.queue_path, new_queue)
        {:reply, {:ok, task}, %{state | queue: new_queue}}

      {:error, reason} ->
        {:reply, {:error, reason}, state}
    end
  end

  def handle_call(:dequeue, _from, state) do
    tasks = state.queue["tasks"]

    case Enum.find_index(tasks, &(&1["status"] == "pending")) do
      nil ->
        {:reply, {:ok, nil}, state}

      idx ->
        now = DateTime.utc_now() |> DateTime.to_iso8601()
        pending = Enum.at(tasks, idx)
        updated = Map.merge(pending, %{"status" => "in_progress", "startedAt" => now, "updatedAt" => now})
        new_tasks = List.replace_at(tasks, idx, updated)
        new_queue = %{state.queue | "tasks" => new_tasks}
        :ok = persist_atomic(state.queue_path, new_queue)
        {:reply, {:ok, updated}, %{state | queue: new_queue}}
    end
  end

  def handle_call({:complete_task, task_id}, _from, state) do
    now = iso_now()
    update_by_id(state, task_id, &Map.merge(&1, %{"status" => "completed", "completedAt" => now, "updatedAt" => now}))
  end

  def handle_call({:review_pending, task_id}, _from, state) do
    now = iso_now()
    update_by_id(state, task_id, &Map.merge(&1, %{"status" => "review-pending", "updatedAt" => now}))
  end

  def handle_call({:check_dod, task_id, item}, _from, state) do
    now = iso_now()

    update_by_id(state, task_id, fn task ->
      checked = task["dodChecked"] || []

      if item in checked do
        task
      else
        Map.merge(task, %{"dodChecked" => checked ++ [item], "updatedAt" => now})
      end
    end)
  end

  # ── Internal ─────────────────────────────────────────────────

  defp queue_path(root), do: Path.join([root, ".dohyun", "runtime", "queue.json"])

  defp iso_now, do: DateTime.utc_now() |> DateTime.to_iso8601()

  # Look up a task by id, run fun.(task), persist, and reply {:ok, updated}.
  # Replies {:ok, nil} when the id is unknown.
  defp update_by_id(state, task_id, fun) do
    tasks = state.queue["tasks"]

    case Enum.find_index(tasks, &(&1["id"] == task_id)) do
      nil ->
        {:reply, {:ok, nil}, state}

      idx ->
        updated = fun.(Enum.at(tasks, idx))
        new_tasks = List.replace_at(tasks, idx, updated)
        new_queue = %{state.queue | "tasks" => new_tasks}
        :ok = persist_atomic(state.queue_path, new_queue)
        {:reply, {:ok, updated}, %{state | queue: new_queue}}
    end
  end

  defp load_queue(path) do
    case File.read(path) do
      {:ok, body} ->
        case Jason.decode(body) do
          {:ok, %{"version" => v, "tasks" => _} = q} when v == @queue_version ->
            {:ok, q}

          {:ok, %{"version" => v}} ->
            {:error, {:unsupported_schema_version, v}}

          _ ->
            {:ok, empty_queue()}
        end

      {:error, :enoent} ->
        {:ok, empty_queue()}
    end
  end

  defp empty_queue, do: %{"version" => @queue_version, "tasks" => []}

  @required_task_keys ~w(id title status priority type dod dodChecked createdAt updatedAt)

  defp validate_task(task) when is_map(task) do
    missing = Enum.reject(@required_task_keys, &Map.has_key?(task, &1))
    if missing == [], do: :ok, else: {:error, :invalid_task}
  end

  defp validate_task(_), do: {:error, :invalid_task}

  # tmp + rename = atomic on POSIX (same filesystem)
  defp persist_atomic(path, queue) do
    dir = Path.dirname(path)
    File.mkdir_p!(dir)
    tmp = path <> ".tmp-#{System.unique_integer([:positive])}"
    File.write!(tmp, Jason.encode_to_iodata!(queue))
    File.rename!(tmp, path)
    :ok
  end
end

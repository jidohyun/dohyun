defmodule DohyunDaemonTest do
  use ExUnit.Case
  doctest DohyunDaemon

  test "greets the world" do
    assert DohyunDaemon.hello() == :world
  end
end

defmodule DohyunDaemon.MixProject do
  use Mix.Project

  def project do
    [
      app: :dohyun_daemon,
      version: "0.1.0",
      elixir: "~> 1.16",
      start_permanent: Mix.env() == :prod,
      deps: deps(),
      releases: releases()
    ]
  end

  def application do
    [
      extra_applications: [:logger],
      mod: {DohyunDaemon.Application, []}
    ]
  end

  defp deps do
    [
      {:jason, "~> 1.4"}
    ]
  end

  # Relocatable self-contained release bundle. ERTS is included so the
  # resulting tree runs on any host of the same OS/arch without Erlang
  # being pre-installed. Unix-only — Windows needs named-pipe support
  # before we can ship a bundle.
  defp releases do
    [
      dohyun_daemon: [
        include_erts: true,
        include_executables_for: [:unix],
        applications: [runtime_tools: :permanent],
        strip_beams: true,
        steps: [:assemble]
      ]
    ]
  end
end

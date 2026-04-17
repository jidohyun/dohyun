import Config

if config_env() == :test do
  # Tests start their own StateServer/SocketServer under tmp dirs.
  # The auto-boot would otherwise take a real lock in the repo's .dohyun/.
  config :dohyun_daemon, auto_start: false
end

module.exports = {
  apps: [
    {
      name: "tradingview-bridge",
      script: "dist/server.cjs",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      exp_backoff_restart_delay: 1000,
      env: {
        NODE_ENV: "production",
        PORT: 3000
      },
      time: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      error_file: "logs/err.log",
      out_file: "logs/out.log",
      merge_logs: true
    }
  ]
};

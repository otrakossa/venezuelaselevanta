const fs = require("fs");
const path = require("path");

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return fs.readFileSync(filePath, "utf8")
    .split("\n")
    .reduce((acc, line) => {
      const m = line.match(/^\s*([^#][^=]*?)\s*=\s*["']?(.*?)["']?\s*$/);
      if (m) acc[m[1]] = m[2];
      return acc;
    }, {});
}

const env = loadEnv(path.join(__dirname, ".env"));

module.exports = {
  apps: [
    {
      name: "venezuela-levanta",
      script: ".output/server/index.mjs",
      cwd: "/var/www/venezuelaselevanta",
      // Cluster mode tolera caídas de un worker sin que el sitio entero
      // devuelva "servidor no encontrado". Nitro node-server soporta cluster.
      exec_mode: "cluster",
      instances: "max",
      max_memory_restart: "700M",
      kill_timeout: 8000,
      listen_timeout: 8000,
      wait_ready: false,
      max_restarts: 20,
      restart_delay: 2000,
      // Rotación de logs: instalar una sola vez en el VPS con
      //   pm2 install pm2-logrotate
      //   pm2 set pm2-logrotate:max_size 10M
      //   pm2 set pm2-logrotate:retain 14
      out_file: "/var/log/venezuela-levanta/out.log",
      error_file: "/var/log/venezuela-levanta/error.log",
      merge_logs: true,
      env: {
        NODE_ENV: "production",
        PORT: "3000",
        ...env,
      },
    },
  ],
};

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
      args: "PORT=3000",
      cwd: "/var/www/venezuelaselevanta",
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
        ...env,
      },
    },
  ],
};

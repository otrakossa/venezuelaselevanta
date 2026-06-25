#!/bin/bash
set -e

export PATH=$HOME/.bun/bin:$PATH
cd /var/www/venezuelaselevanta

echo "→ Pulling latest code..."
git fetch origin main
git reset --hard origin/main

# Asegurar preset node-server para VPS
python3 - << 'PYEOF'
import re
path = "vite.config.ts"
content = open(path).read()
if "node-server" not in content:
    content = content.replace(
        'server: { entry: "server" },\n  },\n});',
        'server: { entry: "server" },\n  },\n  nitro: {\n    preset: "node-server",\n  },\n});'
    )
    open(path, "w").write(content)
    print("vite.config.ts patched con node-server preset")
else:
    print("vite.config.ts ya tiene node-server preset")
PYEOF

echo "→ Installing dependencies..."
bun install --frozen-lockfile

echo "→ Building..."
bun run build

echo "→ Restarting app..."
pm2 start /var/www/venezuelaselevanta/ecosystem.config.cjs || \
  pm2 restart /var/www/venezuelaselevanta/ecosystem.config.cjs --update-env
pm2 save

echo "✓ Deploy completado: $(date)"


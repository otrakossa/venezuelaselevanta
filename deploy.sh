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

# Guard: el bundle del navegador hornea VITE_SUPABASE_URL en BUILD time. Si falta
# en .env, client.ts cae a http://127.0.0.1:54321 y el frontend de prod queda mudo
# en silencio. Verificar que el bundle apunte al proyecto correcto antes de reiniciar.
echo "→ Verificando que el bundle apunte al Supabase correcto..."
EXPECTED_URL=$(grep -E '^[[:space:]]*VITE_SUPABASE_URL[[:space:]]*=' .env | head -1 | sed -E 's/^[^=]*=//; s/^["'"'"']//; s/["'"'"'][[:space:]]*$//; s/[[:space:]]*$//')
if [ -z "$EXPECTED_URL" ]; then
  echo "✗ ABORTAR: falta VITE_SUPABASE_URL en .env — el frontend caería a http://127.0.0.1:54321."
  exit 1
fi
EXPECTED_HOST=$(echo "$EXPECTED_URL" | sed -E 's#^https?://([^/]+).*#\1#')
if grep -rq "127.0.0.1:54321" .output/public; then
  echo "✗ ABORTAR: el bundle tiene localhost horneado. Revisar VITE_SUPABASE_URL/PUBLISHABLE_KEY en .env."
  exit 1
fi
if ! grep -rq "$EXPECTED_HOST" .output/public; then
  echo "✗ ABORTAR: el bundle no referencia $EXPECTED_HOST. Revisar VITE_* en .env."
  exit 1
fi
echo "✓ Bundle apunta a $EXPECTED_HOST"

echo "→ Restarting app..."
pm2 start /var/www/venezuelaselevanta/ecosystem.config.cjs || \
  pm2 restart /var/www/venezuelaselevanta/ecosystem.config.cjs --update-env
pm2 save

echo "✓ Deploy completado: $(date)"


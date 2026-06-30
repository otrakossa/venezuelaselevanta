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

# ── Guard pre-build: wiring env-driven intacto (anti-regresión de Lovable) ──
# client.ts/supabase-rest.ts deben importar de @/lib/supabase-config, NO hardcodear.
if grep -nEq 'https?://[a-z0-9-]+\.supabase\.co' src/integrations/supabase/client.ts src/lib/supabase-rest.ts; then
  echo "✗ ABORTAR: client.ts/supabase-rest.ts tienen una URL Supabase hardcodeada."
  echo "  Deben importar de @/lib/supabase-config. ¿Lovable regeneró client.ts? Re-aplicar el import."
  exit 1
fi

echo "→ Building..."
bun run build

# ── Guard post-build: el bundle apunta al proyecto correcto, no a localhost ──
EXPECTED_URL=$(grep -E '^[[:space:]]*VITE_APP_SUPABASE_URL[[:space:]]*=' .env 2>/dev/null | head -1 | cut -d= -f2- | tr -d ' "'\''')
EXPECTED_HOST="advebubtfjgxwpjxprok.supabase.co"
[ -n "$EXPECTED_URL" ] && EXPECTED_HOST=$(echo "$EXPECTED_URL" | sed -E 's#^https?://([^/]+).*#\1#')
if grep -rq "127.0.0.1:54321" .output/public; then
  echo "✗ ABORTAR: el bundle tiene localhost horneado. Revisar VITE_APP_SUPABASE_* en .env."
  exit 1
fi
if ! grep -rq "$EXPECTED_HOST" .output/public; then
  echo "✗ ABORTAR: el bundle no referencia $EXPECTED_HOST. Revisar VITE_APP_SUPABASE_* en .env."
  exit 1
fi
echo "✓ Guard: el bundle del navegador apunta a $EXPECTED_HOST"

echo "→ Restarting app..."
pm2 start /var/www/venezuelaselevanta/ecosystem.config.cjs || \
  pm2 restart /var/www/venezuelaselevanta/ecosystem.config.cjs --update-env
pm2 save

echo "✓ Deploy completado: $(date)"


#!/bin/sh
# ---------------------------------------------------------------------------
# Arranque del contenedor de BARZUO.
#
# 1. Espera a que PostgreSQL acepte conexiones (en Coolify la base suele tardar
#    unos segundos mas que la app en estar lista).
# 2. Aplica las migraciones pendientes.
# 3. Siembra el contenido de demostracion la primera vez, si se pidio.
# ---------------------------------------------------------------------------
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: falta la variable DATABASE_URL." >&2
  exit 1
fi

if [ -z "$AUTH_SECRET" ]; then
  echo "ERROR: falta la variable AUTH_SECRET (minimo 32 caracteres)." >&2
  echo "       Genera una con: openssl rand -base64 48" >&2
  exit 1
fi

echo "→ Esperando a la base de datos…"
ATTEMPT=0
until node -e "
const { Client } = require('pg');
const c = new Client({ connectionString: process.env.DATABASE_URL });
c.connect().then(() => c.end()).then(() => process.exit(0)).catch(() => process.exit(1));
" 2>/dev/null; do
  ATTEMPT=$((ATTEMPT + 1))
  if [ "$ATTEMPT" -ge 30 ]; then
    echo "ERROR: la base de datos no respondio tras 30 intentos." >&2
    exit 1
  fi
  sleep 2
done
echo "  base de datos disponible."

echo "→ Aplicando migraciones…"
npx prisma migrate deploy

# SEED_ON_START=true siembra el contenido de demostracion en el primer
# arranque. Si la base ya tiene contenido, el seed no hace nada: sembrar de
# nuevo devolveria la portada, la galeria y la cartelera a la demo.
if [ "$SEED_ON_START" = "true" ]; then
  echo "→ Sembrando contenido inicial…"
  npx tsx prisma/seed.ts
fi

echo "→ Iniciando BARZUO en el puerto ${PORT:-3000}"
exec "$@"

# ============================================================================
# BARZUO — imagen de produccion
#
# Build en varias etapas sobre la salida `standalone` de Next.js: la imagen
# final lleva solo el servidor compilado y las dependencias nativas que hacen
# falta en tiempo de ejecucion (Prisma y sharp).
# ============================================================================

FROM node:22-alpine AS base
# libc6-compat: Prisma y sharp usan binarios nativos que esperan glibc.
RUN apk add --no-cache libc6-compat
WORKDIR /app


# --- Dependencias -----------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci


# --- Build ------------------------------------------------------------------
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# El cliente de Prisma se genera a partir del schema, no se versiona.
RUN npx prisma generate

# El build de Next necesita esta variable para las URLs absolutas (canonical,
# Open Graph, sitemap). Se pasa como --build-arg desde Coolify.
ARG NEXT_PUBLIC_SITE_URL="http://localhost:3000"
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL

ARG NEXT_PUBLIC_TIME_ZONE="America/Montevideo"
ENV NEXT_PUBLIC_TIME_ZONE=$NEXT_PUBLIC_TIME_ZONE

ARG NEXT_PUBLIC_CURRENCY="UYU"
ENV NEXT_PUBLIC_CURRENCY=$NEXT_PUBLIC_CURRENCY

ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build:next


# --- Herramientas de migracion ----------------------------------------------
# El arranque necesita la CLI de Prisma (migrate deploy) y tsx (seed). No se
# pueden entresacar del node_modules del proyecto: la CLI de Prisma arrastra un
# arbol de dependencias propio (effect, @electric-sql…) y copiar solo la carpeta
# `prisma` deja el contenedor sin poder migrar. Se instala aparte, con las
# versiones exactas que declara el package.json del proyecto.
FROM base AS migrator
WORKDIR /migrator

COPY package.json ./source-package.json
RUN node -e "\
const p = require('./source-package.json'); \
const pick = (n) => p.dependencies[n] ?? p.devDependencies[n]; \
require('fs').writeFileSync('package.json', JSON.stringify({ \
  name: 'barzuo-migrator', private: true, version: '1.0.0', \
  dependencies: { \
    prisma: pick('prisma'), \
    '@prisma/adapter-pg': pick('@prisma/adapter-pg'), \
    '@prisma/client': pick('@prisma/client'), \
    pg: pick('pg'), \
    dotenv: pick('dotenv'), \
    bcryptjs: pick('bcryptjs'), \
    tsx: pick('tsx') \
  } \
})); \
" && npm install --no-audit --no-fund --ignore-scripts


# --- Runtime ----------------------------------------------------------------
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# Las imagenes subidas viven en un volumen, fuera del codigo.
ENV UPLOAD_DIR=/app/storage/uploads

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Salida standalone: incluye server.js y solo los node_modules necesarios.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Herramientas de migracion, encima del arbol de standalone. Las versiones
# coinciden, asi que los paquetes compartidos se solapan sin conflicto.
COPY --from=migrator --chown=nextjs:nodejs /migrator/node_modules ./node_modules

# Schema, migraciones y seed.
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/src/generated ./src/generated

COPY --chown=nextjs:nodejs docker/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

# Volumen persistente para las imagenes que se suben desde el CMS.
RUN mkdir -p /app/storage/uploads && chown -R nextjs:nodejs /app/storage
VOLUME ["/app/storage"]

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["./entrypoint.sh"]
CMD ["node", "server.js"]

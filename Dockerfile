# ---- Build ----
  FROM node:20-alpine AS build
  WORKDIR /app
  
  # системные либы для swc/openssl и pnpm
  RUN apk add --no-cache openssl libc6-compat
  RUN corepack enable && corepack prepare pnpm@10.13.1 --activate
  
  # deps + генерация клиента
  COPY package.json pnpm-lock.yaml ./
  RUN pnpm install --frozen-lockfile
  COPY . .
  # Provide a safe default DATABASE_URL for Prisma generate at build time (no real connection is made)
  ARG DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres?schema=public
  ENV DATABASE_URL=$DATABASE_URL
  RUN pnpm prisma generate
  # Save Prisma artefacts to flat dirs (resolves pnpm symlinks).
  # We need three pieces:
  #   @prisma/client               — thin npm wrapper that re-exports .prisma/client
  #   .prisma/client                — schema-generated code (PrismaClient, types, engine)
  #   @prisma/client-runtime-utils  — runtime dependency used by generated client.js
  RUN mkdir -p /tmp/prisma-pkgs/@prisma \
   && cp -rL node_modules/@prisma/client /tmp/prisma-pkgs/@prisma/client \
   && cp -rL node_modules/.prisma        /tmp/prisma-pkgs/.prisma \
   && cp -rL $(find node_modules/.pnpm -path '*/node_modules/@prisma/client-runtime-utils' -type d | head -1) \
             /tmp/prisma-pkgs/@prisma/client-runtime-utils

  # чтобы импорты из ../../prisma продолжали работать
  RUN ln -sfn /app/prisma /app/src/prisma
  
  # сборка Nest
  RUN pnpm build
  
  # ---- Runtime ----
  FROM node:20-alpine AS runtime
  WORKDIR /app
  ENV NODE_ENV=production
  
  RUN apk add --no-cache openssl libc6-compat
  RUN corepack enable && corepack prepare pnpm@10.13.1 --activate
  
  # 1) манифесты пакетов
  COPY package.json pnpm-lock.yaml ./
  # Prisma 7 config for migrate/db push at runtime
  COPY --from=build /app/prisma.config.ts ./
  
  # 2) prisma схема (до установки, чтобы @prisma/client сделал postinstall generate)
  COPY --from=build /app/prisma ./prisma
  # Provide a safe default DATABASE_URL so postinstall/generate can read prisma.config.ts
  ARG DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres?schema=public
  ENV DATABASE_URL=$DATABASE_URL
  
  # 3) прод-зависимости
  RUN pnpm install --prod --frozen-lockfile

  # 4) overlay generated Prisma Client + runtime deps from build stage
  COPY --from=build /tmp/prisma-pkgs/@prisma/client               ./node_modules/@prisma/client
  COPY --from=build /tmp/prisma-pkgs/.prisma                      ./node_modules/.prisma
  COPY --from=build /tmp/prisma-pkgs/@prisma/client-runtime-utils ./node_modules/@prisma/client-runtime-utils

  # 5) собранный код
  COPY --from=build /app/dist ./dist
  
  EXPOSE 3000
  
  # --- старт ---
  # Migrations are applied separately (CI or manual).
  # Previously `pnpm dlx prisma migrate deploy && node ...` was used here,
  # but the `&&` caused ECS to roll back when the migration step failed
  # (e.g. missing ts-node for prisma.config.ts in the runtime image).
  CMD ["node", "dist/src/main.js"]
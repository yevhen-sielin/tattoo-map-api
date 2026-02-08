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

  # 4) копируем сгенерированный Prisma Client из build-стадии
  #    (вместо повторной генерации, которая требует CLI из devDependencies)
  COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma

  # 5) собранный код
  COPY --from=build /app/dist ./dist
  
  EXPOSE 3000
  
  # --- старт: применяем миграции и запускаем сервер ---
  # Пытаемся сначала локальным npx prisma (если добавишь "prisma" в dependencies),
  # иначе используем pnpm dlx (скачает CLI на лету).
  CMD ["sh", "-c", "\
    pnpm dlx prisma@7.0.1 migrate deploy && \
    node dist/src/main.js \
  "]
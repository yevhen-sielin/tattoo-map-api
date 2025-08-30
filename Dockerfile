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
  
  # 2) prisma схема (до установки, чтобы @prisma/client сделал postinstall generate)
  COPY --from=build /app/prisma ./prisma
  
  # 3) прод-зависимости (сюда подтянется @prisma/client)
  #    👉 если prisma у тебя в devDependencies, это ок — ниже используем pnpm dlx
  RUN pnpm install --prod --frozen-lockfile
  
  # 4) собранный код
  COPY --from=build /app/dist ./dist
  
  EXPOSE 3000
  
  # --- старт: применяем миграции и запускаем сервер ---
  # Пытаемся сначала локальным npx prisma (если добавишь "prisma" в dependencies),
  # иначе используем pnpm dlx (скачает CLI на лету).
  CMD ["sh", "-c", "\
    (npx prisma migrate deploy || pnpm dlx prisma migrate deploy) && \
    node dist/src/main.js \
  "]
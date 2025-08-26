# ---- Build ----
  FROM node:20-alpine AS build
  WORKDIR /app
  
  # native deps for swc/esbuild on Alpine
  RUN apk add --no-cache openssl libc6-compat
  RUN corepack enable && corepack prepare pnpm@10.13.1 --activate
  
  COPY package.json pnpm-lock.yaml ./
  RUN pnpm install --frozen-lockfile
  
  COPY . .
  RUN pnpm prisma generate
  
  # symlink so tsc can import ../../prisma/*
  RUN ln -sfn /app/prisma /app/src/prisma
  
  RUN pnpm build
  
  
  # ---- Runtime ----
  FROM node:20-alpine AS runtime
  WORKDIR /app
  ENV NODE_ENV=production
  
  RUN apk add --no-cache openssl libc6-compat
  RUN corepack enable && corepack prepare pnpm@10.13.1 --activate
  
  # 1) Copy package manifests
  COPY package.json pnpm-lock.yaml ./
  
  # 2) Copy prisma BEFORE install so @prisma/client postinstall can run generate
  COPY --from=build /app/prisma ./prisma
  
  # 3) Prod deps — this will run @prisma/client postinstall and generate into node_modules/.prisma
  RUN pnpm install --prod --frozen-lockfile
  
  # 4) App build output
  COPY --from=build /app/dist ./dist
  
  EXPOSE 3000
  CMD ["node","dist/src/main.js"]
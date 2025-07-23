# Stage 1: Build
FROM oven/bun:1 AS builder

WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .

# نصب OpenSSL و ساخت Prisma Client
RUN apt-get update -y && apt-get install -y openssl
RUN bunx prisma generate
RUN bun run build

# Stage 2: Run
FROM oven/bun:1 AS runner
WORKDIR /app

# نصب OpenSSL در کانتینر نهایی هم
RUN apt-get update -y && apt-get install -y openssl

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json bun.lock ./

ENV NODE_ENV=production
EXPOSE 3003
CMD ["bun", "run", "dist/index.ts"]

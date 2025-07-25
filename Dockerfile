FROM oven/bun:1 AS deps
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:1 AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/bun.lock ./bun.lock

COPY prisma ./prisma
COPY src ./src
COPY public ./public
COPY tsconfig.json ./

RUN apt-get update -y && apt-get install -y openssl
RUN bunx prisma generate
RUN bun run build

FROM oven/bun:1 AS runner
WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/public ./public
COPY package.json bun.lock ./

RUN bun install --production --frozen-lockfile

ENV NODE_ENV=production
EXPOSE 3003
CMD ["bun", "run", "dist/index.js"]
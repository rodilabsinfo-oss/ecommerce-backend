# API image for Railway (or any Docker host).
# Build: compiles TypeScript and the Prisma client. Start: applies new
# database migrations, then runs the API on $PORT.

FROM node:22-slim AS build
WORKDIR /app
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# prisma.config.ts reads DATABASE_URL; generating the client does not connect, so a placeholder is enough.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npx prisma generate && npm run build
RUN npm prune --omit=dev

FROM node:22-slim
WORKDIR /app
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
COPY --from=build /app/package.json /app/prisma.config.ts ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
# Local photo storage. On Railway, attach a volume at /app/uploads so photos survive redeploys.
RUN mkdir -p uploads
EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]

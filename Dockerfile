# Stage 1: Install all dependencies and generate the Prisma client.
# Full deps (including the Prisma CLI) are carried into the final image so the
# server can run `prisma migrate deploy` at deploy time (Railway pre-deploy cmd).
FROM oven/bun:1 AS build

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY prisma ./prisma
RUN bunx prisma generate

# Stage 2: Build the React frontend (Vite) into client/dist.
FROM oven/bun:1 AS client-build

WORKDIR /app/client

COPY client/package.json client/bun.lock ./
RUN bun install --frozen-lockfile

COPY client ./
RUN bun run build

# Stage 3: Final runtime image.
FROM oven/bun:1 AS release

WORKDIR /app

# Full node_modules from the build stage (includes the Prisma CLI for migrations)
COPY --from=build /app/node_modules ./node_modules
# Generated Prisma client
COPY --from=build /app/generated ./generated

# Application source and Prisma schema/migrations
COPY src ./src
COPY package.json ./
COPY prisma ./prisma

# Built frontend, served by the backend (see src/index.ts)
COPY --from=client-build /app/client/dist ./client/dist

EXPOSE 3000

CMD ["bun", "src/index.ts"]

# Stage 1: Install production dependencies only
FROM oven/bun:1 AS deps

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Stage 2: Generate Prisma client
FROM oven/bun:1 AS build

WORKDIR /app

# Copy all deps (including dev) so prisma CLI is available
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY prisma ./prisma
RUN bunx prisma generate

# Stage 3: Final minimal image
FROM oven/bun:1 AS release

WORKDIR /app

# Copy production dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy generated Prisma client from build stage
COPY --from=build /app/generated ./generated

# Copy application source
COPY src ./src
COPY package.json ./
COPY prisma ./prisma

EXPOSE 3000

CMD ["bun", "src/index.ts"]

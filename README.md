<div align="center">

# template-hono-prisma

> Production-ready REST API template — JWT auth, OpenAPI docs, structured logging, rate limiting.

[![Bun](https://img.shields.io/badge/Bun-%23000000.svg?style=flat&logo=bun&logoColor=white)](https://bun.sh)
[![Hono](https://img.shields.io/badge/Hono-E36002?style=flat&logo=hono&logoColor=white)](https://hono.dev)
[![Prisma](https://img.shields.io/badge/Prisma-3982CE?style=flat&logo=Prisma&logoColor=white)](https://prisma.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=flat&logo=postgresql&logoColor=white)](https://postgresql.org)

</div>

---

## Table of Contents

- [Stack](#stack)
- [Requirements](#requirements)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Commands](#commands)
- [API Reference](#api-reference)
- [Database](#database)
- [Architecture](#architecture)
- [Testing](#testing)
- [CI/CD](#cicd)
- [Security](#security)
- [Logging](#logging)

---

## Stack

| Layer      | Technology                                           |
| ---------- | ---------------------------------------------------- |
| Runtime    | [Bun](https://bun.sh)                                |
| Framework  | [Hono](https://hono.dev) + `@hono/zod-openapi`       |
| ORM        | [Prisma 7](https://prisma.io) + `@prisma/adapter-pg` |
| Validation | [Zod 4](https://zod.dev)                             |
| Database   | PostgreSQL 16 (Docker)                               |
| Language   | TypeScript (strict mode)                             |

---

## Requirements

- [Bun](https://bun.sh) >= 1.x
- [Docker](https://www.docker.com) (for PostgreSQL)

---

## Quick Start

**1. Clone and install**

```bash
git clone <repo-url>
cd template-hono-prisma
bun install
```

**2. Configure environment**

```bash
cp .env.example .env
```

Fill in your values — see [Environment Variables](#environment-variables) for details.

**3. Start the database and run migrations**

```bash
bun run db:up       # Start PostgreSQL container
bun run db:migrate  # Run Prisma migrations
bun run db:seed     # (Optional) Seed with sample users
```

**4. Start the server**

```bash
bun run dev         # With hot reload
bun run dev:all     # Start DB + server in one command
```

The API will be available at `http://localhost:3000`.

| URL                            | Description  |
| ------------------------------ | ------------ |
| `http://localhost:3000/ui`     | Swagger UI   |
| `http://localhost:3000/doc`    | OpenAPI JSON |
| `http://localhost:3000/health` | Health check |

---

## Environment Variables

| Variable            | Description                              |
| ------------------- | ---------------------------------------- |
| `DATABASE_URL`      | PostgreSQL connection string             |
| `JWT_SECRET`        | Signing key — minimum 32 characters      |
| `PORT`              | Server port (default: `3000`)            |
| `NODE_ENV`          | `development` \| `test` \| `production`  |
| `CORS_ORIGIN`       | `"*"` or comma-separated allowed origins |
| `DATABASE_DB`       | Database name (Docker Compose)           |
| `DATABASE_USER`     | Database user (Docker Compose)           |
| `DATABASE_PASSWORD` | Database password (Docker Compose)       |

```env
# .env.example
DATABASE_DB="mydb"
DATABASE_USER="postgres"
DATABASE_PASSWORD="your_password_here"
DATABASE_URL="postgresql://postgres:your_password_here@localhost:5432/mydb"

JWT_SECRET="replace_with_a_random_string_of_at_least_32_characters"

PORT="3000"
NODE_ENV="development"
CORS_ORIGIN="*"
```

> [!NOTE]
> All variables are validated at startup via Zod. The server refuses to start if any required variable is missing or malformed.

---

## Commands

```bash
# Development
bun run dev              # Start with hot reload
bun run dev:all          # Start DB container + dev server
bun run start            # Production start (no watch)

# Database
bun run db:up            # Start PostgreSQL container
bun run db:stop          # Stop container (data preserved)
bun run db:down          # Stop and remove container
bun run db:migrate       # Run pending migrations
bun run db:migrate:prod  # Deploy migrations (non-interactive)
bun run db:generate      # Regenerate Prisma client
bun run db:seed          # Seed database with sample data
bun run db:studio        # Open Prisma Studio GUI
bun run db:reset         # Full reset: drop volume → migrate → seed

# Testing
bun run test             # Run all tests
bun run test:watch       # Run tests in watch mode

# Code Quality
bun run lint             # ESLint check
bun run lint:fix         # ESLint auto-fix
bun run format           # Prettier format
bun run format:check     # Prettier check (CI)
```

---

## API Reference

### Endpoints

| Method | Path                | Auth              | Description               |
| ------ | ------------------- | ----------------- | ------------------------- |
| `GET`  | `/health`           | —                 | Server + DB health check  |
| `GET`  | `/ui`               | —                 | Swagger UI                |
| `GET`  | `/doc`              | —                 | OpenAPI JSON spec         |
| `POST` | `/api/auth/login`   | Public            | Login, returns token pair |
| `POST` | `/api/auth/refresh` | Public            | Rotate refresh token      |
| `POST` | `/api/auth/logout`  | Bearer (optional) | Revoke tokens             |
| `POST` | `/api/users`        | Public            | Register a new user       |
| `GET`  | `/api/users`        | Bearer JWT        | List users (paginated)    |

### Authentication Flow

```
1. Login
   POST /api/auth/login
   Body:     { "email": "...", "password": "..." }
   Response: { "token": "<access_token>", "refreshToken": "<refresh_token>" }

2. Authenticated request
   Authorization: Bearer <access_token>

3. Refresh (when access token expires)
   POST /api/auth/refresh
   Body:     { "refreshToken": "<refresh_token>" }
   Response: { "token": "<new_access>", "refreshToken": "<new_refresh>" }

4. Logout
   POST /api/auth/logout
   Body:    { "refreshToken": "<refresh_token>" }
   Headers: Authorization: Bearer <access_token>   ← optional, blacklists it immediately
```

**Token TTLs:** access token = **1 hour** · refresh token = **7 days** (rotated on every use)

### Response Format

Every endpoint returns the same JSON envelope:

```jsonc
// Success
{ "success": true, "data": { ... }, "message": "..." }

// Error
{ "success": false, "error": "..." }

// Validation error (400)
{ "success": false, "error": "Validation failed", "details": [ ... ] }
```

### Pagination

Paginated endpoints accept `?page=1&limit=10`.
Default: page `1`, limit `10`, max `100`. Non-numeric values fall back to defaults.

---

## Database

### Models

**User**

| Field       | Type       | Notes                                        |
| ----------- | ---------- | -------------------------------------------- |
| `id`        | `Int`      | Auto-increment PK                            |
| `email`     | `String`   | Unique                                       |
| `password`  | `String`   | argon2id via `Bun.password` — never returned |
| `name`      | `String?`  | Optional                                     |
| `createdAt` | `DateTime` | Auto-set                                     |
| `updatedAt` | `DateTime` | Auto-updated                                 |

**RefreshToken**

| Field        | Type        | Notes                      |
| ------------ | ----------- | -------------------------- |
| `id`         | `Int`       | Auto-increment PK          |
| `token`      | `String`    | Unique, 40 random bytes    |
| `userId`     | `Int`       | FK → User (cascade delete) |
| `expiresAt`  | `DateTime`  |                            |
| `createdAt`  | `DateTime`  | Auto-set                   |
| `lastUsedAt` | `DateTime?` | Updated on each rotation   |

### Seed Users

```bash
bun run db:seed
```

| Email                | Password    |
| -------------------- | ----------- |
| `admin@template.com` | `admin1234` |
| `alice@template.com` | `alice1234` |
| `bob@template.com`   | `bob12345`  |

The seed uses `upsert` and is safe to run multiple times.

---

## Architecture

### Request Pipeline

```
Request
  → secureHeaders           (X-Frame-Options, X-Content-Type-Options, …)
  → requestIdMiddleware      (X-Request-ID header)
  → structuredLogger         (JSON log per request)
  → cors
  → rateLimitMiddleware      (/api/* — 100 req / 60s per IP, in-memory)
  → bodyLimit                (/api/* — 1 MB max)
  → Route handler
  → Response
        ↓
  errorHandler (onError)
```

### Project Structure

```
src/
├── index.ts                    # Entry point, middleware + route wiring
├── config/
│   ├── env.ts                  # Zod-validated env vars
│   └── constants.ts            # Rate limit, body limit, token TTLs, pagination defaults
├── db/
│   └── client.ts               # Prisma singleton (pg adapter, pool max 10)
├── middlewares/
│   ├── auth.ts                 # JWT middleware + in-memory token blacklist
│   ├── error-handler.ts        # Global error → structured response
│   ├── rate-limit.ts           # IP-based rate limiter
│   ├── request-id.ts           # X-Request-ID
│   └── tests/
├── schemas/
│   ├── response.ts             # Shared response schemas
│   └── pagination.ts           # Pagination query + meta schemas
├── utils/
│   ├── response.ts             # successResponse() / errorResponse()
│   ├── pagination.ts           # getPaginationParams() / createPaginationMeta()
│   └── logger.ts               # Structured JSON logger
└── api/
    ├── auth/                   # Login, refresh, logout
    ├── health/                 # GET /health
    └── user/                   # Registration + paginated list

prisma/
├── schema.prisma
└── seed.ts
```

### Key Design Decisions

**Factory functions for routes** — `createAuthRoutes(userRepo)` and `createUserRoutes()` accept dependencies as arguments instead of importing singletons. Tests inject fakes without monkey-patching.

**Auth decoupled from User** — `auth-routes.ts` depends only on `IUserAuthRepository` (`findByEmail` + `verifyPassword`). `UserService` satisfies it via structural typing. Wiring happens in `index.ts`.

**Refresh token rotation** — every `/refresh` call revokes the old token and issues a new one. Replaying a revoked token returns `401`.

**In-memory token blacklist** — on logout, the access token is stored in memory until its natural expiry. Avoids a DB query on every authenticated request. Resets on server restart (use Redis for persistent, multi-instance revocation).

**Error mapping**

| Error                              | Status   | Response                       |
| ---------------------------------- | -------- | ------------------------------ |
| `ZodError`                         | `400`    | Field-level validation details |
| `HTTPException`                    | Matching | Error message                  |
| Prisma `P2002` (unique constraint) | `409`    | `"<field> already in use"`     |
| Prisma `P2025` (record not found)  | `404`    | Not found message              |
| Unknown                            | `500`    | Generic (hidden in production) |

---

## Testing

Tests hit a **real PostgreSQL database** — no mocks at the DB layer.

```bash
bun run db:up       # DB must be running
bun run db:migrate  # Schema must be current
bun run test
```

| File                                          | Type        | Coverage                                                                                    |
| --------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------- |
| `src/api/health/tests/health.test.ts`         | Integration | `GET /health` — 200 + 503 (DB down via DI)                                                  |
| `src/api/auth/tests/auth-routes.test.ts`      | Integration | Login, refresh rotation, logout, token reuse                                                |
| `src/api/auth/tests/auth-service.test.ts`     | Unit        | `generateRefreshToken`, `validateRefreshToken`, `revokeRefreshToken`, `revokeAllUserTokens` |
| `src/api/user/tests/user-routes.test.ts`      | Integration | Registration, duplicate detection, auth, pagination, body limit                             |
| `src/api/user/tests/user-service.test.ts`     | Unit        | `create`, `getAll`, `findByEmail`, `verifyPassword`                                         |
| `src/middlewares/tests/error-handler.test.ts` | Unit        | ZodError, HTTPException, P2002, P2025, generic 500                                          |
| `src/middlewares/tests/rate-limit.test.ts`    | Unit        | IP tracking, 429 after limit, independent buckets                                           |
| `src/middlewares/tests/request-id.test.ts`    | Unit        | Header presence, hex format, uniqueness                                                     |

---

## CI/CD

Two GitHub Actions workflows trigger on every push and PR to `main`:

**`linting.yaml`** — `bun install` → `prisma generate` → `format:check` → ESLint

**`tests.yaml`** — Spins up a PostgreSQL 16 service container with native health checks (`pg_isready`), runs `prisma db push`, then `bun test`.

---

## Security

> [!WARNING]
> Review these settings before deploying to production.

- **`JWT_SECRET`** — use a cryptographically random value of at least 32 characters. Never commit it to version control.
- **`CORS_ORIGIN`** — set to your actual domain. Never use `"*"` in production.
- **Rate limiting** — keyed on `X-Forwarded-For` (first IP). Configure your reverse proxy to strip client-provided values to prevent spoofing.
- **Token blacklist + rate limit store** — in-memory. For multi-instance or restartable deployments, replace with Redis.
- **Security headers** — `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`, `Permissions-Policy` applied globally via `hono/secure-headers`.
- **Passwords** — hashed with argon2id (`Bun.password.hash()`). Never included in any API response.

---

## Logging

Every request produces a structured JSON log line on stdout:

```json
{
  "requestId": "a3f1b2c4d5e6f7a8",
  "method": "POST",
  "path": "/api/auth/login",
  "statusCode": 200,
  "duration": 42,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

Server errors are logged with the full stack trace and `requestId` via `console.error`. Compatible with Datadog, CloudWatch, and Grafana Loki out of the box.

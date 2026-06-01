# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Git Workflow

### Branch and commit rules

- Always check which branch you are on before starting any task
- Each group of tasks must have its own branch created from an updated `main`
- Branch name format: `feature/group-name`
- Each individual task = 1 commit on that branch
- Commit format: `<type>: short description` — where `<type>` follows Conventional Commits (`feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `style`)

### Mandatory work order

1. Ensure local `main` is up to date (`git pull origin main`)
2. Create the group branch from `main`
3. After each completed task:
   - Run the tests and verify they all pass
   - Only commit if tests are OK
   - If any test fails, fix it before committing
   - Mark the task as `[x]` in `Tasks.md`
4. After completing all tasks in a group:
   - Run the tests again
   - Run linting and fix all errors/warnings
   - **STOP and generate the Change Report (see section below)**
   - Wait for explicit user approval
5. After approval: the **user** handles `git push` and opening the PR on GitHub
6. After the PR is merged: run `git checkout main && git pull origin main`, then delete the merged branch with `git branch -D feature/branch-name` (use `-D` because GitHub squash/rebase merges create new commit hashes, making `-d` think the branch is unmerged)
7. Only then create the next group's branch

### Never do

- Do not commit without first running and verifying tests
- Do not push — the user handles all `git push` commands
- Do not create multiple branches simultaneously before merging previous ones
- Do not commit directly to `main`
- Do not start a new task group without running `git pull origin main` first

---

## Tasks.md Workflow

### When to create Tasks.md

Create or update `Tasks.md` **before starting any implementation** when:

- The user describes a set of changes to make
- There is more than 1 thing to implement/fix
- The task involves functional code (features, bugfixes, refactors)

### How to create Tasks.md

When the user describes what they want, **before coding**:

1. Analyze the request and decompose it into atomic tasks
2. Order the groups by dependency before writing — follow this priority:
   - **Infrastructure first** (DB migrations, Docker, env config) — no dependencies, everything else builds on top
   - **Architecture second** (patterns, DI, factories, constants) — establishes the final shape of the code
   - **Security/behavior changes third** (hardening, validations, error handling) — applied on top of clean architecture
   - **Tests fourth** (unit + integration) — written against the final, stable code to avoid rewriting
   - **Observability last** (logging, tracing) — depends on architecture and error handler being finalized
   - Within each tier, order by: shared utilities before consumers, foundational changes before derived ones
3. Write `Tasks.md` with the format below — **always in English**
4. **Show Tasks.md to the user and wait for confirmation** before starting

### Tasks.md format

```markdown
# Tasks — [group/feature name]

## Branch: `feature/group-name`

## Tasks

- [ ] Task 1: clear and objective description
- [ ] Task 2: clear and objective description
- [ ] Task 3: clear and objective description

## Context

[Summary of the overall goal in 2-3 lines]

## Expected files to modify

- `src/...`
- `tests/...`
```

### How to keep Tasks.md updated

- Mark `[x]` after each completed task (after tests pass)
- If a new task arises during work, add it to the file before executing
- When **all** tasks in a group are done AND the PR is merged:
  - Delete that entire group block from `Tasks.md`
  - The file should contain only groups with pending tasks
- If `Tasks.md` becomes empty after cleanup, delete the file

---

## Change Report (pre-push)

Before any `git push`, mandatorily generate this report and **wait for approval**:

```
## Change Report — [branch name]

### Completed tasks
- [x] Task 1 — commit: `feat: description`
- [x] Task 2 — commit: `fix: description`

### Modified files
| File | Change type |
|------|-------------|
| src/foo.ts | Modified |
| src/bar.ts | Created |
| tests/foo.test.ts | Modified |

### Summary of changes
[2-4 lines describing what was done and why]

### Tests
- Total: X | Passing: X | Failing: 0

### Linting
- Status: no errors/warnings

### Next step
Awaiting your approval. Once approved, you can run:
`git push origin feature/group-name` and open the PR.

Type "approve" to proceed or indicate adjustments.
```

---

## When to apply this workflow

Full workflow (Tasks.md + Report + approval):

- Multiple tasks to implement
- Task involves functional code (features, bugfixes, refactors)

Simplified workflow (no ceremony):

- Trivial fix like typo, text adjustment, comment
- User asks for something quick and pointed
- An active branch already exists for that context

When in doubt, ask before creating a branch or Tasks.md.

---

## Project Overview

A REST API template built with **Hono** (web framework), **Prisma 7** ORM (with `@prisma/adapter-pg`), **Zod 4** validation, and **Bun** runtime. Features OpenAPI/Swagger documentation, JWT authentication with refresh tokens, and PostgreSQL database via Docker.

## Commands

```bash
# Development
bun run dev              # Start server with watch mode (bun --watch)
bun run dev:all          # Start database container + dev server
bun run start            # Start server without watch mode (production)

# Database
bun run db:up            # Start PostgreSQL container (docker compose up -d)
bun run db:stop          # Stop container (preserves data)
bun run db:down          # Stop and remove container
bun run db:migrate       # Run Prisma migrations (bunx prisma migrate dev)
bun run db:generate      # Generate Prisma client to generated/prisma/
bun run db:seed          # Seed database with initial data (bun prisma/seed.ts)
bun run db:studio        # Open Prisma Studio GUI
bun run db:reset         # Full reset: destroy volume, recreate, migrate, seed

# Testing
bun run test             # Run all tests (bun test)
bun run test:watch       # Run tests in watch mode

# Code Quality
bun run lint             # ESLint check
bun run lint:fix         # ESLint auto-fix
bun run format           # Prettier format (2 spaces, semicolons, double quotes)
bun run format:check     # Prettier check only, no writes (used in CI)

# Database (production)
bun run db:migrate:prod  # Apply pending migrations non-interactively (prisma migrate deploy)
```

## Architecture

### Request Flow

```
Request → secureHeaders → requestIdMiddleware → logger → cors → rateLimitMiddleware → bodyLimit → Routes → Response
                                                                                                        ↓
                                                                                                errorHandler (onError)
```

- Security headers: `secureHeaders()` from `hono/secure-headers` applied globally (covers `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`, `Permissions-Policy`)
- Rate limiting: 100 requests per 60-second window per IP, applied to `/api/*` only (in-memory store)
- Body limit: 1MB max, applied to `/api/*` only
- `X-Forwarded-For` first IP (`.split(",")[0]`) is used for rate-limit key — can be spoofed; configure your reverse proxy to strip client-provided values in production. In dev (no proxy), all requests fall into the `"unknown"` bucket
- Graceful shutdown: listens for `SIGINT`/`SIGTERM`, clears rate-limit and token-blacklist cleanup intervals, disconnects Prisma, then exits cleanly

### Special Endpoints

- `GET /health` — returns `{ status, timestamp, database }`, 503 if DB unreachable
- `GET /ui` — Swagger UI
- `GET /doc` — OpenAPI JSON spec

### Directory Structure

```
src/
├── index.ts                        # App entry, middleware registration, OpenAPI config
├── config/
│   ├── env.ts                      # Zod-validated environment variables
│   └── constants.ts                # Single source of truth for tuneable values (rate limit, body limit, pagination, token TTLs)
├── db/client.ts                    # Prisma client singleton (pg adapter + pool: max 10, idle 30s, connect timeout 5s)
├── middlewares/
│   ├── auth.ts                     # JWT middleware + getAuthPayload() + in-memory token blacklist
│   ├── error-handler.ts            # Global: ZodError, HTTPException, Prisma errors
│   ├── rate-limit.ts               # In-memory IP-based rate limiter; exports rateLimitCleanupInterval
│   ├── request-id.ts               # X-Request-ID response header (crypto.randomBytes)
│   └── tests/
│       ├── error-handler.test.ts   # Unit tests for errorHandler (ZodError, HTTPException, P2002, P2025, generic)
│       ├── rate-limit.test.ts      # Unit tests for rateLimitMiddleware
│       └── request-id.test.ts      # Unit tests for requestIdMiddleware
├── schemas/
│   ├── response.ts                 # successResponseSchema(schema, name), errorResponseSchema
│   └── pagination.ts               # paginationQuerySchema, paginationMetaSchema
├── utils/
│   ├── response.ts                 # successResponse(), errorResponse() helpers
│   ├── pagination.ts               # getPaginationParams(), createPaginationMeta()
│   └── logger.ts                   # structuredLogger middleware — JSON log per request (requestId, method, path, statusCode, duration)
└── api/
    ├── auth/
    │   ├── auth-schema.ts          # login, refreshToken, message schemas
    │   ├── auth-service.ts         # Refresh token: generate, validate, revoke
    │   ├── auth-routes.ts          # POST /login, POST /refresh, POST /logout
    │   └── tests/
    │       ├── auth-routes.test.ts # Integration tests (login, refresh, logout flows)
    │       └── auth-service.test.ts # Unit tests (generateRefreshToken, validateRefreshToken, revoke)
    ├── health/
    │   ├── health-routes.ts        # GET /health handler; accepts optional PrismaClient for DI
    │   └── tests/
    │       └── health.test.ts      # Integration tests for GET /health (200 + 503 via DI)
    └── user/
        ├── user-schema.ts          # UserSchema, createUserSchema, paginatedUsersResponseSchema
        ├── user-service.ts         # CRUD, password hashing (Bun.password)
        ├── user-routes.ts          # GET / (protected, paginated), POST / (public)
        └── tests/
            ├── user-routes.test.ts  # Integration tests (full app)
            └── user-service.test.ts # Unit tests (service layer)
```

### Database Models (Prisma)

- **User**: id (autoincrement), email (unique), password (hashed), name?, createdAt, updatedAt
- **RefreshToken**: id, token (unique, 40 random bytes), userId (FK → User, cascade delete), expiresAt, createdAt, lastUsedAt?

### Key Patterns

**Auth Routes Factory**: `auth-routes.ts` exports `createAuthRoutes(userRepo: IUserAuthRepository)` instead of a default route instance. The `IUserAuthRepository` interface (defined in `auth-routes.ts`) exposes only `findByEmail` and `verifyPassword` — the two methods auth actually needs. `UserService` satisfies this interface via TypeScript's structural typing. Wiring happens at the composition root (`index.ts`): `app.route("/api/auth", createAuthRoutes(new UserService()))`. This keeps `auth` decoupled from the `user` implementation and testable in isolation.

**Domain Module Structure**: Each domain (`auth`, `user`) follows the pattern:

- `{domain}-schema.ts` — Zod schemas with OpenAPI metadata
- `{domain}-service.ts` — Business logic class with Prisma DI
- `{domain}-routes.ts` — OpenAPI route definitions and handlers
- `tests/` — Co-located test files

**OpenAPI Routes**: Uses `@hono/zod-openapi` with `createRoute()`:

```typescript
const route = createRoute({
  method: "get",
  path: "/",
  security: [{ bearerAuth: [] }],
  responses: { 200: { content: { "application/json": { schema } } } },
});
app.openapi(route, handler);
```

**Standardized Responses**: All endpoints return consistent JSON via helpers in `src/utils/response.ts`:

```typescript
return successResponse(c, data, 201, "Created successfully");
// → { success: true, data: {...}, message: "Created successfully" }

return errorResponse(c, "Not found", 404);
// → { success: false, error: "Not found" }
```

**JWT Authentication**: Protect routes with `authMiddleware` from `src/middlewares/auth.ts`. JWT payload type: `{ id: number, email: string, exp: number }` via `AuthVariables`. Extract payload with `getAuthPayload(c)`.

**Auth Flow**:

- `POST /api/auth/login` → returns access token (1h) + refresh token (7d)
- `POST /api/auth/refresh` → validates refresh token, rotates it (old revoked, new issued), returns new token pair
- `POST /api/auth/logout` → revokes refresh token (idempotent — succeeds even if token not found) and blacklists the access token. Access token is added to an in-memory blacklist (checked by `authMiddleware`) so protected routes immediately return 401. Note: the blacklist is cleared on server restart — use Redis for persistent revocation across restarts/instances.
- Refresh tokens are stored in DB (can be individually revoked); cascade-deleted when user is deleted

**Password Hashing**: Uses `Bun.password.hash()` (argon2id) and `Bun.password.verify()` in `UserService`. Password is never returned from any API endpoint (enforced via Prisma `select`).

**Pagination**: Use `getPaginationParams(page, limit)` and `createPaginationMeta(page, limit, total)` from `src/utils/pagination.ts`. Default: page 1, limit 10, max 100. Non-numeric values fall back to defaults safely.

**Error Handling**: Global handler in `src/middlewares/error-handler.ts`:

- `ZodError` → 400 with field-level details
- `HTTPException` → corresponding status code
- Prisma `P2002` → 409 conflict with dynamic message: `` `${field} already in use` `` (field extracted from `err.meta.target`)
- Prisma `P2025` → 404 not found (update/delete on non-existent record)
- Unknown errors → 500 (message hidden in production, logged server-side)

## Environment Variables

Required in `.env` (see `.env.example`):

| Variable            | Description                                            |
| ------------------- | ------------------------------------------------------ |
| `DATABASE_URL`      | PostgreSQL connection string (validated as URL)        |
| `JWT_SECRET`        | Signing key, minimum 32 characters                     |
| `PORT`              | Server port (default: 3000)                            |
| `NODE_ENV`          | `development` \| `test` \| `production`                |
| `CORS_ORIGIN`       | Allowed CORS origin(s) — `"*"` or comma-separated URLs |
| `DATABASE_DB`       | Database name (used by Docker Compose)                 |
| `DATABASE_USER`     | Database user (used by Docker Compose)                 |
| `DATABASE_PASSWORD` | Database password (used by Docker Compose)             |

Validation happens at startup via Zod in `src/config/env.ts`. The app crashes immediately if env vars are invalid.

## Seed Data

Run `bun run db:seed` to populate the database with 3 default users:

| Email              | Password  |
| ------------------ | --------- |
| admin@template.com | admin1234 |
| alice@template.com | alice1234 |
| bob@template.com   | bob12345  |

The seed is idempotent (`upsert`) and can be run multiple times safely.

## Testing

- Framework: `bun:test`
- Tests run against a **real database** (requires `db:up` + `db:migrate` first)
- Test files are co-located: `src/api/{domain}/tests/*.test.ts`
- Each test file handles its own cleanup in `beforeEach`/`beforeAll`
- Integration tests make HTTP requests to the full Hono app instance
- Unit tests call service methods directly against the database
- Test language: English (test descriptions are in en-US)

Test files:

| File                                          | Type        | Coverage                                                                                    |
| --------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------- |
| `src/api/health/tests/health.test.ts`         | Integration | `GET /health` — 200 (DB up), 503 (DB down via DI), CORS, security headers                   |
| `src/api/auth/tests/auth-routes.test.ts`      | Integration | Login, refresh token rotation, logout, token reuse prevention, CORS, sec headers            |
| `src/api/auth/tests/auth-service.test.ts`     | Unit        | `generateRefreshToken`, `validateRefreshToken`, `revokeRefreshToken`, `revokeAllUserTokens` |
| `src/api/user/tests/user-routes.test.ts`      | Integration | User creation, duplicate detection, auth, pagination, body limit, CORS, sec headers         |
| `src/api/user/tests/user-service.test.ts`     | Unit        | `create`, `getAll`, `findByEmail`, `verifyPassword`                                         |
| `src/middlewares/tests/error-handler.test.ts` | Unit        | ZodError → 400, HTTPException, P2002 → 409, P2025 → 404, generic → 500                      |
| `src/middlewares/tests/rate-limit.test.ts`    | Unit        | IP tracking, 429 after limit exceeded, independent buckets per IP                           |
| `src/middlewares/tests/request-id.test.ts`    | Unit        | X-Request-ID presence, 16-char hex format, uniqueness per request                           |

## CI/CD

GitHub Actions workflows in `.github/workflows/`:

### `linting.yaml`

Triggers on push/PR to `main` and `master`. Steps: `bun install`, `prisma generate`, `bun run format:check`, ESLint.

### `tests.yaml`

Triggers on push/PR to `main` and `master`. Spins up a PostgreSQL service container with native health checks (`pg_isready`), then runs `prisma db push` and `bun run test`. Required env vars injected via GitHub Actions secrets/env: `DATABASE_URL`, `JWT_SECRET`, `PORT`, `NODE_ENV=test`, `CORS_ORIGIN`.

## API Documentation

- Swagger UI: `http://localhost:{PORT}/ui`
- OpenAPI JSON: `http://localhost:{PORT}/doc`

## Logging

The project uses a custom structured JSON logger middleware at `src/utils/logger.ts` (`structuredLogger`), replacing Hono's built-in plain-text logger. Every request emits a JSON line to stdout with the following fields:

- `requestId` — correlated with `X-Request-ID` (set by `requestIdMiddleware` before the logger runs)
- `method`, `path`, `statusCode`, `duration` (ms), `timestamp`

Unexpected server errors are logged via `console.error` inside the error handler (`error-handler.ts`), also as JSON, including `requestId` and the full stack trace.

These structured logs integrate with log aggregation platforms (Datadog, CloudWatch, Grafana Loki). For future improvements, consider adding `userId` from the JWT payload when available.

## Code Style & Conventions

- **Language**: TypeScript strict mode (`noUncheckedIndexedAccess`, `noImplicitOverride`)
- **Formatting**: Prettier — 2 spaces, semicolons, double quotes, 80 char width
- **Linting**: ESLint + TypeScript rules + Prettier plugin. Unused vars allowed with `_` prefix
- **Imports**: ES modules (`"type": "module"` in package.json)
- **Naming**: camelCase for variables/functions, PascalCase for types/classes, kebab-case for files
- **Services**: Class-based with Prisma client injected via constructor (default = singleton)
- **Schemas**: Zod schemas with `.openapi()` metadata for Swagger docs
- **Tests**: Written in English (en-US)

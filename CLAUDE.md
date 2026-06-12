# CLAUDE.md

Guidance for Claude Code when working in this repository.

---

## Git Workflow

### Rules

- Check the current branch before starting any task.
- Each task group gets its own branch off an updated `main`: `feature/group-name`.
- Each task = 1 commit. Commit format: `<type>: short description` (Conventional Commits: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `style`). One-line subject only — **no body, no Co-Authored-By line**.

### Mandatory order

1. Update local `main` (`git pull origin main`).
2. Create the group branch from `main`.
3. Per task: run tests → commit only if green (fix first if red) → mark `[x]` in `Tasks.md`.
4. When all group tasks are done: run tests, run lint and fix all errors/warnings, then **STOP and produce the Change Report** and wait for explicit approval.
5. After approval: the **user** handles `git push` and the PR.
6. After merge: `git checkout main && git pull origin main`, delete the branch with `git branch -D feature/branch-name` (`-D` because squash/rebase merges rewrite hashes).
7. Only then start the next group's branch.

### Never

- Commit without running/verifying tests. Push (the user does it). Commit to `main`.
- Create multiple group branches before merging the previous one.
- Start a new group without `git pull origin main` first.

---

## Tasks.md Workflow

Create/update `Tasks.md` **before implementing** when the request has more than one step or touches functional code (features, bugfixes, refactors).

1. Decompose the request into atomic tasks.
2. Order groups by dependency: **Infrastructure** (DB/Docker/env) → **Architecture** (patterns, DI, constants) → **Security/behavior** (hardening, validation, error handling) → **Tests** → **Observability** (logging, tracing). Within a tier: shared utilities before consumers.
3. Write `Tasks.md` in **English**, show it to the user, and wait for confirmation before coding.

```markdown
# Tasks — [group/feature name]

## Branch: `feature/group-name`

## Tasks

- [ ] Task 1: clear, objective description

## Context

[2–3 lines on the overall goal]

## Expected files to modify

- `src/...`
```

- Mark `[x]` after each task passes its tests. Add new tasks to the file before doing them.
- When a group is fully done **and merged**, delete its block. If the file ends up empty, delete it.

---

## Change Report (pre-push)

Before any push, produce this and **wait for approval**:

```
## Change Report — [branch]

### Completed tasks
- [x] Task 1 — commit: `feat: ...`

### Modified files
| File | Change type |
|------|-------------|

### Summary of changes
[2–4 lines: what and why]

### Tests
- Total: X | Passing: X | Failing: 0

### Linting
- Status: no errors/warnings

### Next step
Awaiting approval. Once approved: `git push origin feature/group-name` and open the PR.
```

**Skip the full ceremony** (Tasks.md + Report) only for trivial, pointed work (typo, comment, one-line fix) or when an active branch already covers the context. When in doubt, ask before creating a branch or Tasks.md.

---

## Project Overview

**Velon** — internal web management system for local small businesses (service orders, clients, receipts, billing reports). College final project, demonstrated at a real partner commerce. **Multi-tenant**: every user belongs to a `Company` via a `Membership` that carries a role; all business data is scoped by `companyId`.

- **Backend** (repo root, `src/`): Hono + `@hono/zod-openapi` + Prisma 7 (`@prisma/adapter-pg`) + Zod 4, on Bun. JWT auth with refresh tokens, OpenAPI/Swagger, PostgreSQL via Docker.
- **Frontend** (`/client`): React 19 + Vite + TypeScript + shadcn/ui + Tailwind v4. Vite proxies `/api` → `http://localhost:3000` in dev (no CORS config needed).
- **Monorepo**: backend and `client/` each have their own `package.json`; Bun manages both.

---

## Commands

```bash
# Backend
bun run dev / dev:all      # watch server / + db container
bun run start              # production server
bun run test / test:watch  # bun test
bun run lint / lint:fix
bun run format / format:check

# Database
bun run db:up / db:stop / db:down   # docker compose lifecycle
bun run db:migrate                  # prisma migrate dev
bun run db:migrate:prod             # prisma migrate deploy
bun run db:generate                 # prisma client → generated/prisma/
bun run db:seed                     # default company + 3 admin users
bun run db:studio
bun run db:reset                    # destroy volume → recreate → migrate → seed

# Frontend (from repo root, or `cd client && bun run <script>`)
bun run client:dev         # Vite dev server (http://localhost:5173)
bun run client:build       # production build → client/dist/
```

Tests run against a **real database** — `db:up` + `db:migrate` first.

---

## Architecture

### Request flow

```
secureHeaders → requestId → structuredLogger → cors → rateLimit(/api/*) → bodyLimit(/api/*) → routes → errorHandler (onError)
```

- `secureHeaders()` global. Rate limit: 100 req / 60s per IP, `/api/*` only, in-memory. Body limit: 1 MB on `/api/*`, raised to 2 MB for the logo upload path.
- Rate-limit key uses the first `X-Forwarded-For` IP (spoofable — strip client-provided values at the proxy in prod). In dev all requests share the `"unknown"` bucket.
- Uploaded files served at `/api/uploads/*` (static, public — logos are embedded in `<img>`/PDFs).
- Graceful shutdown on SIGINT/SIGTERM: clears cleanup intervals, disconnects Prisma, exits.

### Special endpoints

- `GET /health` — `{ status, timestamp, database }`, 503 if DB unreachable.
- `GET /ui` — Swagger UI. `GET /doc` — OpenAPI JSON.

### Auth & multi-tenancy (core)

JWT payload: `{ id, email, companyId: number | null, role: Role | null, exp }`. `companyId`/`role` are `null` between registration and onboarding (no company yet).

- **`authMiddleware`** (`src/middlewares/auth.ts`) verifies the JWT, checks the in-memory blacklist, sets `jwtPayload`.
- **`getAuthPayload(c)`** → raw payload. **`getCompanyContext(c)`** → `{ userId, companyId, role }`, throwing **403** when the user has no active company — so tenant-scoped handlers never run an unscoped query.
- **`requireMinRole(minRole)`** (`src/middlewares/permissions.ts`) → **403** when the caller's role ranks below `minRole`. `ROLE_HIERARCHY = { VIEWER: 0, OPERATOR: 1, ADMIN: 2 }`. Role is read **from the JWT, not the DB**: a role change or revocation only takes effect on the next token refresh (≤ access-token TTL, 1 h). Refresh re-reads the active membership, so a revoked user cannot refresh back into access.

**Auth flow**

- `POST /api/auth/register` → creates the user, returns a token pair with `companyId/role = null`.
- `POST /api/company/setup` → onboarding: creates a company and the caller's owner (ADMIN) membership. Caller then refreshes to get a company-scoped token.
- `POST /api/auth/login` → token pair scoped to the user's active membership (if any).
- `POST /api/auth/refresh` → validates + rotates the refresh token (old revoked, new issued), re-reads membership, returns a new pair.
- `POST /api/auth/logout` → revokes the refresh token (idempotent) and blacklists the access token (in-memory; cleared on restart — use Redis for persistence).
- `GET /api/auth/me` → `{ id, email, name, hasCompany }`.

**Role policy per route** (read = any role with a company):

- `clients`, `orders`: writes (POST/PUT/DELETE, PATCH status) require **OPERATOR+**.
- `receipts`: GET any; POST (generate) requires **OPERATOR+**.
- `company`: GET any; PATCH + logo upload require **ADMIN**; `/setup` has no role check (pre-company).
- `company/members/*` (all): **ADMIN**.

**Member invites**

- `POST /api/company/members/invite` (ADMIN) → creates a `PENDING` membership (`userId = null`), emails the accept link, and returns `inviteUrl` so the admin can copy/share it.
- `GET /api/invites/:token` (public) → invite info + `userExists`; 404 unknown/used, 410 expired.
- `POST /api/invites/:token/accept` (public) → existing user verifies password / new user registers (name required); activates the membership and clears the token (single-use); returns a token pair. Runs in a `$transaction` (re-validates inside; deletes a prior REVOKED membership to avoid the `@@unique([userId, companyId])` collision).
- Resend / change-role / revoke / remove are ADMIN-only and protect the **last admin** (cannot demote/revoke/remove the only ADMIN, nor act on self where it would lock the account out).
- **Email** goes through the `EmailTransport` interface (`src/utils/email.ts`). The default `ConsoleEmailTransport` logs the message; swap the exported singleton for a real provider in production.

### Domain module pattern

Each domain under `src/api/{domain}/` has `{domain}-schema.ts` (Zod + `.openapi()`), `{domain}-service.ts` (class with Prisma injected via constructor, default = singleton), `{domain}-routes.ts` (`createRoute()` + factory `create{Domain}Routes(service?)`), and co-located `tests/`. Domains: `auth`, `user`, `company` (+ `member-*`), `invites`, `client`, `order`, `receipt`, `report`, `health`. Routes are wired at the composition root (`src/index.ts`).

Shared: `config/` (`env.ts`, `constants.ts` — single source for tuneables), `db/client.ts` (Prisma singleton, pg adapter, pool max 10), `middlewares/`, `schemas/` (response + pagination), `utils/` (`response.ts`, `pagination.ts`, `logger.ts`, `email.ts`).

### Key patterns

- **Factories + DI**: route modules export `create{Domain}Routes(service = new Service())`; services take a Prisma client (default singleton). Auth uses a minimal `IUserAuthRepository` interface (structural typing) instead of importing `UserService`.
- **Standard responses** (`src/utils/response.ts`): `successResponse(c, data, status, message)` → `{ success: true, data, message }`; `errorResponse(c, error, status)` → `{ success: false, error }`.
- **Tenant scoping**: handlers read `companyId` from `getCompanyContext(c)` and scope every query by it. FKs (`clientId`, `assignedUserId`) are validated up front → **404** rather than letting a bad FK fall through to a generic conflict.
- **Accountability**: `changedById`/`createdById` always come from the JWT, never the request body.
- **Email normalization**: `UserService` lowercases/trims email on create, register, and lookup, so logins and invite checks are case-insensitive and can't yield duplicate accounts.
- **Password hashing**: `Bun.password` (argon2id). Password is never selected/returned by any endpoint.
- **Pagination**: `getPaginationParams(page, limit)` + `createPaginationMeta(...)` (`src/utils/pagination.ts`). Default page 1, limit 10, max 100; non-numeric falls back safely.

### Database models (Prisma)

- **Company**: id, name, document?, phone?, email?, address?, logoUrl?, footerNote?, timestamps.
- **Membership**: id, userId? (null for a pending invite), companyId, role (`Role`, default OPERATOR), status (`MembershipStatus`, default ACTIVE), invitedEmail?, inviteToken? (unique), inviteExpiresAt?, timestamps. `@@unique([userId, companyId])` (Postgres treats NULL userIds as distinct, so multiple pending invites don't collide).
- **Role**: ADMIN | OPERATOR | VIEWER. **MembershipStatus**: ACTIVE | PENDING | REVOKED.
- **User**: id, email (unique, stored lowercase), password (hashed), name?, timestamps.
- **RefreshToken**: token (unique, 40 random bytes), userId (cascade delete), expiresAt, lastUsedAt?.
- **Client**: id, name, document, phone?, address?, clientType (COUNTER | PARTNER), companyId. `@@unique([companyId, document])`.
- **ServiceOrder**: id, orderNumber (`OS-0001`, per company), description, value (Decimal 10,2), status (OrderStatus), clientId, companyId, assignedUserId?. `@@unique([companyId, orderNumber])`.
- **OrderStatus**: PENDING | IN_PROGRESS | AWAITING_CLIENT | COMPLETED | CANCELLED.
- **StatusHistory**: orderId (cascade), fromStatus?, toStatus, changedById, changedAt, note?. **Receipt**: receiptNumber (autoincrement unique), orderId (unique), issuedAt.

Business invariants worth knowing: orders record an initial `StatusHistory` on create and write history on every status change (atomic `$transaction`); receipt `generate` is idempotent (unique `orderId`); monthly billing filters on the actual `COMPLETED` `StatusHistory.changedAt` (not `updatedAt`) and sums in integer cents.

### Error handling (`src/middlewares/error-handler.ts`)

- `ZodError` → 400 with field details. `HTTPException` → its status.
- Prisma `P2002` → 409 (`` `${field} already in use` ``), `P2025` → 404, `P2003` → 409 (FK, e.g. deleting a parent with children — inserts/updates validate FKs up front → 404 instead).
- Unknown → 500 (message hidden in prod, logged with `requestId` + stack).

---

## Environment Variables

Validated at startup by Zod (`src/config/env.ts`); the app crashes on invalid config.

| Variable                                              | Notes                                                                       |
| ----------------------------------------------------- | --------------------------------------------------------------------------- |
| `DATABASE_URL`                                        | Postgres connection string (validated as URL)                               |
| `JWT_SECRET`                                          | min 32 chars                                                                |
| `PORT`                                                | default 3000                                                                |
| `NODE_ENV`                                            | `development` \| `test` \| `production`                                     |
| `CORS_ORIGIN`                                         | `"*"` or comma-separated URLs (cannot be `"*"` in production)               |
| `APP_URL`                                             | frontend base URL for invite accept links (default `http://localhost:5173`) |
| `DATABASE_DB` / `DATABASE_USER` / `DATABASE_PASSWORD` | used by Docker Compose                                                      |

---

## Seed Data

`bun run db:seed` (idempotent) creates a default company **"Minha Empresa"** and 3 users, each an **ACTIVE ADMIN** of it:

| Email              | Password  |
| ------------------ | --------- |
| admin@template.com | admin1234 |
| alice@template.com | alice1234 |
| bob@template.com   | bob12345  |

---

## Testing

- Framework `bun:test`; integration tests hit the full Hono app, unit tests call services directly. Tests run against a real DB. Test descriptions in **English**.
- **Isolation is mandatory** — `bun test` runs files in parallel workers against one shared DB, so:
  - **No global `deleteMany()`** in a test's `beforeEach` (it wipes data created by parallel files). Instead, each test creates its own data with **UUID-based unique values** (`crypto.randomUUID()`) and cleans up only its own rows in `afterEach` (`{ where: { id/email: { in: [...] } } }`).
  - Use **`src/test-utils/company.ts`**: `createTestAuthContext({ role })` (company + user + membership + signed token) and `signTestToken(...)` (token without DB rows — for permission checks, since `requireMinRole` reads the JWT).
  - Give each test **file a dedicated `X-Forwarded-For` IP** so rate-limit buckets don't collide (existing IPs are in the `127.0.0.x` range, e.g. `.12`–`.14`, `.20`, `.30`–`.33`).
- Count/list assertions must be **company-scoped** (assert against a freshly created company), never against global totals.

---

## CI/CD

`.github/workflows/` (push/PR to `main`/`master`):

- **linting.yaml**: `bun install` → `prisma generate` → `format:check` → ESLint.
- **tests.yaml**: spins up a Postgres service container, `prisma db push`, `bun run test`. Env via secrets: `DATABASE_URL`, `JWT_SECRET`, `PORT`, `NODE_ENV=test`, `CORS_ORIGIN`.

---

## Frontend Conventions

- **Routing** (`client/src/router/index.tsx`): `createBrowserRouter` + `RouterProvider` (never `<BrowserRouter>`). Public: `/login`, `/register`, `/invites/:token`. `OnboardingGuard` wraps `/onboarding` (auth but no company). `ProtectedRoute` wraps the app in `AppShell` and redirects to `/login` (no user) or `/onboarding` (no company).
- **API layer** (`client/src/api/`): all HTTP goes through `client.ts`, which injects `Authorization: Bearer <token>` and, on 401, clears storage and redirects to `/login`. One file per domain (`auth`, `clients`, `orders`, `receipts`, `reports`, `company`, `invites`). No page calls `fetch` directly.
- **Auth** (`contexts/`): `AuthContext` provides `user` (decoded JWT: `id`, `email`, `companyId`, `role`), `accessToken`, `login`, `logout`, `setSession`, `refreshSession`. Tokens in `localStorage`.
- **Role-gated UI**: hide write actions for read-only users with `const canWrite = user?.role !== "VIEWER"`. The backend enforces permissions regardless — this is UX only.
- **Components**: shadcn/ui in `components/ui/` (generated, **never edit**). Domain components in `components/{domain}/`, pages in `pages/{domain}/`. Naming: PascalCase components/pages, camelCase hooks/utils, kebab-case other files.
- **Toasts**: `sonner` (`import { toast }`; `<Toaster />` mounted once). **Print**: ReceiptPage uses `@media print` to isolate receipt content; button calls `window.print()`.
- **After any frontend change, run `bun run client:build`** — the build (tsc) is the source of truth, not the linter alone.

### Critical version notes (differ from common training data)

React 19.2 · Vite 8 · TypeScript 6 · Zod 4 · React Hook Form 7.78 · Tailwind CSS 4 · shadcn/ui (new-york).

- **Zod 4**: `result.safeParse()` returns `.data` / `.error` directly; `z.string().email()`, `z.coerce.number()`, `z.enum([...])` still work; `z.ZodError` removed (catch `ZodError` / `z.core.$ZodError`).
- **TypeScript strict flags** (`tsconfig.app.json`): `noUnusedLocals` + `noUnusedParameters` (prefix intentionally-unused with `_`), `erasableSyntaxOnly` (no `const enum`, no `namespace`, no decorators), `verbatimModuleSyntax` (use `import type` for type-only imports).
- **Tailwind v4**: no `tailwind.config.ts` — theme lives in `client/src/index.css` via CSS variables; use `var(--…)`, not `theme()`.
- **Forms**: always React Hook Form + `zodResolver` + shadcn `Form` components (never uncontrolled inputs or `useState` for fields).
- **shadcn installed**: Button, Input, Textarea, Card, Table, Badge, Dialog, Select, Label, Form, Sonner, Separator, Avatar, DropdownMenu, Skeleton (+ local `empty-state`). Don't re-add these or edit files in `components/ui/`.

---

## Code Style

- TypeScript strict (`noUncheckedIndexedAccess`, `noImplicitOverride`). ES modules.
- Prettier: 2 spaces, semicolons, double quotes, 80 cols. ESLint + TS + Prettier plugin; unused vars allowed only with `_` prefix.
- Naming: camelCase vars/functions, PascalCase types/classes, kebab-case files. Services class-based with Prisma injected. Schemas carry `.openapi()` metadata.

---

## API Docs

Swagger UI `http://localhost:{PORT}/ui` · OpenAPI JSON `/doc`.

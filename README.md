# Pulih API

Backend API for Pulih, a recovery support platform with psychologist consultation booking. It handles auth, recovery tracking, journals, community/content, AI coach safety flows, psychologist onboarding, availability, bookings, Pakasir payments, Resend emails, and REST contracts for the Next.js PWA.

## Table of Contents

- [Overview](#overview)
- [Platform Context](#platform-context)
- [Service Boundary](#service-boundary)
- [Modules](#modules)
- [API Surface](#api-surface)
- [Docs](#docs)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Environment](#environment)
- [Database](#database)
- [Scripts](#scripts)
- [Testing](#testing)
- [Project Structure](#project-structure)
- [Demo Flow](#demo-flow)
- [Deployment](#deployment)
- [Security](#security)
- [Contribution](#contribution)

## Overview

Pulih API exposes product-focused REST endpoints, validates input, enforces auth/ownership, formats consistent response envelopes, persists data through Drizzle/Postgres, and wraps external providers behind service boundaries.

Core capabilities:

- Email/password auth with custom JWT access tokens.
- Patient profile and onboarding.
- Daily check-ins, relapse records, streaks, and statistics.
- Private journals.
- Community posts, comments, replies, and likes.
- Education, daily content, and achievements.
- AI coach features with non-diagnostic mental-health safety boundaries.
- Psychologist registration, profile, credential files, and review submission.
- Session bundles, availability windows, generated sessions, and booking flows.
- Pakasir payment URL, webhook validation, provider verification, idempotent completion.
- Resend notification delivery.
- OpenAPI + Scalar runtime docs.

## Platform Context

| Component                             | Responsibility                                                         |
| ------------------------------------- | ---------------------------------------------------------------------- |
| Next.js PWA                           | Patient/psychologist UI                                                |
| Pulih API                             | Auth, workflows, validation, persistence, integrations, REST contracts |
| Supabase Postgres                     | Durable relational data store                                          |
| Pakasir                               | Sandbox/payment simulation and payment status                          |
| Resend                                | Transactional emails                                                   |
| SumoPod-compatible AI                 | AI coach responses                                                     |
| Cloudflare R2 / S3-compatible storage | Private credential files                                               |
| VPS Docker runtime                    | Production API container                                               |

Frontend should call Pulih API only. It should not call DB, payment, email, AI, or storage providers directly.

## Service Boundary

Pulih API owns:

- Auth and role/ownership checks.
- Request validation and response envelopes.
- English API messages and stable error codes.
- Recovery, content, psychologist, booking, payment, notification, and AI workflows.
- Drizzle schema, migrations, seed data, and generated API docs.

Pulih API does not own:

- Frontend rendering/state.
- Admin UI/API for MVP.
- Google OAuth, refresh tokens, AI streaming, automatic refunds, payouts, complex moderation.
- Medical diagnosis or emergency services.

## Modules

| Module        | Responsibility                                                                 |
| ------------- | ------------------------------------------------------------------------------ |
| Auth          | Register, login, logout, current user, Bearer auth, password hashing           |
| Users         | Profile, onboarding, settings                                                  |
| Routine       | Check-ins, relapses, activity summary, statistics                              |
| Journals      | Private patient-owned entries                                                  |
| Community     | Posts, comments, replies, likes                                                |
| Content       | Education, daily motivation/challenge                                          |
| Achievements  | Catalog, progress, unlocked achievements                                       |
| AI            | Coach, relapse support, prevention plan, history, summary, persona preferences |
| Psychologists | Registration, profile, credential upload/review, public directory/detail       |
| Availability  | Bundles, availability windows, generated sessions                              |
| Bookings      | Create/list/detail, confirmation, reschedule, statuses                         |
| Payments      | Pakasir URL, webhook, provider verification, idempotency                       |
| Notifications | Resend-backed emails                                                           |
| Health/docs   | Liveness/readiness, OpenAPI, Scalar                                            |

## API Surface

Default local base URL:

```text
http://localhost:3002
```

Default API prefix:

```text
/api/v1
```

| Route group   | Prefix                                        | Auth                   |
| ------------- | --------------------------------------------- | ---------------------- |
| Health        | `/health/live`, `/health/ready`               | Public/infrastructure  |
| Docs          | `/docs/api`, `/openapi.yaml`, `/openapi.json` | Public                 |
| Auth          | `/api/v1/auth`                                | Public + Bearer routes |
| Users         | `/api/v1/users`                               | Bearer                 |
| Psychologists | `/api/v1/psychologists`                       | Mixed public + Bearer  |
| Bookings      | `/api/v1/bookings`                            | Bearer                 |
| Payments      | `/api/v1/payments/pakasir/webhook`            | Public webhook         |
| Routine       | `/api/v1/routine`                             | Bearer                 |
| Journals      | `/api/v1/journals`                            | Bearer                 |
| Community     | `/api/v1/community`                           | Bearer                 |
| Content       | `/api/v1/education`, `/api/v1/content/daily`  | Bearer                 |
| Achievements  | `/api/v1/achievements`                        | Bearer                 |
| AI            | `/api/v1/ai`                                  | Bearer                 |

Success envelope:

```json
{
  "success": true,
  "message": "Request processed successfully",
  "data": {},
  "meta": null
}
```

Error envelope:

```json
{
  "success": false,
  "message": "Request failed",
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "details": [],
    "request_id": "req_123"
  }
}
```

API messages and human-readable error details must be English.

## Docs

Tracked docs:

1. `docs/overview.md` — docs entry points.
2. `docs/api-routes.md` — route inventory and auth classification.
3. `docs/demo-runbook.md` — demo rehearsal path.
4. `docs/vps-deploy.md` — VPS deployment guide.
5. `docs/vps-cutover-runbook.md` — cutover/rollback runbook.
6. `docs/security-audit.md` — security checklist.
7. `docs/contract-parity-audit.md` — contract parity decisions.
8. `docs/generated/openapi.yaml`, `docs/generated/openapi.json`, `docs/generated/routes.md` — generated API artifacts.

Runtime docs:

| Surface       | Path            |
| ------------- | --------------- |
| Scalar viewer | `/docs/api`     |
| OpenAPI YAML  | `/openapi.yaml` |
| OpenAPI JSON  | `/openapi.json` |

## Tech Stack

| Area             | Choice                        |
| ---------------- | ----------------------------- |
| Runtime          | Bun                           |
| Language         | TypeScript                    |
| HTTP framework   | Hono                          |
| Database         | Supabase Postgres             |
| ORM              | Drizzle ORM                   |
| DB client        | `pg`                          |
| Auth             | Custom JWT access tokens      |
| Password hashing | `bcryptjs`                    |
| Payment          | Pakasir                       |
| Email            | Resend                        |
| AI               | OpenAI-compatible provider    |
| File storage     | Cloudflare R2 / S3-compatible |
| API docs         | OpenAPI + Scalar              |
| Testing          | `bun test`                    |
| Deployment       | Docker on VPS                 |

## Getting Started

Install deps:

```bash
bun install
```

Create local env:

```bash
cp .env.example .env
```

Run migrations and seed demo data:

```bash
bun run db:migrate
bun run seed:demo
```

Start dev server:

```bash
bun run dev
```

Health checks:

```bash
curl http://localhost:3002/health/live
curl http://localhost:3002/health/ready
```

Open docs:

```text
http://localhost:3002/docs/api
```

## Environment

Important files:

| File           | Purpose                           |
| -------------- | --------------------------------- |
| `.env.example` | Safe template                     |
| `.env`         | Local values, gitignored          |
| `.env.vps`     | VPS values, must not be committed |

Variable groups:

| Group    | Variables                                                                                                                                                     |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App      | `APP_NAME`, `APP_ENV`, `NODE_ENV`, `HOST`, `PORT`, `API_PREFIX`, `APP_URL`, `PWA_URL`                                                                         |
| DB       | `DATABASE_URL`, `DIRECT_DATABASE_URL`, `DATABASE_POOL_MAX`, `DATABASE_POOL_IDLE_TIMEOUT_MS`                                                                   |
| Auth     | `JWT_ACCESS_SECRET`, `JWT_ACCESS_TTL_SECONDS`, `PASSWORD_HASH_COST`                                                                                           |
| Security | `CORS_ALLOWED_ORIGINS`, `REQUEST_ID_HEADER`                                                                                                                   |
| Pakasir  | `PAKASIR_PROJECT_SLUG`, `PAKASIR_API_KEY`, `PAKASIR_BASE_URL`, `PAKASIR_PAYMENT_BASE_URL`, `PAKASIR_PROVIDER_TIMEOUT_MS`, `PAKASIR_WEBHOOK_TOLERANCE_SECONDS` |
| Resend   | `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_FROM_NAME`                                                                                                     |
| AI       | `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`, `AI_TIMEOUT_MS`, `AI_MAX_TOKENS`                                                                                     |
| Storage  | `CREDENTIAL_STORAGE_ENDPOINT`, `CREDENTIAL_STORAGE_REGION`, `CREDENTIAL_STORAGE_BUCKET`, `CREDENTIAL_STORAGE_ACCESS_KEY`, `CREDENTIAL_STORAGE_SECRET_KEY`     |

Never commit real secrets, tokens, DB passwords, private URLs with credentials, or storage keys.

## Database

Postgres is source of truth. Drizzle migrations live in `drizzle/`.

```bash
bun run db:generate
bun run db:migrate
bun run seed:demo
```

Rules:

- `DATABASE_URL` = runtime API DB access.
- `DIRECT_DATABASE_URL` = migration flow when needed.
- Review migration SQL before production deploy.
- No destructive DB changes automatically.
- Never test against production data.

## Scripts

| Script                  | Purpose                        |
| ----------------------- | ------------------------------ |
| `bun run dev`           | Start API in watch mode        |
| `bun run typecheck`     | TypeScript no-emit checks      |
| `bun run test`          | Test suite                     |
| `bun run test:smoke`    | Smoke tests                    |
| `bun run seed:demo`     | Seed demo data                 |
| `bun run docs:generate` | Regenerate OpenAPI/routes docs |
| `bun run db:generate`   | Generate Drizzle migrations    |
| `bun run db:migrate`    | Apply migrations               |

## Testing

Fast local verification:

```bash
bun run typecheck
bun run test
bun run test:smoke
```

Route/docs changes:

```bash
bun run docs:generate
```

Schema changes:

```bash
bun run db:generate
bun run db:migrate
```

Provider flows need safe sandbox/test credentials: Pakasir, Resend, AI, and R2/S3.

## Project Structure

```text
.
|-- drizzle/                  # SQL migrations
|-- docs/                     # docs and generated API artifacts
|-- scripts/                  # migrations, seed, docs generation
|-- src/
|   |-- app.ts
|   |-- index.ts
|   |-- db/
|   |-- docs/
|   |-- modules/
|   |-- routes/
|   `-- shared/
|-- tests/
|-- Dockerfile
|-- docker-compose.vps.yml
|-- docker-compose.dokploy.yml
|-- drizzle.config.ts
|-- package.json
|-- scalar.config.json
`-- tsconfig.json
```

Module shape:

```text
src/modules/<module>/
|-- <module>.routes.ts
|-- <module>.service.ts
|-- <module>.repository.ts
|-- <module>.schema.ts
|-- <module>.types.ts
`-- <module>.test.ts
```

Layering:

| Layer              | Does                                            | Avoids                   |
| ------------------ | ----------------------------------------------- | ------------------------ |
| Routes             | Method/path/middleware/request parsing          | Domain policy            |
| Schema             | Input validation/normalization                  | DB/provider calls        |
| Service            | Business rules/status transitions/orchestration | Hono response formatting |
| Repository         | Drizzle/Postgres query mapping                  | Business policy          |
| Integration client | Provider calls                                  | Domain state writes      |
| Shared HTTP/core   | Envelope/errors/middleware/helpers              | Feature logic            |

## Demo Flow

1. Patient registers/logs in.
2. Patient completes onboarding.
3. Patient records check-in or relapse.
4. Patient uses AI coach.
5. Patient uses journals, community, content.
6. Psychologist registers and completes profile.
7. Psychologist uploads credential files.
8. Ops manually approves psychologist.
9. Psychologist creates availability/session bundle.
10. Patient views psychologists and sessions.
11. Patient creates booking.
12. Patient completes Pakasir sandbox payment.
13. Webhook verifies transaction and updates status.
14. Resend sends notifications.
15. Psychologist confirms or reschedules with reason.
16. Patient sees session channel access.
17. Patient reviews completed consultation where supported.

Seed demo data:

```bash
bun run seed:demo
```

Pakasir sandbox simulation:

```bash
curl -L "$PAKASIR_BASE_URL/api/paymentsimulation" \
  -H 'Content-Type: application/json' \
  -d '{"project":"'"$PAKASIR_PROJECT_SLUG"'","order_id":"<order_id>","amount":150000,"api_key":"'"$PAKASIR_API_KEY"'"}'
```

## Deployment

Relevant files:

| File                          | Purpose                      |
| ----------------------------- | ---------------------------- |
| `Dockerfile`                  | App image                    |
| `docker-compose.vps.yml`      | VPS Compose deployment       |
| `docker-compose.dokploy.yml`  | Dokploy Compose deployment   |
| `Caddyfile`                   | Reverse proxy config if used |
| `docs/vps-deploy.md`          | Deployment guide             |
| `docs/vps-cutover-runbook.md` | Cutover/rollback guide       |

Expectations:

- Build from committed source and `bun.lock`.
- Provide secrets via deployment env or server-side `.env.vps`.
- Run migrations explicitly before serving prod traffic.
- Use `/health/live` and `/health/ready`.
- Keep staging/prod DBs, secrets, and CORS origins separate.

## Security

Pulih handles sensitive mental-health and consultation data.

Rules:

- Never commit `.env`, `.env.vps`, API keys, JWT secrets, DB passwords, private keys, or storage credentials.
- Never log passwords, tokens, API keys, raw journals, relapse triggers, sensitive AI prompts, credential file content, or meet links unnecessarily.
- Enforce Bearer auth on protected endpoints.
- Enforce ownership for profiles, journals, AI chats, bookings, credential files, and meet/session access.
- Keep API messages/error details English.
- Keep AI non-diagnostic with crisis/emergency boundaries where relevant.
- Keep credential files private.
- Validate Pakasir webhook payloads and verify provider transaction details.
- Make webhook handling idempotent.
- Reject unsupported credential files and oversize uploads.

## Contribution

Before changing behavior:

- Read relevant tracked docs for touched area.
- Inspect analogous modules under `src/modules/*`.
- Keep route → service → repository/integration layering.
- Validate input at API boundary.
- Preserve English API responses and stable error codes.
- Add/update tests for changed behavior.
- Update docs/generated artifacts when routes, env vars, setup, schema, or workflows change.
- Avoid unrelated formatting or cleanup.

Before handoff:

```bash
bun run typecheck
bun run test
```

Run narrower checks for small changes, but document skipped verification.

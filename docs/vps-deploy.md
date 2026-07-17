# VPS Deployment

VPS runtime for Pulih API using Docker Compose with immutable image tags.

## CI/CD status

GitHub Actions deployment workflows are intentionally archived. Active Actions should not deploy production.

- **CI** (`.github/workflows/ci.yml`): runs on push/PR to `development` and `main`. Quality gates (install, typecheck, test, OpenAPI docs check), Docker image build, smoke test on built image.
- **Archived Deploy VPS** (`.github/workflows/deploy-vps.yml.archived`): previous manual VPS deploy workflow. Kept as reference only; not active in GitHub Actions.
- **Archived Dokploy deploy** (`.github/workflows/deploy-dokploy.yml.archived`): previous manual Dokploy deploy workflow. Kept as reference only; not active in GitHub Actions.
- **Archived Cloudflare deploy** (`.github/workflows/main-deploy.yml.archived`): previous `main` branch Cloudflare Worker deploy workflow. Kept as reference only; not active in GitHub Actions.

### GitHub Secrets Required

| Secret        | Description                                                                       |
| ------------- | --------------------------------------------------------------------------------- |
| `VPS_SSH_KEY` | Private SSH key for VPS access                                                    |
| `VPS_HOST`    | VPS hostname or IP                                                                |
| `VPS_USER`    | SSH user on VPS                                                                   |
| `GHCR_TOKEN`  | GitHub personal access token with `packages:read` scope (for docker login on VPS) |

CI image push uses the built-in `GITHUB_TOKEN`, no extra secret needed.

## Prerequisites

- VPS with Docker Engine 24+ and Docker Compose plugin.
- Domain DNS A/AAAA record pointing to VPS public IP.
- Firewall allows inbound 80/443 (public) and blocks all other ports from public.
- SSH access with key-based auth.
- `.env.vps` file created on VPS (see below).
- GHCR read access (personal access token or deploy key) if image is private.
- Database backup before first deploy or schema migration.

## VPS env file

Create `.env.vps` on the VPS in the same directory as `docker-compose.vps.yml`. Never commit this file.

```ini
# Required
IMAGE_TAG=sha-<commit-sha>
DATABASE_URL=postgresql://user:password@host:5432/pulih_db?sslmode=require
DIRECT_DATABASE_URL=postgresql://user:password@host:5432/pulih_db?sslmode=require

# Auth (must match what existing tokens were issued with)
JWT_ACCESS_SECRET=<strong-random-secret>
JWT_ACCESS_TTL_SECONDS=86400
PASSWORD_HASH_COST=10

# CORS
CORS_ALLOWED_ORIGINS=https://your-frontend-domain.com

# Optional overrides
APP_ENV=production
NODE_ENV=production
PORT=3001

# Integrations
PAKASIR_PROJECT_SLUG=pulih
PAKASIR_API_KEY=<pakasir-api-key>
PAKASIR_BASE_URL=https://app.pakasir.com
PAKASIR_PAYMENT_BASE_URL=https://app.pakasir.com
PAKASIR_PROVIDER_TIMEOUT_MS=10000
RESEND_API_KEY=<resend-api-key>
RESEND_FROM_EMAIL=no-reply@salmanabdurrahman.web.id
RESEND_FROM_NAME=Pulih
AI_BASE_URL=https://openrouter.ai/api/v1
AI_API_KEY=<ai-api-key>
AI_MODEL=google/gemini-2.5-flash-lite
AI_TIMEOUT_MS=10000
AI_MAX_TOKENS=800

# File storage — Cloudflare R2 (S3-compatible)
# Endpoint format: https://<account-id>.r2.cloudflarestorage.com
CREDENTIAL_STORAGE_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
CREDENTIAL_STORAGE_REGION=auto
CREDENTIAL_STORAGE_BUCKET=pulih-credentials
CREDENTIAL_STORAGE_ACCESS_KEY=<r2-access-key-id>
CREDENTIAL_STORAGE_SECRET_KEY=<r2-secret-access-key>
```

## First-time VPS setup

SSH into VPS:

```sh
ssh user@vps-ip
```

Create app directory and place files:

```sh
mkdir -p /opt/pulih-api
cd /opt/pulih-api
```

Copy `docker-compose.vps.yml` and create `.env.vps` from the template above.

If using GHCR with private images, log in:

```sh
echo "<ghcr-token>" | docker login ghcr.io -u <github-username> --password-stdin
```

## Deploy

### Manual

Deployment is manual while GitHub Actions deploy workflows stay archived.

Pull new image and restart:

```sh
cd /opt/pulih-api
export IMAGE_TAG=sha-<commit-sha>
docker compose -f docker-compose.vps.yml pull api
docker compose -f docker-compose.vps.yml up -d --wait
```

## Run migrations

Migrations run separately so you can review SQL before applying:

```sh
cd /opt/pulih-api
docker compose -f docker-compose.vps.yml exec api bun run scripts/migrate.ts
```

For the first deploy, run migrations before health checks:

```sh
docker compose -f docker-compose.vps.yml up -d
docker compose -f docker-compose.vps.yml exec api bun run scripts/migrate.ts
```

## Verify

```sh
# Health checks
docker compose -f docker-compose.vps.yml exec api curl -sf http://127.0.0.1:3001/health/live
docker compose -f docker-compose.vps.yml exec api curl -sf http://127.0.0.1:3001/health/ready

# Public (if reverse proxy is set up)
curl -sf https://api.your-domain.com/health/live
curl -sf https://api.your-domain.com/health/ready

# Auth check
curl -s -o /dev/null -w "%{http_code}" https://api.your-domain.com/api/v1/auth/me
# Expected: 401 (UNAUTHENTICATED) — confirms auth guard is active
```

## Reverse proxy

If the VPS has no existing reverse proxy, enable the `caddy` service in `docker-compose.vps.yml` and add a `Caddyfile`:

```caddyfile
api.your-domain.com {
  reverse_proxy api:3001
}
```

If using nginx, Apache, or a cloud load balancer instead, keep the `caddy` service commented and configure the existing reverse proxy to forward to `127.0.0.1:3001`.

## Logs

```sh
docker compose -f docker-compose.vps.yml logs -f api
```

Logs go to stdout/stderr. Use Docker logging drivers for persistent log shipping if needed.

## Rollback

If a deploy is bad, point `IMAGE_TAG` to the previous known-good tag and restart:

```sh
export IMAGE_TAG=sha-<previous-good-sha>
docker compose -f docker-compose.vps.yml up -d
```

If the schema migration was destructive and cannot be rolled back automatically, restore the database backup before rollback.

## Security notes

- `.env.vps` contains secrets and lives only on the VPS. Never commit it.
- Do not expose database ports in compose.
- Use firewall to allow only 80/443 from public.
- Rotate `JWT_ACCESS_SECRET` only if all existing tokens can be invalidated, since the MVP has no refresh-token rotation.

# Cloudflare Worker + R2 Setup

Step-by-step Cloudflare setup for Pulih API trial deploy.

## 1. What you need

- Cloudflare account
- Domain/subdomain if you want a custom hostname
- Supabase Postgres connection string
- Pakasir, Resend, and AI secrets if you want an end-to-end demo
- Local repo clone

## 2. Confirm code bindings

This repo uses these bindings:

- `HYPERDRIVE` → Postgres connection from Cloudflare Hyperdrive
- `CREDENTIAL_BUCKET` → Cloudflare R2 bucket for psychologist credential files

## 3. Set up R2 bucket

1. Open Cloudflare Dashboard.
2. Go to **R2 Object Storage**.
3. Create a new bucket, for example: `pulih-credential-files`.
4. Save the bucket name.
5. Keep the bucket private.

Notes:

- do not enable public access for credential files;
- these files are sensitive;
- manual/internal review is better for now.

## 4. Set up Hyperdrive for Supabase

1. Open **Hyperdrive** in Cloudflare Dashboard.
2. Create a new connection.
3. Paste your Supabase Postgres connection string.
4. Save the Hyperdrive ID.
5. Test the connection until it succeeds.

Use the same database details as local `DATABASE_URL` / `DIRECT_DATABASE_URL`, but with production Supabase values.

## 5. Update `wrangler.toml`

Open `wrangler.toml`, then set the bindings below:

```toml
[[hyperdrive]]
binding = "HYPERDRIVE"
id = "<HYPERDRIVE_ID>"

[[r2_buckets]]
binding = "CREDENTIAL_BUCKET"
bucket_name = "pulih-credential-files"
```

If you want a separate production env, add `[env.production]` later.

## 6. Set Cloudflare secrets

Never put secrets in the repo. Use `wrangler secret put`.

Minimum:

```sh
bunx wrangler secret put JWT_ACCESS_SECRET
bunx wrangler secret put PAKASIR_API_KEY
bunx wrangler secret put RESEND_API_KEY
bunx wrangler secret put AI_API_KEY
```

If production needs more values, set these too:

```sh
bunx wrangler secret put DATABASE_URL
bunx wrangler secret put DIRECT_DATABASE_URL
```

If all DB access goes through Hyperdrive, keep DB values for local/CI migrations only.

## 7. Set non-secret vars

Some values can go into `wrangler.toml` or env config:

- `APP_NAME`
- `APP_ENV`
- `API_PREFIX`
- `APP_URL`
- `PWA_URL`
- `CORS_ALLOWED_ORIGINS`
- `RESEND_FROM_EMAIL`
- `RESEND_FROM_NAME`
- `PAKASIR_PROJECT_SLUG`
- `PAKASIR_BASE_URL`
- `PAKASIR_PAYMENT_BASE_URL`
- `AI_BASE_URL`
- `AI_MODEL`

## 8. Run locally first

```sh
bun install
bun run typecheck
bun run test
bun run dev
```

To simulate Wrangler locally:

```sh
bunx wrangler dev
```

## 9. Run migrations

Before deploy, make sure the DB is ready and migrations pass.

```sh
bun run db:generate
bun run db:migrate
```

If you use GitHub Actions on `main`, the workflow will also run migrate then deploy.

## 10. GitHub Actions deploy setup

The repo has `.github/workflows/main-deploy.yml` for `main` branch deploys.

Required GitHub Actions secret:

- `WORKER_ENV_FILE`

Use `.env` format inside `WORKER_ENV_FILE`. Start from `.env.example`, then replace all placeholder values with production/demo values. `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are required for Wrangler deploy auth.

```env
CLOUDFLARE_API_TOKEN=replace-with-cloudflare-api-token
CLOUDFLARE_ACCOUNT_ID=replace-with-cloudflare-account-id
APP_NAME=pulih-api
APP_ENV=production
NODE_ENV=production
PORT=3000
API_PREFIX=/api/v1
APP_URL=https://api.example.com
PWA_URL=https://app.example.com
CORS_ALLOWED_ORIGINS=https://app.example.com
REQUEST_ID_HEADER=x-request-id
DATABASE_URL=postgresql://...
DIRECT_DATABASE_URL=postgresql://...
JWT_ACCESS_SECRET=replace-with-strong-secret
JWT_ACCESS_TTL_SECONDS=86400
PASSWORD_HASH_COST=10
PAKASIR_PROJECT_SLUG=pulih
PAKASIR_API_KEY=replace-with-pakasir-api-key
PAKASIR_BASE_URL=https://app.pakasir.com
PAKASIR_PAYMENT_BASE_URL=https://app.pakasir.com
PAKASIR_PROVIDER_TIMEOUT_MS=10000
RESEND_API_KEY=replace-with-resend-api-key
RESEND_FROM_EMAIL=no-reply@salmanabdurrahman.web.id
RESEND_FROM_NAME=Pulih
AI_BASE_URL=https://ai.sumopod.com/v1
AI_API_KEY=replace-with-ai-api-key
AI_MODEL=gpt-4o-mini
AI_TIMEOUT_MS=10000
AI_MAX_TOKENS=800
```

The workflow loads `WORKER_ENV_FILE`, masks values, validates required keys, runs install, typecheck, tests, DB migrations, Worker secret sync, and Worker deploy.

## 11. Deploy to Cloudflare Worker manually

If local checks are good:

```sh
bunx wrangler deploy
```

## 12. Verify after deploy

Check at minimum:

- `GET /health/live`
- `GET /health/ready`
- `GET /openapi.json`
- credential file upload/read flow if the psychologist module is active

## 13. Quick troubleshooting

- **Worker cannot connect to DB** → check Hyperdrive binding `HYPERDRIVE` and DB secret.
- **Credential file upload fails** → check `CREDENTIAL_BUCKET` binding and private bucket.
- **Webhook/email/AI fails** → check provider secrets and env values.
- **CORS error** → check `CORS_ALLOWED_ORIGINS`.

## 14. Quick checklist

- [ ] Private R2 bucket created
- [ ] Hyperdrive to Supabase created
- [ ] `wrangler.toml` bindings filled
- [ ] Cloudflare secrets set
- [ ] Local test passed
- [ ] Migration passed
- [ ] Worker deploy succeeded

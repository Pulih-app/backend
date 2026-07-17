# VPS Cutover and Rollback Runbook

Cutover from Cloudflare Workers to VPS Docker runtime for Pulih API production deployment.

## Architecture Change

```text
Before (current):  Cloudflare Workers + Wrangler deploy (main-deploy.yml)
After (target):    Bun HTTP server in Docker container on VPS (docker-compose.vps.yml)
```

This runbook assumes Cloudflare Worker is the live production and VPS is the cutover target.

---

## 1. Pre-Cutover Preparation

### 1.1 Database Backup

Before any cutover step, capture backup evidence:

```sh
# On your machine, run against Supabase:
pg_dump "$DIRECT_DATABASE_URL" --no-owner --no-acl \
  --file="pulih_backup_$(date -u +%Y%m%d_%H%M%S).sql"
```

Verify backup:

```sh
grep -c "CREATE TABLE" pulih_backup_*.sql
# Should show expected table count (check against current schema)
```

Checklist:

- [ ] Full `pg_dump` taken and stored outside VPS
- [ ] Backup file size is reasonable (not 0 bytes)
- [ ] Migration `_journal.json` saved alongside backup as reference

### 1.2 Current Production Evidence

Capture Cloudflare Worker baseline before cutover:

```sh
# Health endpoints
curl -s "https://api.pulih.app/health/live" | jq .
curl -s "https://api.pulih.app/health/ready" | jq .

# Auth guard (expect 401)
curl -s -o /dev/null -w "%{http_code}" "https://api.pulih.app/api/v1/auth/me"

# Public endpoints
curl -s "https://api.pulih.app/api/v1/psychologists" | jq '.data | length'
curl -s "https://api.pulih.app/docs/api" -o /dev/null -w "%{http_code}"
```

Checklist:

- [ ] `/health/live` returns `200`
- [ ] `/health/ready` returns `200`
- [ ] `/api/v1/auth/me` returns `401` (auth guard active)
- [ ] Public psychologist directory returns data
- [ ] Scalar docs accessible

### 1.3 VPS Environment Validation

SSH to VPS and verify:

```sh
ssh "$VPS_USER@$VPS_HOST"
```

Run these checks:

```sh
# Docker running
docker version

# App directory exists
ls -la /opt/pulih-api/

# docker-compose file present
ls -la /opt/pulih-api/docker-compose.vps.yml

# .env.vps exists and has required keys
grep -c "DATABASE_URL\|JWT_ACCESS_SECRET\|CORS_ALLOWED_ORIGINS" /opt/pulih-api/.env.vps
# Expected: 3 (all three keys present)

# VPS can reach Supabase
# Run from VPS:
nc -zv $(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):\([0-9]*\).*/\1 \2/p' | head -1) 2>&1

# Firewall: 80 and 443 open, everything else blocked from public
sudo ufw status verbose
# or: sudo iptables -L -n
```

Checklist:

- [ ] Docker Engine 24+ with Compose plugin
- [ ] `/opt/pulih-api/docker-compose.vps.yml` present
- [ ] `/opt/pulih-api/.env.vps` present with all required keys
- [ ] VPS can reach database (network path verified)
- [ ] Firewall allows 80/443 from public, blocks everything else
- [ ] SSH key-only auth (no password login)
- [ ] GHCR login tested: `docker pull ghcr.io/pulih-app/backend:latest`

### 1.4 Migration Review

Before cutover, review pending migrations:

```sh
# Locally: list migration files
ls -la drizzle/

# Review each SQL file not yet applied to production
# Check for:
#   - DROP TABLE / DROP COLUMN
#   - ALTER COLUMN ... TYPE (potential data loss)
#   - NOT NULL on existing columns without defaults
```

Checklist:

- [ ] All pending SQL migrations reviewed by human
- [ ] No destructive changes without explicit approval
- [ ] Migration order matches `_journal.json`
- [ ] `DIRECT_DATABASE_URL` confirmed for migration connection

### 1.5 DNS and CORS Pre-Check

```sh
# Current DNS resolution
dig +short api.pulih.app
# Record current IP for rollback reference

# TTL on current record
dig api.pulih.app | grep -E "^\s+[0-9]+" | head -1
# Note TTL for cutover timing estimate
```

Checklist:

- [ ] Current DNS A/AAAA record documented for rollback
- [ ] TTL noted (TTL seconds = minimum wait after DNS change)
- [ ] VPS public IP confirmed
- [ ] `CORS_ALLOWED_ORIGINS` in `.env.vps` includes production PWA domain
- [ ] PWA CORS origin matches actual frontend URL

---

## 2. Cutover Execution

### 2.1 Pre-Deploy Steps

On VPS:

```sh
cd /opt/pulih-api

# Pull the target image
export IMAGE_TAG=sha-<commit-sha>
docker compose -f docker-compose.vps.yml pull api

# Verify image digest
docker inspect ghcr.io/pulih-app/backend:${IMAGE_TAG} --format='{{.RepoDigests}}'
```

Checklist:

- [ ] Image pulled successfully on VPS
- [ ] Image tag is immutable (`sha-<sha>`, not `latest` for cutover)
- [ ] Image digest recorded for audit

### 2.2 Deploy and Migrate

```sh
cd /opt/pulih-api

# Bring up the service
IMAGE_TAG=sha-<commit-sha> docker compose -f docker-compose.vps.yml up -d --wait

# Wait for healthy
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:3002/health/live > /dev/null 2>&1; then
    echo "Healthy after ${i}s"
    break
  fi
  sleep 1
done

# Run database migrations
docker compose -f docker-compose.vps.yml exec -T api bun run scripts/migrate.ts

# Verify post-migration health
curl -sf http://127.0.0.1:3002/health/ready
```

Checklist:

- [ ] Container started and healthy
- [ ] Database migrations applied successfully
- [ ] `/health/ready` returns `200` post-migration

### 2.3 Pre-DNS Smoke Verification

Test VPS directly before DNS cutover:

```sh
VPS_IP=<vps-public-ip>

# Health
curl -sf "http://${VPS_IP}:3002/health/live" | jq .
curl -sf "http://${VPS_IP}:3002/health/ready" | jq .

# Auth guard
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://${VPS_IP}:3002/api/v1/auth/me")
if [ "$STATUS" != "401" ]; then
  echo "FAIL: Auth guard returned ${STATUS}, expected 401"
  exit 1
fi

# Public directory
DIR_COUNT=$(curl -s "http://${VPS_IP}:3002/api/v1/psychologists" | jq '.data | length')
echo "Psychologists in directory: ${DIR_COUNT}"

# Register a test user
REGISTER=$(curl -s "http://${VPS_IP}:3002/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"cutover-test@example.com","password":"cutover-test-123"}')
echo "Register: $(echo $REGISTER | jq -c .)"

TOKEN=$(echo "$REGISTER" | jq -r '.data.token')

# Protected route with token
ME=$(curl -s "http://${VPS_IP}:3002/api/v1/auth/me" \
  -H "Authorization: Bearer ${TOKEN}")
echo "Me: $(echo $ME | jq -c '.data.email')"
```

Checklist:

- [ ] `/health/live` returns `200` with valid JSON
- [ ] `/health/ready` returns `200` with valid JSON
- [ ] `/api/v1/auth/me` returns `401` without token
- [ ] Public psychologist directory returns valid response
- [ ] Registration works
- [ ] Auth token works for protected route
- [ ] Response envelope matches expected format (`{ success, message, data, meta }`)
- [ ] Response messages in English

### 2.4 DNS Cutover

Update DNS A/AAAA record to point to VPS public IP:

```sh
# Before updating, note current record for rollback
OLD_IP=$(dig +short api.pulih.app)
echo "Current IP: ${OLD_IP}"

# Update DNS record at provider (manual step or API call)
# Example for Cloudflare API:
# curl -X PATCH "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records/${RECORD_ID}" \
#   -H "Authorization: Bearer ${CF_API_TOKEN}" \
#   -H "Content-Type: application/json" \
#   -d '{"type":"A","name":"api.pulih.app","content":"<vps-ip>","ttl":120}'
```

Checklist:

- [ ] Old DNS record saved for rollback
- [ ] DNS record updated to VPS IP
- [ ] TTL waits accounted for (wait TTL seconds before assuming full propagation)

### 2.5 Post-DNS Verification

Wait TTL seconds after DNS update, then verify:

```sh
BASE_URL="https://api.pulih.app"

# Health
curl -sf "${BASE_URL}/health/live" | jq .
curl -sf "${BASE_URL}/health/ready" | jq .

# Auth guard
curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/v1/auth/me"
# Expected: 401

# Public directory
curl -s "${BASE_URL}/api/v1/psychologists" | jq '.data | length'

# Full demo flow (see Section 5.3)
```

Checklist:

- [ ] DNS resolves to VPS IP (`dig +short api.pulih.app`)
- [ ] All health endpoints respond through domain
- [ ] Auth guard active through domain
- [ ] TLS/HTTPS working (certificate valid)
- [ ] CORS headers correct for PWA origin

---

## 3. Observation Window

After DNS cutover, monitor for at least **30 minutes**:

### 3.1 Runtime Monitoring

On VPS:

```sh
# Container status
docker compose -f docker-compose.vps.yml ps

# Resource usage
docker stats --no-stream $(docker compose -f docker-compose.vps.yml ps -q api)

# Recent logs
docker compose -f docker-compose.vps.yml logs --tail=100 api

# Follow logs for errors
docker compose -f docker-compose.vps.yml logs -f api | grep -iE "error|fail|panic|fatal"
```

### 3.2 External Monitoring

```sh
# Periodic health checks
for i in $(seq 1 30); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://api.pulih.app/health/ready")
  echo "$(date -u +%H:%M:%S) ready=${STATUS}"
  sleep 60
done
```

### 3.3 Observability Checklist

- [ ] No crash/restart loop in container logs
- [ ] Memory below 512MB limit
- [ ] CPU below limit
- [ ] `/health/ready` stable at 200 for full observation window
- [ ] No `CONFIG_VALIDATION_ERROR` in startup logs
- [ ] Database connection pool healthy (no timeouts in logs)
- [ ] No unexpected error spikes in logs

---

## 4. Rollback Procedure

### 4.1 Decision Criteria

Rollback if any of these occur during observation:

- `/health/ready` returns non-200 for more than 2 consecutive checks
- Container crash loop
- Database connection failures in logs
- Payment webhook failures
- Critical demo flow broken (registration, booking, payment)
- Memory/CPU exhaustion

### 4.2 DNS Rollback

Revert DNS to Cloudflare Worker:

```sh
# Point back to Cloudflare Workers
# Restore the original DNS record saved in step 2.4
OLD_IP="<original-worker-ip>"
# Update DNS record to OLD_IP
```

Wait TTL seconds for propagation.

### 4.3 Image Rollback

If issue is VPS image-specific (not DNS), rollback image only:

```sh
cd /opt/pulih-api

# Rollback to previous known-good image
export IMAGE_TAG=sha-<previous-good-sha>
docker compose -f docker-compose.vps.yml up -d --wait
```

### 4.4 Schema Migration Rollback Limitations

**Schema migrations are forward-only.** Drizzle generates `CREATE/ALTER` SQL — no automatic down migration.

Rollback limitations:

| Migration Type                  | Rollback Safe?    | Action                                        |
| ------------------------------- | ----------------- | --------------------------------------------- |
| `CREATE TABLE`                  | Yes (data intact) | Drop new table if needed                      |
| `ADD COLUMN` (nullable)         | Yes               | Code ignores column                           |
| `ADD COLUMN` (NOT NULL default) | Yes               | Code ignores column                           |
| `ALTER COLUMN ... TYPE`         | **No**            | Requires manual SQL reverse + data validation |
| `DROP COLUMN`                   | **No**            | Data lost; restore from backup                |
| `DROP TABLE`                    | **No**            | Data lost; restore from backup                |

If migration was destructive:

1. Restore database from pre-cutover backup
2. Replay only safe migrations
3. Redeploy previous image

**Prevention**: review every migration SQL in Section 1.4 before cutover.

### 4.5 Post-Rollback Verification

After rollback:

```sh
BASE_URL="https://api.pulih.app"

# DNS resolved back to Cloudflare
dig +short api.pulih.app

# Health
curl -sf "${BASE_URL}/health/live"
curl -sf "${BASE_URL}/health/ready"

# Auth guard
curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/v1/auth/me"
# Expected: 401

# Flow check
# Run demo flow from Section 5.3
```

Checklist:

- [ ] DNS resolved to previous target
- [ ] Health endpoints OK
- [ ] Auth guard active
- [ ] No data corruption from partial migration
- [ ] Payment webhooks reachable
- [ ] Rollback time logged for postmortem

---

## 5. Smoke Test Checklist

Run after cutover and after any rollback.

### 5.1 Health Endpoints

```sh
BASE_URL="https://api.pulih.app"

# /health/live
LIVE=$(curl -sf "${BASE_URL}/health/live")
echo "$LIVE" | jq -e '.success == true and .data.status == "ok"'

# /health/ready
READY=$(curl -sf "${BASE_URL}/health/ready")
echo "$READY" | jq -e '.success == true and .data.status == "ok"'
```

- [ ] `/health/live`: `200`, `{"success":true,"message":"Service is running","data":{"status":"ok"}}`
- [ ] `/health/ready`: `200`, `{"success":true,"message":"Service is ready","data":{"status":"ok"}}`

### 5.2 Auth Guard

```sh
# No token → 401
curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/v1/auth/me"
# Expected: 401

# Invalid token → 401
curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/v1/auth/me" \
  -H "Authorization: Bearer invalid-token-here"
# Expected: 401
```

- [ ] No token returns `401`
- [ ] Invalid token returns `401`

### 5.3 Core Demo Flows

#### 5.3.1 Registration and Authentication

```sh
# Register patient
REGISTER=$(curl -s "${BASE_URL}/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"smoke-test@example.com","password":"smoke-test-123"}')
echo "$REGISTER" | jq -e '.success == true'
TOKEN=$(echo "$REGISTER" | jq -r '.data.token')

# Login
LOGIN=$(curl -s "${BASE_URL}/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"smoke-test@example.com","password":"smoke-test-123"}')
echo "$LOGIN" | jq -e '.success == true'

# Authenticated profile
curl -s "${BASE_URL}/api/v1/auth/me" \
  -H "Authorization: Bearer ${TOKEN}" | jq -e '.success == true'
```

- [ ] Register: `200` with token
- [ ] Login: `200` with token
- [ ] Duplicate register: `409`
- [ ] Wrong password login: `401`
- [ ] Authenticated `GET /auth/me` returns user data

#### 5.3.2 Psychologist Directory

```sh
# List approved psychologists
LIST=$(curl -s "${BASE_URL}/api/v1/psychologists")
echo "$LIST" | jq -e '.success == true'

# Detail (use a known psychologist_id from seed or directory)
PSYCHOLOGIST_ID=$(echo "$LIST" | jq -r '.data[0].id // empty')
if [ -n "$PSYCHOLOGIST_ID" ]; then
  curl -s "${BASE_URL}/api/v1/psychologists/${PSYCHOLOGIST_ID}" | jq -e '.success == true'

  # Generated sessions
  curl -s "${BASE_URL}/api/v1/psychologists/${PSYCHOLOGIST_ID}/sessions" | jq -e '.success == true'
fi
```

- [ ] Public directory returns only approved psychologists
- [ ] Detail returns consultation channel info
- [ ] Sessions show generated slots

#### 5.3.3 Booking and Payment Flow

```sh
# Create booking (requires auth token and available session_slot_id)
SLOT_ID="<session-slot-id>"
BOOKING=$(curl -s "${BASE_URL}/api/v1/bookings" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"session_slot_id\":\"${SLOT_ID}\"}")
echo "$BOOKING" | jq -e '.success == true'
ORDER_ID=$(echo "$BOOKING" | jq -r '.data.order_id')
PAYMENT_URL=$(echo "$BOOKING" | jq -r '.data.payment_url')

# Verify payment URL is present
echo "Payment URL: ${PAYMENT_URL}"
```

- [ ] Booking creates payment row
- [ ] Payment URL returned
- [ ] Same session slot cannot be double-booked (expect `409`)

#### 5.3.4 Payment Simulation

```sh
# Simulate payment (Pakasir sandbox)
PAKASIR_BASE_URL="https://app.pakasir.com"
PAKASIR_API_KEY="<api-key>"

curl -s "${PAKASIR_BASE_URL}/api/paymentsimulation" \
  -H "Content-Type: application/json" \
  -d "{\"project\":\"pulih\",\"order_id\":\"${ORDER_ID}\",\"amount\":150000,\"api_key\":\"${PAKASIR_API_KEY}\"}"

# Trigger webhook
WEBHOOK_PAYLOAD=$(jq -n \
  --arg order_id "$ORDER_ID" \
  --arg project "pulih" \
  '{order_id: $order_id, project: $project, status: "paid"}')

curl -s "${BASE_URL}/api/v1/payments/pakasir/webhook" \
  -H "Content-Type: application/json" \
  -d "$WEBHOOK_PAYLOAD" | jq -e '.success == true'

# Verify booking status updated
BOOKING_STATUS=$(curl -s "${BASE_URL}/api/v1/bookings" \
  -H "Authorization: Bearer ${TOKEN}" | jq -r '.data[0].status')
echo "Booking status: ${BOOKING_STATUS}"
# Expected: payment_completed (after successful webhook)
```

- [ ] Payment simulation succeeds
- [ ] Webhook processes idempotently
- [ ] Duplicate webhook does not create duplicate events
- [ ] Booking status transitions correctly

#### 5.3.5 Routine Check-In

```sh
# Daily check-in
CHECKIN=$(curl -s "${BASE_URL}/api/v1/routine/checkin" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"mood":"good","note":"smoke test check-in"}')
echo "$CHECKIN" | jq -e '.success == true'

# Second check-in same day → conflict
curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/v1/routine/checkin" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"mood":"ok","note":"duplicate"}'
# Expected: 409

# Statistics
curl -s "${BASE_URL}/api/v1/routine/statistics" \
  -H "Authorization: Bearer ${TOKEN}" | jq -e '.success == true'
```

- [ ] Check-in creates record
- [ ] Duplicate check-in same day returns `409`
- [ ] Statistics return valid data

#### 5.3.6 Journals

```sh
# Create journal
JOURNAL=$(curl -s "${BASE_URL}/api/v1/journals" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"title":"Smoke test journal","content":"Smoke test content"}')
echo "$JOURNAL" | jq -e '.success == true'

# List journals
curl -s "${BASE_URL}/api/v1/journals" \
  -H "Authorization: Bearer ${TOKEN}" | jq -e '.success == true'
```

- [ ] Journal created
- [ ] Journal list shows own journals only

### 5.4 Integration Checks

```sh
# Education content
curl -s "${BASE_URL}/api/v1/education" | jq -e '.success == true and (.data | length > 0)'

# Daily content
curl -s "${BASE_URL}/api/v1/content/daily" | jq -e '.success == true'

# Community posts
curl -s "${BASE_URL}/api/v1/community" | jq -e '.success == true'

# Achievements catalog
curl -s "${BASE_URL}/api/v1/achievements/catalog" | jq -e '.success == true'

# Scalar API docs
curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/docs/api"
# Expected: 200
```

- [ ] Education content returns data
- [ ] Daily content returns data
- [ ] Community posts accessible
- [ ] Achievements catalog accessible
- [ ] Scalar docs page loads

### 5.5 Response Format

```sh
RESPONSE=$(curl -s "${BASE_URL}/health/live")
echo "$RESPONSE" | jq -e 'has("success") and has("message") and has("data")'
echo "$RESPONSE" | jq -r '.message' | grep -qE "^[A-Z]"
# Message starts with capital letter (English)
```

- [ ] All responses have `{ success, message, data }` envelope
- [ ] Messages are in English
- [ ] Error responses have `request_id` when applicable

---

## 6. Incident Response

### 6.1 Immediate Actions

If cutover fails:

1. **Do not panic**. DNS rollback takes TTL seconds.
2. Execute Section 4.2 DNS rollback immediately.
3. If only image issue, use Section 4.3 image rollback.
4. Capture logs before restarting: `docker compose logs --tail=500 api`

### 6.2 Log Capture Commands

```sh
# Full container logs
docker compose -f docker-compose.vps.yml logs api > pulih_cutover_logs_$(date -u +%Y%m%d_%H%M%S).txt

# Container inspect (env, mounts, network)
docker inspect $(docker compose -f docker-compose.vps.yml ps -q api) > pulih_container_inspect.json

# Resource usage snapshot
docker stats --no-stream $(docker compose -f docker-compose.vps.yml ps -q api)

# Last 50 DB connection attempts in log
docker compose -f docker-compose.vps.yml logs api | grep -i "database\|postgres\|connection" | tail -50
```

### 6.3 What NOT to Log

Never capture in logs:

- `DATABASE_URL` or `DIRECT_DATABASE_URL` (contains credentials)
- `JWT_ACCESS_SECRET`
- API keys (`PAKASIR_API_KEY`, `RESEND_API_KEY`, `AI_API_KEY`)
- User tokens
- Journal content
- Chat messages
- Relapse triggers
- Raw AI prompts

---

## 7. Post-Cutover Cleanup

After successful cutover and observation window:

- [x] Disable Cloudflare Worker auto-deploy (`main-deploy.yml`) — archived as `main-deploy.yml.archived`
- [x] Archive GitHub Actions deployment workflows (`deploy-vps.yml`, `deploy-dokploy.yml`) — kept as `*.yml.archived` references
- [ ] Remove or rotate Cloudflare Worker secrets
- [x] Update `README.md` deployment section to VPS path
- [x] Archive `wrangler.toml` — removed
- [ ] Update monitoring to point to VPS
- [ ] Document cutover timestamp and deployed image tag for audit

---

## 8. Pre-Cutover Checklist Summary

Complete before cutover window:

- [ ] Database backup taken and verified
- [ ] Current production health baselined
- [ ] VPS environment validated (Docker, firewall, env file)
- [ ] GHCR pull tested from VPS
- [ ] All pending migrations reviewed (no destructive changes)
- [ ] DNS TTL noted
- [ ] Rollback DNS record documented
- [ ] `.env.vps` `CORS_ALLOWED_ORIGINS` includes PWA URL
- [ ] Cutover window communicated to stakeholders

---

## 9. Rollback Decision Matrix

| Symptom                           | Action                               | Timeline  |
| --------------------------------- | ------------------------------------ | --------- |
| `/health/live` fails after deploy | Image rollback                       | Immediate |
| `/health/ready` fails (DB issue)  | Check DB + image rollback            | Immediate |
| Auth broken (wrong JWT secret)    | Fix `.env.vps` + restart             | 5 min     |
| CORS blocking PWA                 | Fix `CORS_ALLOWED_ORIGINS` + restart | 5 min     |
| Payment webhook failing           | DNS rollback to Cloudflare           | 10 min    |
| Demo flow broken, unknown cause   | DNS rollback to Cloudflare           | 15 min    |
| Memory/CPU exhaustion             | Image rollback + resource analysis   | 30 min    |

# Demo Runbook

Use this flow for hackathon rehearsal.

## 1. Required env/secrets

Set local `.env` or worker secrets for:

- `DATABASE_URL`
- `DIRECT_DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_ACCESS_TTL_SECONDS`
- `PASSWORD_HASH_COST`
- `CORS_ALLOWED_ORIGINS`
- `PAKASIR_PROJECT_SLUG`
- `PAKASIR_API_KEY`
- `PAKASIR_BASE_URL`
- `PAKASIR_PAYMENT_BASE_URL`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `RESEND_FROM_NAME`
- `AI_BASE_URL`
- `AI_API_KEY`
- `AI_MODEL`

## 2. Manual DB approval step

After psychologist registers and fills profile:

1. open database console;
2. find psychologist row in `psychologist_profiles`;
3. set approval status to `approved`;
4. continue to session bundle creation.

## 3. Demo flow

1. `GET /health/live`
2. `GET /health/ready`
3. register patient
4. login patient
5. open profile/onboarding
6. list approved psychologists
7. create booking from generated session
8. open Pakasir payment URL
9. run Pakasir sandbox simulation
10. call webhook endpoint
11. confirm booking as psychologist
12. review session channel access
13. submit patient review

## 4. Demo seed check

Load the demo fixture set before rehearsal:

```sh
bun run seed:demo
```

The seed is repeatable and keeps the core demo rows in sync with the current MVP flow. It loads richer content fixtures for education, daily motivations, daily challenges, achievements, and community samples.

## 5. Pakasir sandbox simulation

Use payment simulation after booking is created:

```sh
curl -L "$PAKASIR_BASE_URL/api/paymentsimulation" \
  -H 'Content-Type: application/json' \
  -d '{"project":"'$PAKASIR_PROJECT_SLUG'","order_id":"<order_id>","amount":150000,"api_key":"'$PAKASIR_API_KEY'"}'
```

Then call `POST /api/v1/payments/pakasir/webhook` with matching payload.

## 6. Expected emails

Expected email events after payment/confirmation:

- payment success email to patient;
- booking received email to psychologist;
- booking confirmed session-ready email to patient;
- booking rescheduled email to patient when reschedule happens.

## 7. Rehearsal check

Confirm:

- booking status moves `pending_payment` → `payment_completed` → `confirmed`;
- clinical booking exposes meet link only after confirmation;
- general booking stays chat-only;
- no secret value appears in logs.

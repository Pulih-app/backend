# Pulih Route Inventory

Source of truth: `src/routes/api-route-inventory.ts`. OpenAPI operations are generated from this inventory and enriched in `src/docs/openapi.ts`.

| Method | Runtime path | Auth | MVP | OpenAPI path |
| ------ | ------------ | ---- | --- | ------------ |
| `GET` | `/health/live` | `public` | Yes | `/health/live` |
| `GET` | `/health/ready` | `public` | Yes | `/health/ready` |
| `POST` | `/validation-demo` | `public` | Yes | `/validation-demo` |
| `GET` | `/openapi.yaml` | `public` | Yes | `/openapi.yaml` |
| `GET` | `/openapi.json` | `public` | Yes | `/openapi.json` |
| `GET` | `/docs/api` | `public` | Yes | `/docs/api` |
| `GET` | `/docs/api/` | `public` | Yes | `/docs/api/` |
| `POST` | `/api/v1/auth/register` | `public` | Yes | `/api/v1/auth/register` |
| `POST` | `/api/v1/auth/login` | `public` | Yes | `/api/v1/auth/login` |
| `POST` | `/api/v1/auth/logout` | `public` | Yes | `/api/v1/auth/logout` |
| `GET` | `/api/v1/auth/me` | `bearer` | Yes | `/api/v1/auth/me` |
| `POST` | `/api/v1/auth/onboarding` | `bearer` | Yes | `/api/v1/auth/onboarding` |
| `GET` | `/api/v1/users/me` | `bearer` | Yes | `/api/v1/users/me` |
| `PUT` | `/api/v1/users/settings` | `bearer` | Yes | `/api/v1/users/settings` |
| `POST` | `/api/v1/psychologists/register` | `bearer` | Yes | `/api/v1/psychologists/register` |
| `GET` | `/api/v1/psychologists/me` | `bearer` | Yes | `/api/v1/psychologists/me` |
| `PUT` | `/api/v1/psychologists/me` | `bearer` | Yes | `/api/v1/psychologists/me` |
| `POST` | `/api/v1/psychologists/me/credential-file` | `bearer` | Yes | `/api/v1/psychologists/me/credential-file` |
| `POST` | `/api/v1/psychologists/me/submit-for-review` | `bearer` | Yes | `/api/v1/psychologists/me/submit-for-review` |
| `GET` | `/api/v1/psychologists/me/credential-file/:fileId/review-url` | `bearer` | Yes | `/api/v1/psychologists/me/credential-file/{fileId}/review-url` |
| `POST` | `/api/v1/psychologists/me/bundles` | `bearer` | Yes | `/api/v1/psychologists/me/bundles` |
| `PUT` | `/api/v1/psychologists/me/bundles/:bundleId` | `bearer` | Yes | `/api/v1/psychologists/me/bundles/{bundleId}` |
| `DELETE` | `/api/v1/psychologists/me/bundles/:bundleId` | `bearer` | Yes | `/api/v1/psychologists/me/bundles/{bundleId}` |
| `GET` | `/api/v1/psychologists` | `public` | Yes | `/api/v1/psychologists` |
| `GET` | `/api/v1/psychologists/:psychologistId` | `public` | Yes | `/api/v1/psychologists/{psychologistId}` |
| `GET` | `/api/v1/psychologists/:psychologistId/sessions` | `public` | Yes | `/api/v1/psychologists/{psychologistId}/sessions` |
| `POST` | `/api/v1/bookings` | `bearer` | Yes | `/api/v1/bookings` |
| `GET` | `/api/v1/bookings` | `bearer` | Yes | `/api/v1/bookings` |
| `GET` | `/api/v1/bookings/:bookingId` | `bearer` | Yes | `/api/v1/bookings/{bookingId}` |
| `POST` | `/api/v1/bookings/:bookingId/confirm` | `bearer` | Yes | `/api/v1/bookings/{bookingId}/confirm` |
| `POST` | `/api/v1/bookings/:bookingId/reschedule` | `bearer` | Yes | `/api/v1/bookings/{bookingId}/reschedule` |
| `POST` | `/api/v1/payments/pakasir/webhook` | `public` | Yes | `/api/v1/payments/pakasir/webhook` |
| `POST` | `/api/v1/routine/checkin` | `bearer` | Yes | `/api/v1/routine/checkin` |
| `POST` | `/api/v1/routine/relapses` | `bearer` | Yes | `/api/v1/routine/relapses` |
| `GET` | `/api/v1/routine/statistics` | `bearer` | Yes | `/api/v1/routine/statistics` |
| `GET` | `/api/v1/routine/statistics/activity-summary` | `bearer` | Yes | `/api/v1/routine/statistics/activity-summary` |
| `GET` | `/api/v1/routine/relapses` | `bearer` | Yes | `/api/v1/routine/relapses` |
| `GET` | `/api/v1/routine/relapses/statistics` | `bearer` | Yes | `/api/v1/routine/relapses/statistics` |
| `GET` | `/api/v1/journals` | `bearer` | Yes | `/api/v1/journals` |
| `POST` | `/api/v1/journals` | `bearer` | Yes | `/api/v1/journals` |
| `GET` | `/api/v1/community` | `bearer` | Yes | `/api/v1/community` |
| `POST` | `/api/v1/community` | `bearer` | Yes | `/api/v1/community` |
| `GET` | `/api/v1/community/:postId/comments` | `bearer` | Yes | `/api/v1/community/{postId}/comments` |
| `POST` | `/api/v1/community/:postId/comments` | `bearer` | Yes | `/api/v1/community/{postId}/comments` |
| `POST` | `/api/v1/community/:postId/like` | `bearer` | Yes | `/api/v1/community/{postId}/like` |
| `GET` | `/api/v1/education` | `bearer` | Yes | `/api/v1/education` |
| `GET` | `/api/v1/content/daily` | `bearer` | Yes | `/api/v1/content/daily` |
| `GET` | `/api/v1/achievements/catalog` | `bearer` | Yes | `/api/v1/achievements/catalog` |
| `GET` | `/api/v1/achievements/progress` | `bearer` | Yes | `/api/v1/achievements/progress` |
| `GET` | `/api/v1/achievements/unlocked` | `bearer` | Yes | `/api/v1/achievements/unlocked` |
| `POST` | `/api/v1/ai/ask-coach` | `bearer` | Yes | `/api/v1/ai/ask-coach` |
| `POST` | `/api/v1/ai/relapse-solution` | `bearer` | Yes | `/api/v1/ai/relapse-solution` |
| `POST` | `/api/v1/ai/relapse-prevention-plan` | `bearer` | Yes | `/api/v1/ai/relapse-prevention-plan` |
| `GET` | `/api/v1/ai/chat-history` | `bearer` | Yes | `/api/v1/ai/chat-history` |
| `GET` | `/api/v1/ai/summary` | `bearer` | Yes | `/api/v1/ai/summary` |
| `POST` | `/api/v1/ai/onboarding-analysis` | `bearer` | Yes | `/api/v1/ai/onboarding-analysis` |
| `GET` | `/api/v1/ai/persona-preferences` | `bearer` | Yes | `/api/v1/ai/persona-preferences` |
| `PUT` | `/api/v1/ai/persona-preferences` | `bearer` | Yes | `/api/v1/ai/persona-preferences` |


# API Routes

Source of truth: `src/app.ts` and route modules under `src/modules/*`.

## Public / health

| Method | Path               | Auth | MVP |
| ------ | ------------------ | ---- | --- |
| GET    | `/health/live`     | No   | Yes |
| GET    | `/health/ready`    | No   | Yes |
| POST   | `/validation-demo` | No   | Yes |
| GET    | `/openapi.yaml`    | No   | Yes |
| GET    | `/openapi.json`    | No   | Yes |
| GET    | `/docs/api`        | No   | Yes |
| GET    | `/docs/api/`       | No   | Yes |

## Auth

| Method | Path                      | Auth   | MVP |
| ------ | ------------------------- | ------ | --- |
| POST   | `/api/v1/auth/register`   | No     | Yes |
| POST   | `/api/v1/auth/login`      | No     | Yes |
| POST   | `/api/v1/auth/logout`     | No     | Yes |
| GET    | `/api/v1/auth/me`         | Bearer | Yes |
| POST   | `/api/v1/auth/onboarding` | Bearer | Yes |

## Users

| Method | Path                     | Auth   | MVP |
| ------ | ------------------------ | ------ | --- |
| GET    | `/api/v1/users/me`       | Bearer | Yes |
| PUT    | `/api/v1/users/settings` | Bearer | Yes |

## Psychologists

| Method | Path                                                          | Auth   | MVP |
| ------ | ------------------------------------------------------------- | ------ | --- |
| POST   | `/api/v1/psychologists/register`                              | Bearer | Yes |
| GET    | `/api/v1/psychologists/me`                                    | Bearer | Yes |
| PUT    | `/api/v1/psychologists/me`                                    | Bearer | Yes |
| POST   | `/api/v1/psychologists/me/credential-file`                    | Bearer | Yes |
| POST   | `/api/v1/psychologists/me/submit-for-review`                  | Bearer | Yes |
| GET    | `/api/v1/psychologists/me/credential-file/:fileId/review-url` | Bearer | Yes |
| POST   | `/api/v1/psychologists/me/bundles`                            | Bearer | Yes |
| POST   | `/api/v1/psychologists/me/availability-windows`               | Bearer | Yes |
| PUT    | `/api/v1/psychologists/me/bundles/:bundleId`                  | Bearer | Yes |
| DELETE | `/api/v1/psychologists/me/bundles/:bundleId`                  | Bearer | Yes |
| GET    | `/api/v1/psychologists`                                       | Public | Yes |
| GET    | `/api/v1/psychologists/:psychologistId`                       | Public | Yes |
| GET    | `/api/v1/psychologists/:psychologistId/sessions`              | Public | Yes |

## Bookings

| Method | Path                                     | Auth   | MVP |
| ------ | ---------------------------------------- | ------ | --- |
| POST   | `/api/v1/bookings`                       | Bearer | Yes |
| GET    | `/api/v1/bookings`                       | Bearer | Yes |
| GET    | `/api/v1/bookings/:bookingId`            | Bearer | Yes |
| POST   | `/api/v1/bookings/:bookingId/confirm`    | Bearer | Yes |
| POST   | `/api/v1/bookings/:bookingId/reschedule` | Bearer | Yes |

## Payments

| Method | Path                               | Auth   | MVP |
| ------ | ---------------------------------- | ------ | --- |
| POST   | `/api/v1/payments/pakasir/webhook` | Public | Yes |

## Routine

| Method | Path                                          | Auth   | MVP |
| ------ | --------------------------------------------- | ------ | --- |
| POST   | `/api/v1/routine/checkin`                     | Bearer | Yes |
| POST   | `/api/v1/routine/relapses`                    | Bearer | Yes |
| GET    | `/api/v1/routine/statistics`                  | Bearer | Yes |
| GET    | `/api/v1/routine/statistics/activity-summary` | Bearer | Yes |
| GET    | `/api/v1/routine/relapses`                    | Bearer | Yes |
| GET    | `/api/v1/routine/relapses/statistics`         | Bearer | Yes |

## Content

| Method | Path                                                    | Auth   | MVP |
| ------ | ------------------------------------------------------- | ------ | --- |
| GET    | `/api/v1/journals`                                      | Bearer | Yes |
| POST   | `/api/v1/journals`                                      | Bearer | Yes |
| GET    | `/api/v1/community`                                     | Bearer | Yes |
| POST   | `/api/v1/community`                                     | Bearer | Yes |
| GET    | `/api/v1/community/:postId/comments`                    | Bearer | Yes |
| POST   | `/api/v1/community/:postId/comments`                    | Bearer | Yes |
| POST   | `/api/v1/community/:postId/comments/:commentId/replies` | Bearer | Yes |
| POST   | `/api/v1/community/:postId/like`                        | Bearer | Yes |
| GET    | `/api/v1/education`                                     | Bearer | Yes |
| GET    | `/api/v1/content/daily`                                 | Bearer | Yes |
| GET    | `/api/v1/achievements/catalog`                          | Bearer | Yes |
| GET    | `/api/v1/achievements/progress`                         | Bearer | Yes |
| GET    | `/api/v1/achievements/unlocked`                         | Bearer | Yes |

## AI

| Method | Path                                 | Auth   | MVP |
| ------ | ------------------------------------ | ------ | --- |
| POST   | `/api/v1/ai/ask-coach`               | Bearer | Yes |
| POST   | `/api/v1/ai/relapse-solution`        | Bearer | Yes |
| POST   | `/api/v1/ai/relapse-prevention-plan` | Bearer | Yes |
| GET    | `/api/v1/ai/chat-history`            | Bearer | Yes |
| GET    | `/api/v1/ai/summary`                 | Bearer | Yes |
| POST   | `/api/v1/ai/onboarding-analysis`     | Bearer | Yes |
| GET    | `/api/v1/ai/persona-preferences`     | Bearer | Yes |
| PUT    | `/api/v1/ai/persona-preferences`     | Bearer | Yes |

## Notes

- Public routes are intentionally limited to health, validation demo, psychologist directory, and payment webhook.
- Admin UI/API routes are not part of MVP.
- Paid cancellation routes are not present in MVP.

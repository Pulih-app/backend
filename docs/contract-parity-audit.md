# Contract Parity Audit

Audit scope: compare Pulih route surface and contract posture against `references/recova-api` before any behavior changes.

## Canonical Baseline

Pulih canonical contract is:

1. `TECHNICAL_SPEC.md` API envelope and English response language rules.
2. `docs/generated/openapi.yaml` for runtime path + schema source.
3. `docs/api-routes.md` and `src/routes/api-route-inventory.ts` for route inventory.

Reference backend is used only to detect drift and keep parity where Pulih still shares the same recovery modules.

## Cluster Matrix

| Cluster                          | Reference surface                                                                                                                                                                                                           | Pulih surface                                                                                                                                                    | Drift class                                                                                        | Canonical decision                                                                                                       |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Auth / user                      | `/api/v1/auth/google`, `/api/v1/auth/refresh`, `/api/v1/auth/register`, `/api/v1/auth/login`, `/api/v1/auth/logout`, `/api/v1/auth/onboarding`, `/api/v1/users/me`, `/api/v1/users/settings`, `/api/v1/users/me/reset-data` | `/api/v1/auth/register`, `/api/v1/auth/login`, `/api/v1/auth/logout`, `/api/v1/auth/me`, `/api/v1/auth/onboarding`, `/api/v1/users/me`, `/api/v1/users/settings` | Path + auth model drift                                                                            | Keep Pulih custom JWT, access-token-only auth, English envelope, no Google/refresh/reset-data in MVP.                    |
| Recovery / content               | `/api/v1/routine/*`, `/api/v1/journals`, `/api/v1/community*`, `/api/v1/education`, `/api/v1/content/daily`, `/api/v1/achievements/*`, plus threaded replies in `/api/v1/community/{post_id}/comments/{comment_id}/replies` | `/api/v1/routine/*`, `/api/v1/journals`, `/api/v1/community*`, `/api/v1/education`, `/api/v1/content/daily`, `/api/v1/achievements/*`                            | Path drift on threaded replies; payload/status parity still needs cluster-by-cluster normalization | Keep current Pulih flatter community contract, omit threaded replies from MVP, preserve English response/error envelope. |
| AI                               | `/api/v1/ai/ask-coach`, `/api/v1/ai/relapse-solution`, `/api/v1/ai/relapse-prevention-plan`, `/api/v1/ai/chat-history`, `/api/v1/ai/summary`, `/api/v1/ai/onboarding-analysis`, `/api/v1/ai/persona-preferences`            | Same cluster, same public paths in Pulih                                                                                                                         | Payload/status drift only                                                                          | Keep Pulih non-streaming AI contract, safety guards, English envelope, and current endpoint set as canonical.            |
| Psychologist / booking / payment | No reference baseline in `recova-api`                                                                                                                                                                                       | `/api/v1/psychologists*`, `/api/v1/bookings*`, `/api/v1/payments/pakasir/webhook`                                                                                | New cluster                                                                                        | Pulih spec is canonical; reference does not define these contracts.                                                      |
| Docs / inventory                 | Reference route docs include legacy routes not in MVP                                                                                                                                                                       | `docs/api-routes.md`, `docs/generated/openapi.*`, runtime route inventory                                                                                        | Documentation drift                                                                                | Keep Pulih docs aligned to runtime and exclude non-MVP reference routes from canonical docs.                             |

## Request / Response Contract Decisions

| Area             | Canonical rule                                                                  |
| ---------------- | ------------------------------------------------------------------------------- |
| Success envelope | `{ success: true, message, data, meta }`                                        |
| Error envelope   | `{ success: false, message, data: null, error: { code, details, request_id } }` |
| Message language | English only in API responses                                                   |
| Error codes      | Stable uppercase English codes from `TECHNICAL_SPEC.md`                         |
| Pagination       | `meta.pagination` format from `TECHNICAL_SPEC.md`                               |
| Auth behavior    | Bearer token only for MVP; no refresh-token rotation                            |
| Public surface   | Health, docs, validation demo, psychologist directory, and payment webhook only |

## Reference-Only Routes Intentionally Out of MVP

| Method   | Path                                                    | Reason                                                 |
| -------- | ------------------------------------------------------- | ------------------------------------------------------ |
| `POST`   | `/api/v1/auth/google`                                   | Google OAuth is out of MVP.                            |
| `POST`   | `/api/v1/auth/refresh`                                  | Refresh-token rotation is out of MVP.                  |
| `DELETE` | `/api/v1/users/me/reset-data`                           | Dev-only reset route is out of MVP.                    |
| `POST`   | `/api/v1/community/:postId/comments/:commentId/replies` | Threaded replies are not part of current MVP contract. |
| `GET`    | `/metrics`                                              | Not exposed in Pulih runtime route surface.            |

## Canonical Contract Decisions

- Pulih response language is English, even when reference text is Indonesian.
- Pulih route inventory is the source of truth for runtime docs.
- Reference routes outside MVP stay documented as excluded, not backfilled into Pulih.
- Any later payload/status work in phases 58-61 must preserve the envelope and error taxonomy above.

## Verification Notes

- Route inventory is reviewable in `docs/api-routes.md` and `src/routes/api-route-inventory.ts`.
- Canonical response envelope is covered by `tests/response.test.ts`.
- OpenAPI/runtime route sync is covered by `tests/openapi.test.ts`.

## Status

This audit is complete for current route/document surface. Remaining behavior parity work is deferred to later cluster phases.

# Security Audit Notes

Checklist for demo readiness.

## Secrets and config

- `.env` is ignored in `.gitignore`.
- `.env.example` uses placeholder values only.
- API keys and secrets are loaded from env / Worker secrets, not hardcoded in runtime code.

## Logging review

Checked runtime code for sensitive logging:

- no password/token/JWT/API key logging in auth, payment, notification, or booking flows;
- startup log only prints local port;
- error handler returns safe envelopes without raw stack traces.

## Sensitive data handling

Reviewed for accidental leakage risk:

- auth tokens are returned only in response payloads;
- payment webhook validation does not print raw payloads;
- booking and psychologist flows avoid logging meet links, credential file content, or passwords.

## Manual verification

- secret grep: no real secrets committed in tracked source;
- `.env` remains local-only;
- worker secrets remain the source for production API keys.

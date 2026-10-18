# Security

ParcelProof handles sellers' business records and their customers' messages and voice notes. This document describes how that data is protected and how to report a problem.

## Reporting a vulnerability

Please **do not open a public issue**. Email **anshvarshney1502@gmail.com** with steps to reproduce. You'll get an acknowledgement within 72 hours.

## Audit checklist (October 2026)

### Identity and access
- [x] Google OAuth via Auth.js v5; sessions stored server-side in MongoDB, `HttpOnly`, `Secure`, `SameSite=Lax`.
- [x] Every API route calls `requireUserId()`; the only exception is the Auth.js handler itself.
- [x] All reads and writes are scoped `{ _id, ownerId }`. Another user's record is indistinguishable from a missing one (404).
- [x] IDs are validated against a strict pattern before reaching the database; search input is regex-escaped.
- [x] Mutating routes reject foreign `Origin` headers (CSRF defence in depth).
- [x] Sign-in redirects only to in-app paths.

### Uploads and files
- [x] Size cap enforced while streaming the request body (protects against chunked uploads with no `Content-Length`).
- [x] Type detected from magic bytes; the extension must match the content.
- [x] Text must be valid UTF-8; CSV cells starting with `= + - @` are neutralised.
- [x] SHA-256 duplicate detection; per-case, per-user storage and daily upload limits.
- [x] OCR and PDF processing are bounded (page limits, 60 s OCR timeout).
- [x] Files are served only through owner-checked routes with `nosniff`, `no-store` and a sandbox CSP (PDFs excepted for the browser viewer). No public or permanent URLs.

### Browser hardening
- [x] Content-Security-Policy: `default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'self'`, `form-action 'self' https://accounts.google.com`, `upgrade-insecure-requests`.
- [x] HSTS (2 years), `Cross-Origin-Opener-Policy: same-origin`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`.
- [x] `Permissions-Policy`: camera and geolocation off; microphone limited to this site (for voice notes).
- [x] `X-Powered-By` removed. React escapes all rendered content; there is no `dangerouslySetInnerHTML`.

### AI and voice
- [x] Uploaded content is fenced as untrusted data in prompts.
- [x] Model output is schema-validated (Zod); every quotation is verified against stored text.
- [x] Accusatory language forces findings to *unverified* and blocks briefing scripts.
- [x] Briefing scripts are rejected if they contain numbers absent from confirmed findings.
- [x] Only the configured Gemma model is used — no silent fallback to another model.
- [x] Server-side daily quotas for analysis, speech and transcription; quota is refunded when a provider fails before doing work.

### Secrets and operations
- [x] Provider keys are server-only environment variables; none use `NEXT_PUBLIC_`.
- [x] Logs record error messages only — never evidence text, tokens or connection strings.
- [x] API errors return safe messages and codes, never stack traces.
- [x] `npm audit --omit=dev`: 0 vulnerabilities.

### Data lifecycle
- [x] Deleting a case removes its evidence, GridFS files, analyses, briefings and audio.
- [x] Account deletion removes all user-owned records plus the Auth.js user, accounts and sessions.

## Known residual risks

- Inference and voice run on third-party hosted APIs; their retention policies apply.
- Tesseract downloads its English language model from a public CDN at runtime.
- `script-src` allows `'unsafe-inline'`, which Next.js needs for hydration; there is no user-controlled HTML on the page.

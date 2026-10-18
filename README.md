# ParcelProof

*Every claim needs evidence. Every piece of evidence needs context.*

ParcelProof is an evidence-first workspace for independent online sellers preparing delivery disputes, damaged-parcel claims, missing-item complaints and return mismatches. A seller collects the invoice, tracking record, customer messages and photos into a case. ParcelProof extracts their text, runs a Gemma-based analysis orchestrated by Mastra, **verifies every quotation against the original files**, lets the seller confirm, correct or dismiss each finding, reads a spoken briefing via ElevenLabs, and exports a reviewed PDF report.

It does not decide who is lying, detect fraud, give legal advice or guarantee refunds.

---

## What works, and what was verified

| Area | Status |
|---|---|
| Google sign-in (Auth.js v5 + MongoDB adapter, database sessions) | Implemented. Session lookup, route protection and ownership checks verified locally. The Google OAuth round-trip itself needs your OAuth credentials and was **not** exercised. |
| Cases: create, edit, archive, restore, resolve, reopen, delete, search, filter, sort | Implemented and verified (tests + browser). |
| Evidence upload → GridFS, SHA-256 dedupe, magic-byte checks, limits | Implemented and verified (tests + browser). |
| Text / CSV / PDF extraction, OCR for images and scanned PDF pages | Implemented. Text, CSV, PDF text and OCR-failure paths covered by tests. |
| Seller text correction, retry, inspect original | Implemented. |
| Mastra workflow → Gemma → schema validation → quotation grounding → persistence | Implemented and verified end-to-end **with a test double for the model**. A live call to `gemma-4-26b-a4b-it` needs `GEMMA_API_KEY` and was **not** exercised. |
| Review UI, timeline, contradictions, gaps, validation log, analysis versioning, stale detection | Implemented and verified in the browser. |
| ElevenLabs briefing (English / Hinglish), caching, daily limit, GridFS audio, custom player | Implemented; cache, limits and failure handling covered by tests with a TTS test double. A live ElevenLabs call needs your key and voice ID and was **not** exercised. |
| PDF report (PDFKit) from saved reviewed data, editable draft response | Implemented and verified (downloaded and inspected). |
| Settings, usage meters, full account-data deletion | Implemented; deletion covered by a test. |

Missing configuration never produces fake output: analysis returns `503` with the variable to set, voice generation keeps the text briefing and says ElevenLabs is not configured, and sign-in shows a setup notice.

---

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript strict · Tailwind CSS 4 · Auth.js v5 · MongoDB Node driver + GridFS · `@google/genai` (Gemma) · `@mastra/core` workflows · `@elevenlabs/elevenlabs-js` · Tesseract.js · PDF.js + `@napi-rs/canvas` · PDFKit · Zod · React Hook Form · Framer Motion · React Three Fiber · Vitest + mongodb-memory-server.

## Local setup

```bash
npm install
cp .env.example .env.local   # then fill in values
npm run dev
```

Checks:

```bash
npm run typecheck
npm run lint
npm test          # 42 tests; downloads a MongoDB binary on first run
npm run build
```

### Environment variables

See `.env.example`. Everything is server-only; nothing uses `NEXT_PUBLIC_`.

| Variable | Purpose |
|---|---|
| `AUTH_SECRET` | Session encryption. `npx auth secret` generates one. |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Google OAuth client. |
| `AUTH_TRUST_HOST=true` | Needed behind Render's proxy. |
| `MONGODB_URI`, `MONGODB_DB_NAME` | Atlas connection. |
| `GEMMA_API_KEY`, `GEMMA_MODEL_ID` | Gemini API key and Gemma model (default `gemma-4-26b-a4b-it`). The app refuses non-`gemma-` model IDs. |
| `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `ELEVENLABS_MODEL_ID` | Voice. `ELEVENLABS_VOICE_ID` is the English/default voice; use a voice in *your* ElevenLabs library. |
| `ELEVENLABS_VOICE_ID_HINGLISH` | Optional separate voice for Hinglish briefings. |
| `MAX_UPLOAD_MB`, `MAX_EVIDENCE_PER_CASE`, `MAX_USER_STORAGE_MB` | Upload limits (10 / 10 / 100 by default). |
| `AI_DAILY_LIMIT`, `TTS_DAILY_LIMIT` | Per-user daily limits (8 / 3). |
| `AI_MAX_INPUT_CHARS` | Max evidence characters sent per analysis (60 000). |

### Google OAuth

1. Google Cloud Console → APIs & Services → Credentials → *Create OAuth client ID* → Web application.
2. Authorised redirect URIs: `http://localhost:3000/api/auth/callback/google` and `https://<your-render-host>/api/auth/callback/google`.
3. Put the client ID and secret in `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`.

### MongoDB Atlas

1. Create a free M0 cluster and a database user.
2. Network access: allow Render's outbound IPs (or `0.0.0.0/0` with a strong password).
3. Copy the `mongodb+srv://` string into `MONGODB_URI`. Collections and indexes are created on first use.

Free clusters have 512 MB of storage; the default 100 MB per-user evidence cap is sized for a handful of users. Lower `MAX_USER_STORAGE_MB` if you expect more.

### Gemma via the Gemini API

1. Create a key at Google AI Studio and set `GEMMA_API_KEY`.
2. Confirm `gemma-4-26b-a4b-it` is listed for your key (AI Studio model list). If Google renames it, set `GEMMA_MODEL_ID` — the app will show the provider's real error rather than switching to a Gemini model.

### ElevenLabs

Set `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` (Voices → your voice → *ID*). `eleven_multilingual_v2` handles Hinglish in Roman script. Each generation uses characters from your plan; identical transcripts reuse saved audio.

## Deploying to Render

`render.yaml` defines a free Node web service:

- Build: `npm ci && npm run build`
- Start: `npm start`
- Fill the `sync: false` variables in the dashboard, and add the Render URL as an OAuth redirect URI.

All persistent data (files, audio, cases) lives in MongoDB/GridFS; nothing depends on Render's filesystem. Temporary data (OCR language files in the OS temp dir) is re-downloaded after a restart. Free instances sleep when idle — the first request after a cold start can take 30–60 s.

Analysis runs inside the request (no paid background worker). It is bounded by `AI_MAX_INPUT_CHARS`, a 2-minute model timeout and one retry; a run left "running" by a restart is marked failed after 10 minutes and can be retried.

## How it works

### Evidence grounding

Each upload gets a stable source ID (`S1`, `S2`, … never reused). Extracted text is stored per page. The model must cite `sourceId`, optional page and a verbatim quotation. `src/lib/ai/grounding.ts` then:

1. Resolves the source ID against **this case's** evidence only (others are rejected as unknown).
2. Finds the quotation after collapsing whitespace and normalising typographic quotes/dashes — no case folding or fuzzy matching.
3. Records the real page and character offsets; a wrong page is corrected with a visible warning.
4. Downgrades "supported" with no verified quote, and "conflicting" without both sides verified, to **unverified**, with a note.
5. Flags accusatory language (fraud, lying…) and downgrades it.
6. Drops events with no verified quotation; downgrades "exact" dates whose text isn't in the quotation to "approximate". Undated events are listed separately, never placed at a guessed time.

Rejected references are kept in a validation log on the analysis.

### Mastra workflow (`src/lib/ai/workflow.ts`)

`verify-case → load-evidence → build-chunks → extract-events (Gemma) → ground-events → compare-evidence (Gemma) → ground-findings-and-persist`

Each step has typed inputs/outputs and records its status on the analysis document, which the UI shows when a run fails. Only the server-generated analysis ID enters the workflow; ownership and sources are reloaded from the database. Model calls get one corrective retry for malformed JSON and one back-off retry for transient errors — never more. A failed run never replaces the previous successful analysis.

**Changing the model:** `ModelClient` in `src/lib/ai/gemma.ts` is a one-method interface (`generate(prompt) → text`). Swap the implementation; the workflow, validation and UI don't change.

**Hosted vs. local:** Gemma inference runs on Google's hosted API, voice on ElevenLabs. Extraction, OCR, grounding, PDF generation and orchestration run on the ParcelProof server.

### Analysis versioning

Each run stores the model ID, a hash of every evidence file and its extracted text, and a hash of the case details. If the current input hash differs, the analysis is shown as **out of date**. Re-running with unchanged input returns the saved analysis without calling the model.

### Voice cache

Cache key = hash(owner, transcript hash, voice ID, model ID, language, voice settings). A matching ready briefing is reused; any change produces a new one. The transcript is built deterministically from confirmed/corrected findings only — no extra model call.

## Security notes

- Every route resolves the user server-side and queries with `{ _id, ownerId }`; another user's records return `404`.
- Mutations reject cross-origin `Origin` headers on top of `SameSite=Lax` cookies.
- Uploads: size checked before buffering, magic bytes must match the extension, UTF-8 enforced for text, CSV formula prefixes neutralised, executables rejected, filenames sanitised.
- Files are streamed only through authenticated routes with `nosniff`, `no-store` and a sandbox CSP (PDFs excepted so the browser viewer works).
- Evidence is fenced as data in prompts and the policy tells the model to ignore embedded instructions; grounding means injected text can't create findings without matching real quotations.
- Errors never include stack traces; secrets are never logged.

## Known limitations

- The PDF uses built-in PDF fonts (WinAnsi), so non-Latin scripts (e.g. Devanagari) in quotations will not render correctly in the PDF; the web UI is unaffected.
- OCR is English-only (`eng`), capped at 8 scanned pages per PDF and 60 s per page; PDFs are capped at 50 pages.
- Gemma's free tier has low rate limits; heavy cases may hit `429`, which is shown as-is.
- The audio route returns the full file (no HTTP range requests); briefings are small, so seeking works after load.
- Hinglish briefings use fixed sentence templates around your reviewed findings rather than free generation — a deliberate choice to avoid narrating unverified content.

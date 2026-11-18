# UJ AI v3.2.11 — Render deployment

## GitHub repository layout
Upload the CONTENTS of this folder to the repository root (not the enclosing `ujai_work` folder and not only a ZIP archive). The root must contain `Dockerfile`, `package.json`, `server.js`, and `public/`.

## Render service settings
- Runtime: Docker
- Root Directory: leave blank
- Dockerfile Path: `./Dockerfile`
- Docker Build Context Directory: `.`
- Branch: `main`

## Environment variables
Set at least one AI provider key in Render → Environment:
- `GEMINI_API_KEY` (recommended)
- or `OPENAI_API_KEY`
- or all of `META_API_KEY`, `META_BASE_URL`, and `META_MODEL`

Also set `NODE_ENV=production` and `PUBLIC_ORIGIN=https://YOUR-SERVICE.onrender.com`. Set `WEBAUTHN_RP_ID` to the hostname only (for example `your-service.onrender.com`) if passkeys are used.

Optional: `HEYGEN_API_KEY` and `HEYGEN_VOICE_ID` for HeyGen speech. Keep all API keys in Render environment settings; never commit them.

## Storage note
The Render Free web service filesystem is ephemeral. SQLite user accounts and chat history can be lost when the instance restarts or redeploys. Persistent SQLite storage requires a supported persistent disk plan or moving the database to a managed database. Do not treat the free instance as durable storage.

## Verify after deployment
Open `https://YOUR-SERVICE.onrender.com/api/health`. Expected JSON includes `"app":"UJ AI"` and `"version":"3.2.11"`. `aiReady` becomes true only after a provider key is configured.

Automated local checks: `npm test` and `npm run check`.

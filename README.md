# UJ AI Cross-Platform — v3.0 Development Build

A responsive Hindi/Hinglish Progressive Web App for Android, iPhone and desktop browsers, backed by a private Node.js server.

## What is implemented in this build

- Responsive PWA shell with web manifest, install prompt, service worker and offline app-shell caching.
- Hindi/Hinglish chat interface with Personal AI, Nursing Study, Coding and Cybersecurity Study modes.
- Browser speech-to-text where the browser supports the Web Speech API, plus Hindi text-to-speech where available.
- Cybersecurity Study mode focused on defensive security, authorized labs, networking fundamentals and log interpretation, with explicit boundaries against unauthorized intrusion.
- Safe text/log/config/source-file attachment: selected text files up to 12 KB are read locally in the browser and added to the message for AI analysis; binary files are not scanned or uploaded as files.
- Email/password account registration and sign-in; passwords are salted and hashed with Node.js `scrypt`.
- Forgot-password reset requests with hashed, single-use, 30-minute default reset tokens, per-IP/email rate limiting, and configurable SMTP delivery. Reset responses do not disclose account existence or return reset tokens.
- Optional Google Sign-In using OpenID Connect Authorization Code Flow with PKCE, one-time browser-bound state, nonce and server-side ID-token verification. Google sign-in links to an existing account only when Google confirms the same email address.
- Opaque server-side sessions in HttpOnly, SameSite cookies, CSRF token checks, same-origin checks and basic rate limits.
- Account-owned chats and messages stored in SQLite; signing into the same account on another device loads the same chat history.
- Optional platform passkeys through WebAuthn for device biometrics/security keys, when the host is HTTPS and the server dependency is installed.
- Server-only AI provider keys and silent automatic fallback order: Gemini, OpenAI, then an optional OpenAI-compatible Meta-hosted endpoint.
- A Capacitor configuration file is included as a future native-packaging starting point.

## Requirements

- Node.js 22.13 or newer (uses the built-in `node:sqlite` module).
- A server/host with persistent disk storage for `data/ujai.sqlite`.
- HTTPS in production. HTTPS is required for reliable PWA installation, microphone access and WebAuthn/passkeys.

## Local run

1. Extract the ZIP.
2. Copy `.env.example` to `.env`. Its defaults set `NODE_ENV=development`, `PUBLIC_ORIGIN=http://localhost:3000`, and `WEBAUTHN_RP_ID=localhost`.
3. To enable Google sign-in locally, follow the Google Cloud setup below and set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`. Never put keys in `public/` files or source control.
4. Set at least one provider key in `.env` (Gemini or OpenAI). Never put keys in `public/` files or source control.
5. Install the declared dependencies and start the server:

   ```bash
   npm install
   npm start
   ```

6. Open `http://localhost:3000`. The app creates `data/ujai.sqlite` automatically.

If the WebAuthn package is not installed, email/password login and chat sync still work; passkey endpoints stay disabled and the UI hides the passkey controls.

## Forgot Password and SMTP setup

The sign-in screen includes a **Forgot password?** flow. The server always returns the same generic response for password-reset requests and never returns the reset token in an API response.

Configure SMTP in the server environment:

- `SMTP_HOST`: SMTP server hostname.
- `SMTP_PORT`: SMTP port, default `587`.
- `SMTP_SECURE`: set `true` for implicit TLS, usually on port `465`; otherwise leave false.
- `SMTP_USER` and `SMTP_PASS`: optional SMTP authentication credentials.
- `SMTP_FROM`: sender address accepted by the SMTP provider.
- `PASSWORD_RESET_TTL_MINUTES`: reset-link lifetime in minutes, capped to 5–180 minutes (default `30`).
- `PUBLIC_ORIGIN`: used to build the reset link. Set it to the exact public HTTPS origin in production.

Reset tokens are generated with `crypto.randomBytes`, stored only as SHA-256 hashes, expire automatically, become invalid after use, and invalidate existing sessions for that account after a successful password change. Until SMTP variables are configured, reset delivery stays disabled while the account-enumeration-safe API response remains the same.

## Google Sign-In setup

Google Sign-In is optional and is hidden until all required server settings are configured. It is **not live by default**: real Google OAuth credentials and a matching origin must be configured first. It requests only the `openid`, `email`, and `profile` scopes for authentication; it does not access a Gmail mailbox.

1. In [Google Cloud Console](https://console.cloud.google.com/), create/select a project and configure the OAuth consent screen, audience, and app details.
2. Create an OAuth client ID with application type **Web application**.
3. Under **Authorized JavaScript origins**, add the exact `PUBLIC_ORIGIN` value (scheme, hostname, and port, with no path).
4. Under **Authorized redirect URIs**, add the exact callback URL: `<PUBLIC_ORIGIN>/api/auth/google/callback`.
5. Copy the client ID and client secret to the server environment variables `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Do not paste the secret into chat, commit it, or put it in `public/` or browser JavaScript.
6. If the consent screen is in testing mode, add the Google accounts allowed to sign in as test users. Complete any Google verification/publication requirements before inviting other users.

The callback URL is derived from `PUBLIC_ORIGIN`; it must match the Google Cloud Console redirect URI exactly, including scheme, hostname, port, path, and trailing-slash behavior. The server validates Google-signed ID tokens and the stored nonce before creating a session. Existing email/password and passkey sign-in remain available.

### GitHub Codespaces

1. Start the Codespace, forward port `3000`, and open the forwarded app URL. Set `PUBLIC_ORIGIN` to that exact HTTPS origin, for example `https://<codespace-name>-3000.app.github.dev` (do not include a path or trailing slash).
2. In Google Cloud Console, register that origin under **Authorized JavaScript origins** and register `<PUBLIC_ORIGIN>/api/auth/google/callback` under **Authorized redirect URIs**. These entries must match the Codespaces URL exactly; update them if that URL changes.
3. In the repository's **Settings → Secrets and variables → Codespaces**, add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` as Codespaces secrets. Add `PUBLIC_ORIGIN` as a Codespaces variable. `GOOGLE_CLIENT_SECRET` must remain a secret; do not put it in `devcontainer.json`, source files, or terminal commands.
4. Restart the Codespace after creating or changing its secrets/variables so they are available to the server. Keep `NODE_ENV=development` (the server defaults to it) and configure any optional AI provider variables if you want chat replies. Start the app with `npm start`.
5. Confirm that the Google button appears on the sign-in screen. If the Codespaces URL changes or Google reports a redirect URI mismatch, update both Google Cloud entries and the `PUBLIC_ORIGIN` Codespaces variable, then restart.

Codespaces URLs are deployment-specific and are not a substitute for a stable production domain. Google consent-screen domain verification and testing-user restrictions may also apply.

## Production hosting

- Deploy the whole project to a Node.js 22.13+ host.
- Attach a persistent disk/volume and set `DB_PATH` to a path on that volume.
- Set `NODE_ENV=production`, `PUBLIC_ORIGIN=https://your-real-domain`, `WEBAUTHN_RP_ID=your-real-domain`, the Google OAuth client ID/secret if using Google sign-in, and the AI provider keys in the host's secret/environment settings.
- Use one server instance for the included SQLite database. For multi-instance horizontal scaling, replace SQLite with a shared database and add a shared rate-limit store before launch.
- Keep `.env` out of Git, public folders, ZIPs shared with others, and chat messages.
- Configure backups, privacy/retention policy, monitoring and an account-recovery process before inviting other users.

## AI provider fallback

The backend silently tries configured providers in `UJ_AI_PROVIDER_ORDER` (default `gemini,openai,meta`). The Meta option is a configurable OpenAI-compatible endpoint, not a claim that a Meta account has already been connected. Provider identity is not shown in the chat UI. Only the server reads provider keys.

## PWA and native packaging status

The PWA shell is implemented, but a public deployment has not been performed. The app is not an Android APK and is not an iOS App Store build. The included `capacitor.config.json` is a packaging scaffold only. To create native projects later, install Capacitor CLI/core and the Android/iOS platform packages, then run the Capacitor init/sync commands. Android signing/build needs Android SDK tooling; iOS packaging needs macOS and Xcode.

## Not yet complete / external dependencies

- No live cloud deployment or domain is included.
- No real AI provider can answer until a valid server-side key is configured on the host.
- Passkeys require the declared `@simplewebauthn/server` dependency to be installed and a correct HTTPS origin/RP ID.
- No native APK, IPA, Play Store or App Store build has been created.
- HeyGen, vidIQ and Metricool remain separate integration work; the earlier integrations ZIP is a starter scaffold and does not mean those services are authenticated or live.
- SQLite is suitable for a single persistent server instance. Multi-instance deployment needs a shared database and distributed rate limiting.

## Legacy files checked

- The earlier `UJ_AI_phone_preview.html` is only a local visual demo: its replies are canned, its PIN is stored in browser `localStorage`, and it does not authenticate an account or call a live AI backend. It must not be treated as the finished app or a secure lock.
- The earlier `UJ_AI_Integrations_v1_1.zip` is a separate integration starter. Its service cards/routes need real provider credentials, account authorization and endpoint-level verification; it does not mean HeyGen, vidIQ or Metricool are connected. Those integrations are intentionally not marked complete in this PWA build.

## Security notes

This is a development build, not a completed security audit. Use a strong unique password, HTTPS, persistent encrypted backups, a secure host, and a privacy policy. Browser PIN prompts/localStorage are deliberately not used as authentication. Platform biometrics are handled through WebAuthn passkeys when configured.

## App PIN lock
After signing in, choose **App PIN सेट करें** in the sidebar. Use a 6–12 digit PIN. The PIN is salted and hashed on the server; it is not stored in browser local storage. If enabled, the app asks for it after account sign-in. Five wrong attempts in one rate-limit window trigger sign-out after the app's retry sequence. This is an additional app lock, not a replacement for the account password.

## Cloud sync deployment note
Chat history is stored per account in the backend database. To sync across phones and computers, deploy one shared backend and keep its database on persistent shared storage (or migrate to a managed database). The development SQLite file on an individual device is not a cloud sync service by itself.

## Real AI provider setup
The server-side provider adapter is implemented. Configure at least one key in the hosting environment (`GEMINI_API_KEY` or `OPENAI_API_KEY`; optional Meta-compatible endpoint uses `META_API_KEY`, `META_BASE_URL`, and `META_MODEL`). Never put secrets in `public/`, frontend JavaScript, source control, or chat messages.


### Account email prefill
The sign-in/create-account screen currently pre-fills `ujjavalbaghel11@gmail.com` for convenience. The field remains editable. This does not create or verify an account; use **Create account** and choose a password yourself if this is a new account. Never share that password or API keys in chat.


### Voice assistant
The web client includes browser-native Hindi speech recognition, speech output, and a resilient hands-free turn-taking loop. Tap the microphone to dictate and review text before sending, or enable “बातचीत मोड” for listen → auto-send → spoken AI reply → listen again. The stop control ends both listening and speech. Interrupted speech promises are released, restart attempts use bounded backoff, and voice turns do not force the mobile keyboard open. This requires browser support, microphone permission, and HTTPS (localhost is allowed for development). On unsupported browsers, use the keyboard. Actual support and voice availability must be checked on each target device.


### Folax Mode
The app includes a Folax-inspired everyday assistant mode for Hindi/Hinglish conversations. It runs through UJ AI's configured server-side AI provider. This is not the official Infinix Folax service and does not invoke proprietary Folax APIs or device controls.


## Phone control shortcuts — 2026-11-17
- Added a UJ AI Phone Control panel with explicit launch buttons for YouTube, WhatsApp, Camera, Chrome, Android Settings, Wi-Fi settings, Bluetooth settings, and the phone dialer.
- Added Hindi/Hinglish voice/text intent matching for the supported “app kholo / settings kholo” commands.
- On Android, supported actions use Android intent URLs; on iOS, supported app URL schemes are attempted where known. If browser policy blocks an app launch, the user gets a retry button.
- Calling and SMS are not auto-placed/sent. The dialer is opened only; the user must review and confirm on the phone.
- Important limitation: a PWA cannot silently control arbitrary apps, read private app data, tap through other apps, or change all device settings. Full native device integration needs an Android APK/Capacitor native plugin and Android permission review. No APK, native Accessibility Service, or phone-side testing is claimed in this build.

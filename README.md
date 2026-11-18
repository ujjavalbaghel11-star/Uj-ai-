# UJ AI Cross-Platform — v3.2.12 Native Android Build Package

A responsive Hindi/Hinglish Progressive Web App for Android, iPhone and desktop browsers, backed by a private Node.js server.

## What is implemented in this build

- Responsive PWA shell with web manifest, install prompt, service worker and offline app-shell caching.
- Hindi/Hinglish chat interface with Personal AI, Nursing Study, Coding and Cybersecurity Study modes.
- Browser speech-to-text where the browser supports the Web Speech API, plus Hindi text-to-speech where available.
- Cybersecurity Study mode focused on defensive security, authorized labs, networking fundamentals and log interpretation, with explicit boundaries against unauthorized intrusion.
- Safe text/log/config/source-file attachment: selected text files up to 12 KB are read locally in the browser and added to the message for AI analysis; binary files are not scanned or uploaded as files.
- Email/password account registration and sign-in; passwords are salted and hashed with Node.js `scrypt`.
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
2. Copy `.env.example` to `.env`.
3. Set `NODE_ENV=development`, `PUBLIC_ORIGIN=http://localhost:3000`, and `WEBAUTHN_RP_ID=localhost` while developing locally.
4. Set at least one provider key in `.env` (Gemini or OpenAI). Never put keys in `public/` files or source control.
5. Install the declared dependency and start the server:

   ```bash
   npm install
   npm start
   ```

6. Open `http://localhost:3000`. The app creates `data/ujai.sqlite` automatically.

If the WebAuthn package is not installed, email/password login and chat sync still work; passkey endpoints stay disabled and the UI hides the passkey controls.

## Production hosting

- Deploy the whole project to a Node.js 22.13+ host.
- Attach a persistent disk/volume and set `DB_PATH` to a path on that volume.
- Set `NODE_ENV=production`, `PUBLIC_ORIGIN=https://your-real-domain`, `WEBAUTHN_RP_ID=your-real-domain`, and the AI provider keys in the host's secret/environment settings.
- Use one server instance for the included SQLite database. For multi-instance horizontal scaling, replace SQLite with a shared database and add a shared rate-limit store before launch.
- Keep `.env` out of Git, public folders, ZIPs shared with others, and chat messages.
- Configure backups, privacy/retention policy, monitoring and an account-recovery process before inviting other users.

## AI provider fallback

The backend silently tries configured providers in `UJ_AI_PROVIDER_ORDER` (default `gemini,openai,meta`). Gemini uses `GEMINI_MODEL` (default `gemini-2.5-flash`) and the Google Generative Language API. `GEMINI_API_BASE_URL` is an optional server-only override for a trusted compatible proxy or automated tests; normally leave it unset. The Meta option is a configurable OpenAI-compatible endpoint, not a claim that a Meta account has already been connected. Provider identity is not shown in the chat UI. Only the server reads provider keys.

## Native Android project (v3.2.12)

A native Android project now lives in `android/` and wraps the existing `public/` app with Capacitor. It includes:
- Native Android intent shortcuts for YouTube, WhatsApp, Camera, Chrome, Settings, Wi-Fi, Bluetooth and Dialer.
- A `UJNative` Capacitor plugin with device information and Android Assistant-role request methods.
- Android `VoiceInteractionService` and session-service declarations. When Android invokes UJ as its selected assistant, the current implementation opens the UJ AI app.
- A UI button that asks Android to show the system flow for selecting UJ AI as the default assistant (Android 10+ where the role is available).

### Build on a computer with Android Studio
1. Install Node.js 22+, Android Studio, Android SDK 35 and a compatible JDK (17 or newer).
2. In the project folder run `npm install`.
3. Run `npx cap sync android`.
4. Open the `android/` folder in Android Studio, let Gradle sync, then build `app` > `Build APK(s)`.
5. Install the APK on the Infinix phone. Open UJ AI and tap **UJ को Default Assistant बनाएं**; approve the Android system prompt if shown.

A GitHub Actions workflow is included at `.github/workflows/android-apk.yml`. After pushing the project to GitHub, run the **Build UJ AI Android APK** workflow from the Actions tab; download `UJ-AI-debug-APK` from the completed run artifacts.

### Native limitations still requiring device work
- This source project has not been compiled into an APK in this environment (Android SDK/Gradle build tools are not installed here).
- Android assistant role registration is implemented as a request flow, but OEM/OS approval and actual default-assistant behavior must be tested on the target Infinix model.
- The assistant session currently launches the UJ AI app; a full native voice interaction UI, speech capture, secure background wake-word engine, and lock-screen behavior are not implemented.
- There is no always-listening microphone service. Android foreground-service, microphone permission, battery policy and privacy requirements need explicit design and real-device testing.
- Native phone shortcuts only launch apps/settings; they do not silently change protected settings or send calls/messages.

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


## Northflank Developer Sandbox deployment (v3.2.7)

A Dockerfile is included for Northflank's combined-service deployment. Select the GitHub repository, choose Dockerfile build, expose public HTTP port 3000, and add runtime secrets in Northflank. See `NORTHFLANK_DEPLOY_HI.md` for the Hindi step-by-step guide. Northflank advertises an always-on Developer Sandbox with up to $20/month of free Northflank Cloud resources, but resource limits apply and its documentation says a payment method is required to create resources. Review the billing screen carefully and do not enable paid resources unintentionally.

The app uses SQLite at `DB_PATH`; attach persistent storage at `/app/data` before relying on account/chat history across redeployments. Confirm the volume's price and free allowance first. No live Northflank deployment is included or claimed.

## Cloud sync deployment note
Chat history is stored per account in the backend database. To sync across phones and computers, deploy one shared backend and keep its database on persistent shared storage (or migrate to a managed database). The development SQLite file on an individual device is not a cloud sync service by itself.

## Real AI provider setup
The server-side provider adapter is implemented and the Gemini request/fallback path is covered by local mock tests (not a live Google API test). Configure at least one key in the hosting environment (`GEMINI_API_KEY` or `OPENAI_API_KEY`; optional Meta-compatible endpoint uses `META_API_KEY`, `META_BASE_URL`, and `META_MODEL`). Never put secrets in `public/`, frontend JavaScript, source control, or chat messages.


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


## Version 3.1.0 — AI Theme Studio
This version adds the first Theme Studio implementation: preset themes, prompt-based visual theme selection, locally saved preferences, and user-uploaded backgrounds. Real AI image generation is not yet connected; it requires an image-generation API and server-side configuration. See `PROJECT_STATUS.md` for the exact status and remaining work.


## AI Theme Studio image generation
The Theme Studio can request an AI-generated background from the server. Set `OPENAI_API_KEY` in the hosting provider's secret/environment settings and optionally set `OPENAI_IMAGE_MODEL` (default `gpt-image-1`). The image button requires a signed-in account, uses server-side credentials, and is rate-limited. Without the key, preset themes and user-uploaded backgrounds continue to work, while AI image generation shows a setup message. Image generation usage may incur provider charges.

### Emotional Intelligence 2.0
UJ AI's shared system instructions guide every configured chat provider to respond empathetically, notice emotional cues as tentative, avoid judgment/manipulation, and respect privacy and boundaries. This is not a clinical emotion detector. Current voice input is speech-to-text only and does not analyze vocal tone.


### UJ voice preview
A button plays the approved Hindi female UJ sample generated with HeyGen. For live responses, the app prefers an installed feminine Hindi/Indian-English browser voice when available. The sample itself is a fixed preview, not a dynamic TTS engine; speaking every generated reply in that exact HeyGen voice requires a HeyGen API credential and server-side synthesis integration.


### Optional live UJ voice (HeyGen)
Set `HEYGEN_API_KEY` and `HEYGEN_VOICE_ID` in the server's private environment variables. Never place these values in frontend code or commit `.env`. When configured, UJ attempts HeyGen TTS for spoken replies and falls back to the device voice if the service is unavailable. The server endpoint is authenticated, CSRF-protected, rate-limited, and caps input at 5,000 characters. HeyGen API usage may incur charges. A separate HeyGen speech-generation test successfully produced a short Hindi audio clip with the configured voice. This verifies HeyGen-side speech generation only; the UJ AI server endpoint still requires the user’s own server-side API key and an end-to-end HTTPS test.


### UJ Smart Wake (foreground only)
Tap **🎙 UJ Wake** inside the signed-in app. UJ first checks the server health endpoint, then listens for “UJ” / “यूजे”. After detecting the wake phrase, hands-free voice conversation starts. Keep the app open with the screen on and allow microphone access. This feature depends on browser SpeechRecognition and HTTPS.

This is not an always-on background wake word service and does not yet make UJ the Android system-wide default assistant. That requires a native Android build and Android assistant/voice-interaction role integration, followed by testing on the target phone. A server wake request also works only if the selected host supports waking on inbound requests.

Current package version: **3.2.12**.


## Native Android build status (v3.2.12)
The Android project and GitHub Actions debug-APK workflow are included. Push the repository to GitHub and run the **Build UJ AI Android APK** workflow from the Actions tab. Download the `UJ-AI-debug-APK` artifact after a successful run. The workflow has not yet been run from this package, so an APK is not included.


## v3.2.12 update package
This ZIP is a complete project source package based on the inspected v3.2.10 native Android project. It increments the app/package version to 3.2.12 and includes the original chat background asset and retains the GitHub Actions workflow at `.github/workflows/android-apk.yml`. It is intended to be extracted and used to update the contents of the existing GitHub repository (do not upload only the ZIP if you want Actions to detect the workflow). No APK is bundled; GitHub Actions must compile it after the source files are pushed.

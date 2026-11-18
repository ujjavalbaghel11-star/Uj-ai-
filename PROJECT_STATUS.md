# UJ AI Cross-Platform — Development Status

Updated: 2026-11-18

## Implemented in this build
- Responsive PWA shell for Android/iPhone/desktop browsers.
- Hindi/Hinglish chat interface and Personal, Nursing Study, Coding, Cybersecurity modes.
- Account registration/login with server-side password hashing, HttpOnly session cookie, CSRF checks and rate limiting.
- Account-scoped SQLite chat history and refresh-based chat updates.
- Optional app PIN: 6–12 digit PIN is salted and hashed on the server; set/status/verify endpoints are protected by session + CSRF + rate limits. App asks for PIN after account authentication when enabled.
- Passkey/WebAuthn routes are present but depend on installing the declared package and configuring HTTPS/RP domain.
- Server-side AI provider adapter supports Gemini/OpenAI and optional OpenAI-compatible Meta endpoint; provider identities are not exposed to the client. Keys remain in server environment variables.
- Safe text/log/code file analysis flow and Cybersecurity study mode.

## Verification performed
- Node.js v22.16.0.
- `npm run check` — passed (server, frontend, service worker syntax).
- `npm test` — 3 tests passed, covering account authentication/history, provider persistence, and Google OAuth PKCE/browser-binding behavior.

## Not completed / blockers
- No live deployment or public HTTPS URL exists yet.
- Multi-device sync is implemented at the application/API level only when all devices use the same deployed backend and persistent shared database volume. A local SQLite file on one phone does not sync to other devices by itself. Production should use a persistent volume or managed database and backups.
- No real provider key has been configured; live AI calls are not verified. Configure keys only in the hosting provider's secret/environment settings, never in chat or frontend files.
- Passkey/biometric registration has not been verified on a real HTTPS hostname; dependency installation and RP/origin configuration remain.
- Android APK and iOS packaging/build have not been generated or tested.
- Android Capacitor project and GitHub Actions debug-APK build workflow are present. APK generation and target-device testing remain pending.

## Next precise step
Deploy this Node.js server to a host with HTTPS and persistent storage; set `PUBLIC_ORIGIN`, `WEBAUTHN_RP_ID`, `DB_PATH`, and at least one provider key in the host's secret settings. Then verify account login, PIN, passkey, AI response and chat history from two separate devices before packaging.


## Account email prefill update — 2026-11-17
- Added `ujjavalbaghel11@gmail.com` as the prefilled email in the sign-in/create-account form.
- The email field remains editable, so the account owner can change it if needed.
- No account was created and no sign-in was performed; the user must choose Create account and set their own password, or sign in if the account already exists.
- No password, API key, or other secret was added to the project.


## Voice assistant update — 2026-11-17

Implemented in the browser client:
- Hindi speech recognition via Web Speech API where supported.
- One-tap microphone dictation; recognized text is placed in the composer for user review before sending.
- Optional hands-free conversation mode: listen, submit recognized speech, speak the AI reply, then listen again.
- Hindi voice for Devanagari replies and Indian English preference for Latin-script Hinglish/English replies.
- Voice output toggle and stop-speaking control.
- Permission, unsupported-browser, insecure-context, and microphone error messaging.
- Stops active listening when the page is hidden or unloaded.

Verification: JavaScript syntax checks pass; smoke test includes presence of voice controls. Browser/device microphone permission, speech recognition availability, and actual spoken voice still require testing on the target Android/iPhone/desktop browsers over HTTPS. Web Speech API availability and voice quality depend on the browser and installed device voices; this is not a guaranteed offline or native voice engine.


## Voice conversation reliability update — 2026-11-17
- Hardened the listen → submit → spoken reply → listen-again loop.
- Speech output cancellation now resolves pending speech promises, preventing the hands-free loop from getting stuck when speech is stopped or interrupted.
- Stop control now ends both listening and speech and clears any scheduled restart.
- Added bounded retry backoff when no speech is detected, plus clearer network/microphone error messages.
- Voice-submitted messages no longer focus the text box, avoiding an unnecessary mobile keyboard popup during hands-free use.
- Bumped the PWA shell cache version so installed clients fetch the updated voice code.

Verification: `npm run check` and `npm test` pass (2/2 automated test suites). Actual microphone/TTS conversation still needs a live HTTPS deployment and testing on the user's device; browser speech APIs are not consistently supported across all browsers, especially iOS.


## Folax Mode addition (2026-11-17)
- Added a selectable `Folax Mode` in the cross-platform chat UI.
- Added a Hindi/Hinglish everyday-assistant system profile and server-side mode validation.
- This is a Folax-inspired assistant mode using whichever UJ AI provider is configured; it is NOT a direct integration with Infinix's proprietary Folax service. No official Folax API credentials or public integration endpoint were available/configured.
- Added smoke-test coverage for Folax mode creation and UI presence.


## Phone control shortcuts — 2026-11-17
- Added a UJ AI Phone Control panel with explicit launch buttons for YouTube, WhatsApp, Camera, Chrome, Android Settings, Wi-Fi settings, Bluetooth settings, and the phone dialer.
- Added Hindi/Hinglish voice/text intent matching for the supported “app kholo / settings kholo” commands.
- On Android, supported actions use Android intent URLs; on iOS, supported app URL schemes are attempted where known. If browser policy blocks an app launch, the user gets a retry button.
- Calling and SMS are not auto-placed/sent. The dialer is opened only; the user must review and confirm on the phone.
- Important limitation: a PWA cannot silently control arbitrary apps, read private app data, tap through other apps, or change all device settings. Full native device integration needs an Android APK/Capacitor native plugin and Android permission review. No APK, native Accessibility Service, or phone-side testing is claimed in this build.

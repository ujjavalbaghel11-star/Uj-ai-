# UJ AI Phone Control — Build 3.6

## Implemented in this build
- Added a responsive Phone Control panel to the signed-in UJ AI app.
- Added launch shortcuts for YouTube, WhatsApp, Camera, Chrome, Android Settings, Wi-Fi settings, Bluetooth settings, and Phone dialer.
- Added Hindi/Hinglish voice/text phrase detection for supported app/settings launch commands.
- Added Android Intent URL launch attempts and known iOS URL-scheme attempts.
- Added an on-screen retry button when the browser does not launch the target app.
- Calls are not placed and SMS/WhatsApp messages are not sent automatically. The phone's own UI remains responsible for user confirmation.
- Updated the service-worker cache version so the new controls are fetched after reload/update.

## Verification performed here
- `node --check server.js` — PASS
- `node --check public/app.js` — PASS
- `node --check public/sw.js` — PASS
- `npm test` — PASS (2/2 test suites)
- Smoke test now checks the Phone Control UI, a launch action, and Android intent command strings.

## Not completed / blockers
- No Android APK was built; this workspace does not contain a configured Android SDK/Gradle project.
- No native Android Accessibility Service or Capacitor plugin was added.
- No real Android or iPhone device test was possible in this environment.
- Browser/PWA app launching depends on Android browser support, installed target apps, and OS prompts. iOS custom URL schemes are restricted and may not work for every target.
- A PWA cannot silently control arbitrary apps, inspect their private data, press buttons inside them, or change all device settings. Those capabilities require native Android code, explicit permissions, platform policy review, and user confirmation.
- Live hosting/HTTPS and real AI provider credentials remain separate deployment requirements.

## Safe-use design
- Launch-only actions are supported.
- Dialer opens the phone dialer; it does not initiate a call.
- No automatic message sending, contact scraping, call recording, notification reading, or background surveillance is implemented.

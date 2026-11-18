# UJ AI Smart Wake — Build 3.2.8

## Implemented
- Added an in-app `UJ Wake` control.
- On a user tap, the client requests `/api/health` to wake an inbound-request-driven host where supported.
- After the server responds, the app asks the browser speech-recognition engine to listen for a spoken UJ wake phrase while the app is foregrounded.
- On recognizing UJ / यूजे / यूज, it switches into hands-free voice conversation and responds with a short acknowledgement.
- The wake listener is stopped when the user stops voice mode, the page is hidden, or the page unloads.
- Updated service-worker cache version and server health version.

## Important limits
- This is foreground, in-app wake detection only. It is not an always-listening Android system assistant.
- The browser must support SpeechRecognition, the site must be HTTPS, microphone permission must be granted, and the app must remain open with the screen active.
- Android may suspend browser microphone access when the app is backgrounded or the screen locks.
- A server health request can wake a host only if that host supports waking on inbound requests. It cannot resume a manually suspended or terminated service.
- Setting UJ as Android's system-wide default digital assistant is not implemented in this PWA build. That requires a native Android application with the appropriate assistant/voice-interaction integration and Android OS role/permission handling, followed by a real-device test.

## Verification
- `npm run check`
- `npm test`
- These are local code tests only; no live host, microphone, Android role, or device test is implied.

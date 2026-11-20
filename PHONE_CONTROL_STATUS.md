# UJ AI Phone Control — v3.2.14

## Implemented in source
- Visible Phone Control panel in the UJ AI app.
- Android native shortcuts for YouTube, WhatsApp, Camera, Chrome, Android Settings, Wi-Fi settings, Bluetooth settings, Phone dialer, Messages, SMS composer, Contacts, Maps, Clock, Set Alarm, Calendar, and Email.
- Hindi/Hinglish voice/text phrase detection for supported app/settings launch commands.
- Default Android Assistant role request on Android 10+ where the OS exposes the role.
- Android intents open the relevant app or compose/entry screen. The user remains responsible for reviewing and confirming calls, messages, alarms, and calendar entries.

## Verification in this workspace
- `node --check server.js` — PASS
- `node --check public/app.js` — PASS
- `node --check public/sw.js` — PASS
- `npm test` — PASS (8/8 tests)
- Tests verify source declarations, UI shortcuts, local mock API flows and app-shell behavior. They do not prove that each intent resolves on a particular phone.

## Not implemented / not verified
- No Android APK build or installation was performed in this workspace.
- No real Android device test was possible here.
- No always-listening custom wake word or lock-screen background listening is implemented.
- The native system assistant panel currently opens the full UJ AI app; it is not yet a full interactive in-session chat/voice panel.
- No unrestricted control of arbitrary apps, automatic call/message sending, reading private app data, notification scraping, call recording, or accessibility-based button automation is implemented.
- Some shortcuts depend on compatible apps being installed and Android/phone-maker behavior.

## Safety and platform constraints
- UJ AI uses explicit Android intents and user-visible OS screens.
- It does not silently send SMS/WhatsApp messages, place calls, or create calendar events.
- More advanced actions require separate native implementation, clear user consent, Android permissions, Play policy review, and real-device testing.

# UJ AI Native Android Foundation — v3.2.18

## Implemented in this project
- Capacitor Android application source (`android/`) using package `com.ujai.app`.
- Native bridge plugin `UJNative`: device information, Android Assistant role request, and supported app/settings shortcuts including messaging, contacts, maps, alarms, calendar and email.
- Android `VoiceInteractionService` and `VoiceInteractionSessionService` declarations.
- A visible native assistant panel with a button to open the full UJ AI app.
- GitHub Actions workflow to build and upload a debug APK artifact after the project is pushed to GitHub.

## Local validation performed
- `npm test`: 5/5 tests passed. These are local automated project tests, not an Android device test.
- `npm run check`: JavaScript syntax checks passed.
- Android APK compilation was not run here: Gradle and Android SDK are not installed in this environment.

## Remaining work
- Run the GitHub Actions Android build or build with Android Studio; download the resulting debug APK artifact.
- Install and test on the actual Infinix device.
- Confirm UJ AI appears under Android Settings > Apps > Default apps > Digital assistant app, then select it if offered. Device makers can restrict this.
- The native assistant panel currently opens the full UJ AI app; it is not yet a full in-session chat interface.
- This project does not implement an always-listening custom wake word. Lock-screen/background wake-word support needs a separate user-visible microphone foreground service and real-device validation, and may be restricted by Android/phone battery policies.


## v3.2.18 status
- GitHub Actions debug APK workflow is included and configured for manual dispatch or relevant source pushes.
- This workspace has no Android SDK/Gradle installation, so no APK has been compiled or device-tested here.
- Background wake-word listening is not implemented. UJ Wake remains foreground-only; a future native microphone foreground service would require an explicit start/stop control, persistent OS notification, microphone permissions and device validation.

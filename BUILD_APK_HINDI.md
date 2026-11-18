# UJ AI v3.2.12 — APK build guide

1. Upload/extract every item in this ZIP into the root of the GitHub repository `Uj-ai-` (the folder containing `package.json`). Include the hidden `.github` folder.
2. Commit the files to the `main` branch.
3. Open GitHub → Actions → `Build UJ AI Android APK` → `Run workflow` if the workflow did not start automatically.
4. Wait for the workflow to finish. It runs `npm run check`, `npm test`, syncs Capacitor and builds the debug APK.
5. Open the completed workflow run → Artifacts → download `UJ-AI-debug-APK`.
6. Extract the downloaded artifact ZIP and install `app-debug.apk` on the Android phone.

Important: this source ZIP is not itself an APK. A successful GitHub Actions run is still required to create the APK. The first installation may show Android's normal install confirmation. Real AI services also require server-side API credentials configured on the hosting service; do not put API keys in this ZIP or the Android app.

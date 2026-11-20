# UJ AI v3.2.19 — GitHub par update karke APK banayein

## ZIP upload karne ka sahi tareeka

1. Is ZIP ko phone me extract karein.
2. Extracted project ke andar ki sabhi files aur folders select karein. `.github` hidden folder bhi zaroor include karein.
3. GitHub par apna `Uj-ai-` repository kholein aur `main` branch select karein.
4. `Add file` → `Upload files` par tap karein.
5. Extracted project ki files/folders upload karein. ZIP file ko ZIP ke roop me upload na karein.
6. Upload page ke neeche commit message likhein: `Update UJ AI to v3.2.19 and build Android APK`.
7. `Commit changes` dabayein.
8. Repository ke `Actions` tab me `Build UJ AI Android APK` workflow kholein. Push se workflow automatic shuru ho sakta hai; nahi hua to `Run workflow` dabayein.
9. Build successful hone par run kholein → `Artifacts` → `UJ-AI-debug-APK` download karein.
10. Artifact ZIP extract karke `app-debug.apk` install karein.

## Dhyan dein

- GitHub repository me project ki files root par honi chahiye, yani `package.json`, `server.js`, `android/`, `public/` aur `.github/` seedhe repository root me dikhne chahiye.
- Is source package me pehle se APK nahi hai. APK GitHub Actions build ke baad banta hai.
- Workflow dependencies ke liye `npm install` chalata hai; package-lock file is package me nahi hai.
- AI provider/API keys ko source code ya GitHub commit me na daalein. Unhe hosting service ke environment secrets me rakhein.

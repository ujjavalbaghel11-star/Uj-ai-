# UJ AI v3.2.24 — Cross-Platform Native API Patch

यह **patch package** है, पूरा replacement source ZIP नहीं। इसे repository के root में extract करें। यह current `main` source के लिए बनाया गया है (verified base commit: `097a40128f1c9c5d47c17a01d9dcee6f57395af9`).

## Apply करने के चरण

```bash
# repository root में नई branch बनाएँ
git checkout -b fix/cross-platform-api-v3-2-24

# ZIP की files repository root में extract करें
unzip -o UJ-AI-v3.2.24-Cross-Platform-Patch.zip -d .

# existing source files पर patch लागू करें
node scripts/apply-native-api-patch.mjs

# dependency lock और tests verify करें
npm ci
npm run check
npm test

git status
git add .
git commit -m "Add native API routing and cross-platform privacy fixes"
git push -u origin fix/cross-platform-api-v3-2-24
```

फिर GitHub पर इस branch का Pull Request `main` में खोलें। Patch script `server.js`, `public/app.js`, दोनों sign-in HTML forms, Service Worker, Capacitor config, Render environment template, package metadata और मौजूदा Android workflow को update करती है।

## आवश्यक configuration

GitHub → Settings → Secrets and variables → Actions → **Variables** में public variable बनाएँ:

```text
UJ_API_BASE_URL = https://YOUR-BACKEND-DOMAIN
```

यह केवल backend का public HTTPS origin है — इसमें API key/secret नहीं। Variable missing या invalid होने पर Android workflow APK बनाने से पहले fail होगा; इससे गलत backend वाला APK publish नहीं होगा।

Render/backend environment में exact origins रखें:

```text
NATIVE_ALLOWED_ORIGINS=https://localhost,capacitor://localhost
PUBLIC_ORIGIN=https://YOUR-BACKEND-DOMAIN
```

`render.yaml` में native origin allowlist की entry भी patch script जोड़ती है। Existing `/var/data` persistent disk और SQLite path को नहीं बदलती।

## सुरक्षा और सीमाएँ

- Gemini/OpenAI/Meta/HeyGen API keys केवल backend hosting के private environment में रहेंगी।
- PWA same-origin API calls ही इस्तेमाल करती है; Android/iOS wrapper build-time HTTPS API origin इस्तेमाल करता है।
- Native session cookies `HttpOnly; Secure; SameSite=None` होंगी; PWA cookies `SameSite=Lax` रहेंगी। CSRF header बरकरार है।
- Native Google OAuth और passkey buttons अभी hidden रहते हैं; deep-link callback और native WebAuthn/RP association तैयार होने तक इन्हें enabled दिखाना भ्रामक होगा। PWA HTTPS passkeys अलग से supported रह सकते हैं।
- Root `index.html` GitHub Pages UI preview पर स्पष्ट warning दिखाता है; वह connected backend app नहीं है। असली Node/PWA server `public/` directory serve करता है।
- Android versionCode `338`, versionName `3.2.24-native-api-preview` और package/lock/server version `3.2.24` होते हैं।
- यह patch iOS project/Xcode build नहीं बनाता। iOS packaging, signing और real-device cookie/Face ID testing अभी बाकी है।

## Verification scope

`VERIFICATION.txt` में इस patch run के वास्तविक स्थानीय checks और सीमाएँ दर्ज हैं। Native CORS server integration test `tests/native-cors.test.js` में शामिल है; इसे full repository पर `npm test`/GitHub Actions में चलाना होगा।

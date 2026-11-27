# UJ AI — Native API Connection Setup (Hindi)

यह patch Android WebView को hosted UJ AI backend से सुरक्षित रूप से जोड़ने की तैयारी करता है। PWA में API same-origin पर ही रहती है। API keys हमेशा backend hosting के private environment में रहेंगी।

## 1. Patch लागू करें

Repository root में ZIP extract करें और चलाएँ:

```bash
node scripts/apply-native-api-patch.mjs
npm run check
npm test
```

## 2. Backend hosting environment

Render या अन्य HTTPS hosting के private Environment Variables में:

```text
PUBLIC_ORIGIN=https://YOUR-BACKEND-DOMAIN
NATIVE_ALLOWED_ORIGINS=https://localhost,capacitor://localhost
```

`PUBLIC_ORIGIN` को वास्तविक backend origin से बदलें। `NATIVE_ALLOWED_ORIGINS` में केवल ऐप का exact WebView origin रखें। कोई wildcard (`*`) न लगाएँ।

Deploy के बाद जाँचें:

```text
https://YOUR-BACKEND-DOMAIN/api/health
```

यह केवल health endpoint है; `aiReady: true` provider connection की उपलब्धता बताता है, वास्तविक AI conversation test का विकल्प नहीं।

## 3. GitHub Actions repository variable

GitHub Repository → Settings → Secrets and variables → Actions → Variables में यह public variable बनाएँ:

```text
UJ_API_BASE_URL = https://YOUR-BACKEND-DOMAIN
```

यह URL secret नहीं है। इसमें कोई API key न रखें।

## 4. Android build

मौजूदा `.github/workflows/build-android.yml` को patch script अपडेट करेगा। PR merge या main पर push के बाद **Build Android APK** workflow चलेगा। Build तभी आगे बढ़ेगा जब `UJ_API_BASE_URL` सही HTTPS origin हो।

सफल build पर `uj-ai-v3-2-24-native-api-debug-apk` artifact मिलेगा। यह debug APK होगा, Play Store release signing नहीं।

## 5. iOS स्थिति

Capacitor 7 में iOS scheme `capacitor` ही रखा है (iOS पर `http`/`https` custom scheme मान्य नहीं), जबकि Android scheme `https` है। इसलिए backend allowlist में दोनों exact origins `https://localhost` और `capacitor://localhost` रखे गए हैं। यह iOS app build नहीं बनाता। iOS native project generation, Apple signing, associated domains और real-device passkey/Face ID परीक्षण अलग से बाकी हैं। इस patch में native Google OAuth और native passkey buttons जानबूझकर छिपे हैं; उनका redirect/domain association अभी configure नहीं है। Password sign-in API CORS/session flow से उपलब्ध रहेगा।

## 6. सुरक्षा

- Gemini/OpenAI/Meta/HeyGen keys केवल backend host के private environment variables में रखें।
- `UJ_API_BASE_URL` केवल public HTTPS origin है, secret नहीं।
- Backend पर `NATIVE_ALLOWED_ORIGINS=https://localhost,capacitor://localhost` exact allowlist है।
- Native session cookie `HttpOnly; Secure; SameSite=None` होगी; PWA cookie `SameSite=Lax` रहेगी।
- CSRF token header जारी रहेगा।

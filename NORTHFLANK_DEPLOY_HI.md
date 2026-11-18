# UJ AI v3.2.7 — Northflank deployment guide (Hindi)

यह archive Northflank के Buildpack या Dockerfile deployment के लिए तैयार किया गया है। अभी कोई live deployment नहीं हुआ है।

## Free always-on सीमा
Northflank के Developer Sandbox में अधिकतम 2 services, 2 jobs और 1 addon तथा Northflank Cloud resources पर $20/महीना तक की free allowance दी गई है। Pricing page इसे always-on/no-sleep बताती है। फिर भी compute, memory, network और storage allowance के भीतर रहना ज़रूरी है। Northflank की documentation में account शुरू करने के लिए payment method जोड़ने की बात भी है; dashboard में billing/usage ध्यान से जाँचें और paid resources/upgrade स्वीकार न करें। Free Sandbox production application के लिए recommended नहीं है।

## Deploy steps
1. इस ZIP को extract करें। `ujai_work` folder के अंदर project files हैं।
2. पूरे `ujai_work` folder को GitHub repository के root में upload/push करें। ZIP को repository में nested folder के रूप में रखने के बजाय उसके अंदर की files root में रखें।
3. Northflank में account बनाकर Developer Sandbox चुनें और नया project बनाएं।
4. `Create service` → `Combined` चुनें, GitHub repository और branch connect करें।
5. Build option में `Dockerfile` चुनें; Dockerfile project root में है।
6. Networking में public HTTP port `3000` जोड़ें।
7. Resources/plan में Free Sandbox limits के अंदर रहें; एक instance रखें। कोई paid compute/volume/add-on चुनने से पहले price देखें।
8. Runtime environment variables जोड़ें (नीचे सूची)। API keys केवल Northflank के secret/environment settings में डालें, ZIP, GitHub या chat में नहीं।
9. Service create/deploy करें और मिलने वाले HTTPS URL पर `/api/health` खोलकर `ok: true` जाँचें।

## Runtime environment variables
- `NODE_ENV=production`
- `PORT=3000` (यदि platform खुद PORT inject करे तो platform value को प्राथमिकता दें)
- `PUBLIC_ORIGIN=https://YOUR-NORTHFLANK-URL`
- `WEBAUTHN_RP_ID=YOUR-NORTHFLANK-HOSTNAME` (केवल hostname, `https://` के बिना)
- `DB_PATH=/app/data/ujai.sqlite`
- कम-से-कम एक AI provider secret, जैसे `GEMINI_API_KEY` या `OPENAI_API_KEY`
- HeyGen के लिए वैकल्पिक: `HEYGEN_API_KEY`, `HEYGEN_VOICE_ID`

## जरूरी data warning
SQLite database `/app/data/ujai.sqlite` में रहता है। Container की सामान्य filesystem को persistent मानकर न चलें। Restart/redeploy के बाद account/chat data बचाने के लिए Northflank में `/app/data` पर persistent volume configure करना होगा; उस volume की कीमत/Free allowance पहले dashboard में जाँचें। अगर persistent storage free allowance में उपलब्ध न हो, तो live users का data डालने से पहले managed database या दूसरी persistent-storage योजना तय करें।

## क्या अभी verified है
- Local Node.js syntax checks और automated mock/local tests।
- Dockerfile/port configuration तैयार।
- Northflank account, GitHub connection, actual cloud build, public URL, persistence, real AI keys और Android phone पर live test अभी नहीं हुए हैं।
- Android APK अभी इस archive में शामिल नहीं है।

# UJ AI Render deployment — Hindi

यह repository `render.yaml` में Node web service और 1 GB persistent disk की configuration रखती है. इसे deploy करने के लिए Render account owner को अपने dashboard में service create/deploy approve करना होगा; यह archive अपने-आप cloud में deploy नहीं होता.

## Steps
1. GitHub repo `ujjavalbaghel11-star/Uj-ai-` को Render account में connect करें.
2. New → Blueprint चुनकर repository की `render.yaml` apply करें, या Node web service बनाएँ.
3. Persistent disk `/var/data` पर mount रखें और `DB_PATH=/var/data/ujai.sqlite` रखें.
4. Service environment में `PUBLIC_ORIGIN` को वास्तविक HTTPS URL और `WEBAUTHN_RP_ID` को hostname दें.
5. कम-से-कम एक AI provider secret (`GEMINI_API_KEY` या `OPENAI_API_KEY`) hosting secrets में डालें.
6. GitHub OAuth के लिए `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_CALLBACK_URL`, `UJ_TOKEN_ENCRYPTION_KEY` सेट करें. Callback URL `https://YOUR-RENDER-DOMAIN/api/github/callback` होना चाहिए.
7. Optional HeyGen TTS के लिए `HEYGEN_API_KEY` और `HEYGEN_VOICE_ID` secrets में रखें.
8. Deploy के बाद `https://YOUR-DOMAIN/api/health` पर `ok: true` verify करें. दो अलग devices से sign-in, chat history और project save test करें.

## खर्च और सुरक्षा
Render plan, persistent disk और usage के वर्तमान charges dashboard में जाँचें. कोई paid plan/upgrade user की स्पष्ट स्वीकृति के बिना न चुनें. API keys, OAuth secrets और encryption key केवल hosting secret manager में रखें; source ZIP या public GitHub repo में नहीं.

## इस environment से क्या नहीं किया गया
Render account connect, service create, domain assignment, secrets entry, billing approval और live deployment यहाँ नहीं किए गए. ये account-owner actions हैं.

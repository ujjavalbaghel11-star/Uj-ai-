# UJ AI GitHub Sync — setup guide (Hindi)

## क्या जोड़ा गया है
- GitHub OAuth connect/disconnect flow with one-time, expiring state.
- GitHub access token AES-256-GCM से encrypted होकर account के साथ server database में save होता है; token browser में नहीं भेजा जाता।
- Public repositories की सूची, project Push और Pull (text files merge) support.
- हर action signed-in UJ account, CSRF token और rate limit से protected है.

## GitHub OAuth App बनाना
1. GitHub में Settings → Developer settings → OAuth Apps → New OAuth App खोलें.
2. Application name: `UJ AI` रखें.
3. Homepage URL में अपनी deployed UJ AI HTTPS URL डालें.
4. Authorization callback URL में ठीक यह डालें: `https://YOUR-DOMAIN/api/github/callback`.
5. Client ID और Client Secret को केवल hosting के secret/environment settings में रखें.

## Hosting environment variables
- `GITHUB_CLIENT_ID` — OAuth App का Client ID.
- `GITHUB_CLIENT_SECRET` — OAuth App का Client Secret.
- `GITHUB_CALLBACK_URL` — ऊपर वाला exact callback URL; यदि खाली हो तो `PUBLIC_ORIGIN` से बनाया जाएगा.
- `UJ_TOKEN_ENCRYPTION_KEY` — 32-byte encryption key. Generate: `openssl rand -hex 32`.

Encryption key को स्थायी और private रखें. इसे बदलने पर पुराने encrypted GitHub tokens decrypt नहीं होंगे; तब GitHub को reconnect करना पड़ेगा. Key या OAuth secret को source code, ZIP, GitHub repo, screenshots या chat में न डालें.

## Connect और Sync
1. UJ AI में account sign in करें → Developer Workspace खोलें.
2. `Connect GitHub` दबाकर GitHub consent screen पर permissions review करके authorize करें.
3. Repository चुनें. Push केवल उस public repository पर होगा जहाँ connected GitHub account को write access है.
4. `Push` UJ project की text files को selected branch पर एक commit में भेजता है.
5. `Pull` GitHub text files को UJ project में merge करता है. समान path वाली files update होंगी; local-only files delete नहीं होंगी.

## Permission boundary
वर्तमान OAuth scope `public_repo read:user` है: public repositories तक सीमित. Private repositories अभी समर्थित नहीं हैं. OAuth consent को पढ़कर ही authorize करें; access कभी भी UJ AI में `Disconnect` या GitHub Settings → Applications से revoke किया जा सकता है.

## Limits
- UJ project limits: 200 files, 48 KB per text file, 1 MB total text.
- Pull binary files छोड़ देता है और केवल UTF-8 text files import करता है.
- Pull merge करता है; यह remote delete operations लागू नहीं करता.
- GitHub API rate limits लागू होते हैं.

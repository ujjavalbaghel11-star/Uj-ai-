import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = name => path.join(ROOT, name);
const read = name => fs.readFileSync(file(name), 'utf8');
const write = (name, content) => fs.writeFileSync(file(name), content);
function replaceOnce(source, oldText, newText, label) {
  if (source.includes(newText)) return source;
  const first = source.indexOf(oldText);
  if (first < 0 || source.indexOf(oldText, first + oldText.length) >= 0) {
    throw new Error(`Patch anchor missing or ambiguous: ${label}`);
  }
  return source.slice(0, first) + newText + source.slice(first + oldText.length);
}

let server = read('server.js');
server = replaceOnce(server,
`function setSessionCookie(req, res, token) {
  const secure = secureCookie(req) ? '; Secure' : '';
  res.setHeader('Set-Cookie', \`${'${COOKIE_NAME}'}=${'${encodeURIComponent(token)}'}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${'${SESSION_DAYS * 86400}'}${'${secure}'}\`);
}
function clearSessionCookie(req, res) {
  const secure = secureCookie(req) ? '; Secure' : '';
  res.setHeader('Set-Cookie', \`${'${COOKIE_NAME}'}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${'${secure}'}\`);
}`,
`function normalizeAllowedOrigin(value) {
  const raw = String(value || '').trim();
  if (raw === 'capacitor://localhost') return raw;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) return '';
    return url.origin;
  } catch { return ''; }
}
function requestOrigin(req) {
  const raw = String(req.headers.origin || '');
  if (raw === 'capacitor://localhost') return raw;
  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return '';
    return url.origin;
  } catch { return ''; }
}
function configuredNativeOrigins() {
  return new Set(String(process.env.NATIVE_ALLOWED_ORIGINS || '').split(',').map(normalizeAllowedOrigin).filter(Boolean));
}
function isNativeOrigin(req) {
  const origin = requestOrigin(req);
  return Boolean(origin && configuredNativeOrigins().has(origin) && origin !== expectedOrigin(req));
}
function setSessionCookie(req, res, token) {
  const sameSite = isNativeOrigin(req) ? 'None' : 'Lax';
  const secure = secureCookie(req) || sameSite === 'None' ? '; Secure' : '';
  res.setHeader('Set-Cookie', \`${'${COOKIE_NAME}'}=${'${encodeURIComponent(token)}'}; Path=/; HttpOnly; SameSite=${'${sameSite}'}; Max-Age=${'${SESSION_DAYS * 86400}'}${'${secure}'}\`);
}
function clearSessionCookie(req, res) {
  const sameSite = isNativeOrigin(req) ? 'None' : 'Lax';
  const secure = secureCookie(req) || sameSite === 'None' ? '; Secure' : '';
  res.setHeader('Set-Cookie', \`${'${COOKIE_NAME}'}=; Path=/; HttpOnly; SameSite=${'${sameSite}'}; Max-Age=0${'${secure}'}\`);
}`,
'session cookie policy');
server = replaceOnce(server,
`function originAllowed(req) {
  if (req.headers['sec-fetch-site'] === 'cross-site') return false;
  const origin = req.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).origin === expectedOrigin(req); } catch { return false; }
}`,
`function originAllowed(req) {
  const rawOrigin = req.headers.origin;
  if (!rawOrigin) return req.headers['sec-fetch-site'] !== 'cross-site';
  const origin = requestOrigin(req);
  return Boolean(origin && (origin === expectedOrigin(req) || configuredNativeOrigins().has(origin)));
}
function applyNativeCors(req, res) {
  const origin = requestOrigin(req);
  if (!origin) return false;
  if (!configuredNativeOrigins().has(origin) || origin === expectedOrigin(req)) return false;
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token');
  res.setHeader('Access-Control-Max-Age', '600');
  res.setHeader('Vary', 'Origin');
  return true;
}`,
'native origin allowlist and CORS');
server = replaceOnce(server,
`  if (pathname.startsWith('/api/')) {
    if (req.method !== 'GET' && !originAllowed(req)) { json(res, 403, { error: 'Cross-site request blocked.' }); return; }
    if (pathname === '/api/health' && req.method === 'GET') {`,
`  if (pathname.startsWith('/api/')) {
    if (!originAllowed(req)) { json(res, 403, { error: 'Cross-site request blocked.' }); return; }
    const nativeCors = applyNativeCors(req, res);
    if (req.method === 'OPTIONS') {
      const method = String(req.headers['access-control-request-method'] || '').toUpperCase();
      const requestedHeaders = String(req.headers['access-control-request-headers'] || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
      const allowedMethods = new Set(['GET', 'POST']);
      const allowedHeaders = new Set(['content-type', 'x-csrf-token']);
      if ((!nativeCors && req.headers.origin !== expectedOrigin(req)) || !allowedMethods.has(method) || requestedHeaders.some(header => !allowedHeaders.has(header))) {
        json(res, 403, { error: 'CORS preflight rejected.' }); return;
      }
      res.writeHead(204, { 'Cache-Control': 'no-store' });
      res.end();
      return;
    }
    if (pathname === '/api/health' && req.method === 'GET') {`,
'API CORS and preflight');
server = server.replace("version: '3.2.17'", "version: '3.2.24'");
write('server.js', server);

let app = read('public/app.js');
app = replaceOnce(app,
`function setAuthStatus(message) { $('#authStatus').textContent = message; }
async function api(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const headers = { ...(options.headers || {}) };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (!['GET', 'HEAD'].includes(method) && csrfToken) headers['X-CSRF-Token'] = csrfToken;
  const response = await fetch(path, {
    method, headers, credentials: 'same-origin',
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });`,
`function setAuthStatus(message) { $('#authStatus').textContent = message; }
function apiUrl(path) {
  const route = String(path || '');
  if (!route.startsWith('/api/')) throw new Error('Invalid UJ AI API route.');
  const configured = String(window.UJ_RUNTIME_CONFIG?.apiBaseUrl || '').trim();
  const nativeApp = Boolean(window.UJ_RUNTIME_CONFIG?.nativeApp);
  if (nativeApp && !configured) throw new Error('Native backend URL is missing. Rebuild with UJ_API_BASE_URL configured in GitHub Actions.');
  const base = configured ? new URL(configured) : new URL(location.origin);
  if (configured && (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash || base.pathname !== '/')) {
    throw new Error('UJ AI backend URL must be a clean HTTPS origin.');
  }
  const target = new URL(route, base.origin);
  if (target.origin !== base.origin) throw new Error('UJ AI API route escaped its configured origin.');
  return target.href;
}
if (window.UJ_RUNTIME_CONFIG?.nativeApp) {
  for (const selector of ['#googleLogin', '#passkeyLogin', '#addPasskey']) {
    const control = $(selector);
    if (control) { control.hidden = true; control.dataset.restoreHidden = 'true'; }
  }
  const note = document.createElement('p');
  note.className = 'auth-note';
  note.textContent = 'Native app: password sign-in available. Google OAuth and passkeys will be enabled after native redirect and domain association are configured.';
  $('#authStatus')?.after(note);
}
async function api(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const headers = { ...(options.headers || {}) };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (!['GET', 'HEAD'].includes(method) && csrfToken) headers['X-CSRF-Token'] = csrfToken;
  const response = await fetch(apiUrl(path), {
    method, headers, credentials: 'include',
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });`,
'native API base routing');
write('public/app.js', app);

let html = read('public/index.html');
html = replaceOnce(html, '  <script src="/app.js" defer></script>', '  <script src="/runtime-config.js" defer></script>\n  <script src="/app.js" defer></script>', 'runtime config script');
write('public/index.html', html);

// Remove any account-specific email from both the app shell and the static Pages preview.
for (const htmlPath of ['public/index.html', 'index.html']) {
  if (!fs.existsSync(file(htmlPath))) continue;
  let source = read(htmlPath);
  source = source.replace(/<input\b[^>]*\bid=\"email\"[^>]*>/gi, tag => tag.replace(/\svalue=\"[^\"]*\"/i, ''));
  if (htmlPath === 'index.html' && !source.includes('data-uj-preview-banner')) {
    source = source.replace('<body>', '<body>\n  <div data-uj-preview-banner role=\"status\" style=\"margin:12px;padding:12px;border:1px solid #b7791f;border-radius:10px;background:#fff7e6;color:#6b4600;font:14px/1.45 system-ui,sans-serif\">यह GitHub Pages UI preview है। इस static preview में sign-in, AI और cloud chat sync का live backend connection उपलब्ध नहीं माना जाना चाहिए।</div>');
  }
  write(htmlPath, source);
}

let sw = read('public/sw.js');
sw = sw.replace("const CACHE_NAME = 'uj-ai-shell-v3-phone-control-1';", "const CACHE_NAME = 'uj-ai-shell-v3-2-24-native-api-1';");
if (!sw.includes("  '/runtime-config.js',")) sw = sw.replace("  '/app.js',\n", "  '/app.js',\n  '/runtime-config.js',\n");
write('public/sw.js', sw);

if (!fs.existsSync(file('public/runtime-config.js'))) {
  write('public/runtime-config.js', "window.UJ_RUNTIME_CONFIG = Object.freeze({ apiBaseUrl: '', nativeApp: false });\n");
}

const capacitor = JSON.parse(read('capacitor.config.json'));
capacitor.server = { ...(capacitor.server || {}), androidScheme: 'https', iosScheme: 'capacitor' };
write('capacitor.config.json', `${JSON.stringify(capacitor, null, 2)}\n`);

let env = read('.env.example');
if (!env.includes('NATIVE_ALLOWED_ORIGINS=')) env = `${env.trimEnd()}\nNATIVE_ALLOWED_ORIGINS=https://localhost,capacitor://localhost\n`;
write('.env.example', env);

let androidWorkflow = read('.github/workflows/build-android.yml');
androidWorkflow = replaceOnce(androidWorkflow,
`      - name: Run project checks
        run: npm run check

      - name: Set up Java`,
`      - name: Run project checks
        run: npm run check

      - name: Run automated tests
        run: npm test

      - name: Configure native HTTPS backend origin
        env:
          UJ_API_BASE_URL: \${{ vars.UJ_API_BASE_URL }}
        run: npm run configure:native

      - name: Set up Java`,
'Android workflow native backend configuration');
androidWorkflow = androidWorkflow.replace('name: uj-ai-debug-apk', 'name: uj-ai-v3-2-24-native-api-debug-apk');
write('.github/workflows/build-android.yml', androidWorkflow);

const packageJson = JSON.parse(read('package.json'));
packageJson.scripts ||= {};
packageJson.scripts['configure:native'] = 'node scripts/configure-native-api.mjs';
packageJson.scripts.check = [
  'node --check server.js',
  'node --check public/app.js',
  'node --check public/sw.js',
  'node --check public/runtime-config.js',
  'node --check scripts/configure-native-api.mjs'
].join(' && ');
write('package.json', `${JSON.stringify(packageJson, null, 2)}\n`);
packageJson.version = '3.2.24';
write('package.json', `${JSON.stringify(packageJson, null, 2)}\n`);

const lockPath = file('package-lock.json');
if (fs.existsSync(lockPath)) {
  const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  lock.version = '3.2.24';
  if (lock.packages?.['']) lock.packages[''].version = '3.2.24';
  fs.writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
}

const gradlePath = file('android/app/build.gradle');
if (fs.existsSync(gradlePath)) {
  let gradle = fs.readFileSync(gradlePath, 'utf8');
  gradle = gradle.replace(/versionCode\s+\d+/, 'versionCode 338');
  gradle = gradle.replace(/versionName\s+['"][^'"]+['"]/, 'versionName "3.2.24-native-api-preview"');
  fs.writeFileSync(gradlePath, gradle);
}

const languageTestPath = file('language-policy.test.js');
if (fs.existsSync(languageTestPath)) {
  let source = fs.readFileSync(languageTestPath, 'utf8');
  source = source.replace("version: '3\\.2\\.17'", "version: '3.2.24'");
  fs.writeFileSync(languageTestPath, source);
}
const androidTestPath = file('tests/native-android.test.js');
if (fs.existsSync(androidTestPath)) {
  let source = fs.readFileSync(androidTestPath, 'utf8');
  source = source.replace("versionName '3\\.2\\.17-native-preview'", "versionName [\"']3\\.2\\.24-native-api-preview[\"']");
  fs.writeFileSync(androidTestPath, source);
}

const renderPath = file('render.yaml');
if (fs.existsSync(renderPath)) {
  let render = fs.readFileSync(renderPath, 'utf8');
  if (!render.includes('key: NATIVE_ALLOWED_ORIGINS')) {
    render = render.replace('      - key: PUBLIC_ORIGIN\n        sync: false\n', '      - key: PUBLIC_ORIGIN\n        sync: false\n      - key: NATIVE_ALLOWED_ORIGINS\n        value: https://localhost,capacitor://localhost\n');
  }
  fs.writeFileSync(renderPath, render);
}

console.log('UJ AI v3.2.24 native API and privacy patch applied. Copy the included tests, then run npm run check && npm test.');
console.log('Backend: set NATIVE_ALLOWED_ORIGINS=https://localhost,capacitor://localhost. Android/iOS build: set GitHub variable UJ_API_BASE_URL to the public HTTPS backend origin.');

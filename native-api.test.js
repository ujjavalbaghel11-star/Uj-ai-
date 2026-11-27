import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('native API client uses a validated HTTPS origin and credentialed fetch', () => {
  const app = readFileSync(path.join(ROOT, 'public/app.js'), 'utf8');
  const html = readFileSync(path.join(ROOT, 'public/index.html'), 'utf8');
  const config = readFileSync(path.join(ROOT, 'public/runtime-config.js'), 'utf8');
  assert.match(app, /function apiUrl\(path\)/);
  assert.match(app, /base\.protocol !== 'https:'/);
  assert.match(app, /nativeApp && !configured/);
  assert.match(app, /credentials: 'include'/);
  assert.match(html, /runtime-config\.js/);
  assert.match(config, /apiBaseUrl: ''/);
  assert.match(config, /nativeApp: false/);
});

test('native API configuration rejects missing and non-HTTPS backend URLs', () => {
  const script = path.join(ROOT, 'scripts/configure-native-api.mjs');
  const dir = mkdtempSync(path.join(os.tmpdir(), 'ujai-runtime-config-'));
  const output = path.join(dir, 'runtime-config.js');
  try {
    const missing = spawnSync(process.execPath, [script], { env: { ...process.env, UJ_API_BASE_URL: '', UJ_RUNTIME_CONFIG_OUTPUT: output }, encoding: 'utf8' });
    assert.notEqual(missing.status, 0);
    const insecure = spawnSync(process.execPath, [script], { env: { ...process.env, UJ_API_BASE_URL: 'http://api.example.com', UJ_RUNTIME_CONFIG_OUTPUT: output }, encoding: 'utf8' });
    assert.notEqual(insecure.status, 0);
    const valid = spawnSync(process.execPath, [script], { env: { ...process.env, UJ_API_BASE_URL: 'https://api.example.com', UJ_RUNTIME_CONFIG_OUTPUT: output }, encoding: 'utf8' });
    assert.equal(valid.status, 0, valid.stderr);
    const written = readFileSync(output, 'utf8');
    assert.ok(written.includes('https://api.example.com'));
    assert.match(written, /nativeApp: true/);
    assert.doesNotMatch(written, /API_KEY|SECRET|TOKEN/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('Capacitor uses platform-safe local schemes on Android and iOS', () => {
  const config = JSON.parse(readFileSync(path.join(ROOT, 'capacitor.config.json'), 'utf8'));
  assert.equal(config.server.androidScheme, 'https');
  assert.equal(config.server.iosScheme, 'capacitor');
  const gradle = readFileSync(path.join(ROOT, 'android/app/build.gradle'), 'utf8');
  assert.match(gradle, /versionCode 338/);
  assert.match(gradle, /3\.2\.24-native-api-preview/);
});


test('release metadata is synchronized and account email is not prefilled', () => {
  const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const lock = JSON.parse(readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8'));
  assert.equal(pkg.version, '3.2.24');
  assert.equal(lock.version, pkg.version);
  assert.equal(lock.packages[''].version, pkg.version);
  for (const file of ['public/index.html', 'index.html']) {
    const html = readFileSync(path.join(ROOT, file), 'utf8');
    assert.doesNotMatch(html, /id="email"[^>]*\bvalue=/i);
  }
  const preview = readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.match(preview, /data-uj-preview-banner/);
});


test('Android workflow requires a public HTTPS backend URL variable before APK packaging', () => {
  const workflow = readFileSync(path.join(ROOT, '.github/workflows/build-android.yml'), 'utf8');
  assert.match(workflow, /UJ_API_BASE_URL:\s*\$\{\{\s*vars\.UJ_API_BASE_URL\s*\}\}/);
  assert.match(workflow, /npm run configure:native/);
  assert.match(workflow, /npm test/);
});

test('backend contains exact native CORS allowlist, preflight and cookie policy', () => {
  const server = readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  assert.match(server, /function configuredNativeOrigins\(\)/);
  assert.match(server, /function applyNativeCors\(req, res\)/);
  assert.match(server, /Access-Control-Allow-Origin/);
  assert.match(server, /Access-Control-Allow-Credentials/);
  assert.match(server, /req\.method === 'OPTIONS'/);
  assert.match(server, /SameSite=\$\{sameSite\}/);
  assert.match(server, /NATIVE_ALLOWED_ORIGINS/);
});

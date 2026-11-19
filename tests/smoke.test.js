import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let child;
let baseUrl;
let cookie = '';
let csrfToken = '';
let chatId = '';
let tempDir;

async function freePort() {
  const server = net.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
async function request(route, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (cookie) headers.Cookie = cookie;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.csrf !== false && csrfToken && !['GET', 'HEAD'].includes((options.method || 'GET').toUpperCase())) headers['X-CSRF-Token'] = csrfToken;
  const response = await fetch(`${baseUrl}${route}`, {
    method: options.method || 'GET', headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const data = await response.json().catch(() => ({}));
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  if (data.csrfToken) csrfToken = data.csrfToken;
  return { response, data };
}

 test('PWA shell, account auth and per-account cloud-history API smoke test', async t => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ujai-test-'));
  const port = await freePort();
  baseUrl = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: { PATH: process.env.PATH, PORT: String(port), NODE_ENV: 'test', PUBLIC_ORIGIN: baseUrl, DB_PATH: path.join(tempDir, 'test.sqlite') },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let logs = '';
  child.stdout.on('data', chunk => { logs += chunk.toString(); });
  child.stderr.on('data', chunk => { logs += chunk.toString(); });
  t.after(async () => {
    if (child && child.exitCode === null) child.kill('SIGTERM');
    await new Promise(resolve => setTimeout(resolve, 100));
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) { ready = true; break; }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.equal(ready, true, `server did not start. Logs: ${logs}`);

  const health = await request('/api/health');
  assert.equal(health.data.ok, true);
  assert.equal(health.data.aiReady, false);
  assert.equal(health.data.googleSignInAvailable, false);
  assert.equal(Object.hasOwn(health.data, 'providers'), false, 'provider identities should not be exposed');
  const unavailableGoogleLogin = await request('/api/auth/google');
  assert.equal(unavailableGoogleLogin.response.status, 503);

  const shell = await fetch(`${baseUrl}/`);
  assert.equal(shell.status, 200);
  const shellHtml = await shell.text();
  assert.match(shellHtml, /UJ AI में स्वागत है/);
  assert.match(shellHtml, /data-mode=\"cybersecurity\"/);
  assert.match(shellHtml, /data-mode=\"jarvis\"/);
  assert.match(shellHtml, /id=\"attachButton\"/);
  assert.match(shellHtml, /id="phoneControl"/);
  assert.match(shellHtml, /id="googleLogin"/);
  assert.match(shellHtml, /id="forgotPassword"/);
  assert.match(shellHtml, /id="resetForm"/);
  assert.match(shellHtml, /id="settingsButton"/);
  assert.match(shellHtml, /id="themeSetting"/);
  assert.match(shellHtml, /id="voiceSetting"/);
  assert.match(shellHtml, /id="privacySetting"/);
  assert.match(shellHtml, /id="webSearchButton"/);
  assert.match(shellHtml, /id="imageButton"/);
  assert.match(shellHtml, /data-phone-action="youtube"/);
  const clientJs = await fetch(`${baseUrl}/app.js`);
  const clientSource = await clientJs.text();
  assert.match(clientSource, /function detectPhoneCommand/);
  assert.match(clientSource, /android\.settings\.WIFI_SETTINGS/);
  assert.match(clientSource, /android\.media\.action\.IMAGE_CAPTURE/);
  const manifest = await fetch(`${baseUrl}/manifest.webmanifest`);
  assert.equal(manifest.status, 200);
  assert.match(await manifest.text(), /"display": "standalone"/);
  assert.equal((await fetch(`${baseUrl}/icon-192.png`)).status, 200);
  const update = await request('/api/app/update');
  assert.equal(update.response.status, 200);
  assert.equal(update.data.latestCode, 331);

  const unauth = await request('/api/chats');
  assert.equal(unauth.response.status, 401);
  assert.equal((await request('/api/search', { method: 'POST', csrf: false, body: { query: 'UJ AI' } })).response.status, 401);
  assert.equal((await request('/api/images/generate', { method: 'POST', csrf: false, body: { prompt: 'UJ logo' } })).response.status, 401);

  const crossOrigin = await request('/api/auth/register', {
    method: 'POST',
    csrf: false,
    headers: {
      Origin: 'https://attacker.example',
      'X-Forwarded-Host': 'public.example',
      'X-Forwarded-Proto': 'https',
      'Sec-Fetch-Site': 'cross-site',
      Cookie: 'ujai_session=must-not-be-logged'
    },
    body: { email: 'attacker@example.com', password: 'A-strong-test-pass-123' }
  });
  assert.equal(crossOrigin.response.status, 403, 'cross-origin auth requests must remain blocked');
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.match(logs, /\[UJ AI origin rejected\]/);
  assert.match(logs, new RegExp(`"method":"POST"`));
  assert.match(logs, /"path":"\/api\/auth\/register"/);
  assert.match(logs, /"origin":"https:\/\/attacker\.example"/);
  assert.match(logs, new RegExp(`"host":"127\\.0\\.0\\.1:${port}"`));
  assert.match(logs, /"forwardedHost":"public\.example"/);
  assert.match(logs, /"forwardedProto":"https"/);
  assert.match(logs, /"secFetchSite":"cross-site"/);
  assert.match(logs, new RegExp(`"expectedOrigin":"http:\\/\\/127\\.0\\.0\\.1:${port}"`));
  assert.doesNotMatch(logs, /must-not-be-logged|A-strong-test-pass-123/);

  const register = await request('/api/auth/register', { method: 'POST', csrf: false, body: { email: 'tester@example.com', password: 'A-strong-test-pass-123' } });
  assert.equal(register.response.status, 201, JSON.stringify(register.data));
  assert.equal((await request('/api/search', { method: 'POST', body: { query: '' } })).response.status, 400);
  assert.equal((await request('/api/search', { method: 'POST', body: { query: 'UJ AI' } })).response.status, 503);
  assert.equal((await request('/api/images/generate', { method: 'POST', body: { prompt: 'UJ logo' } })).response.status, 503);
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal((logs.match(/\[UJ AI origin rejected\]/g) || []).length, 1, 'allowed requests must not emit origin-rejection diagnostics');
  assert.equal(register.data.authenticated, true);
  assert.ok(cookie.startsWith('ujai_session='));

  const forgotUnknown = await request('/api/auth/password/forgot', {
    method: 'POST',
    csrf: false,
    body: { email: 'unknown-reset@example.com' }
  });
  assert.equal(forgotUnknown.response.status, 200);
  assert.equal(forgotUnknown.data.ok, true);
  assert.equal(Object.hasOwn(forgotUnknown.data, 'token'), false, 'reset tokens must never be returned');

  const resetToken = 'A'.repeat(43);
  const resetDb = new DatabaseSync(path.join(tempDir, 'test.sqlite'));
  const resetUser = resetDb.prepare('SELECT id FROM users WHERE email=?').get('tester@example.com');
  const resetHash = crypto.createHash('sha256').update(resetToken).digest('hex');
  resetDb.prepare('INSERT INTO password_reset_tokens(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)')
    .run(resetHash, resetUser.id, new Date(Date.now() + 30 * 60_000).toISOString(), new Date().toISOString());
  resetDb.close();

  const reset = await request('/api/auth/password/reset', {
    method: 'POST',
    csrf: false,
    body: { token: resetToken, password: 'A-new-strong-password-456' }
  });
  assert.equal(reset.response.status, 200);
  assert.equal(reset.data.ok, true);
  assert.equal(Object.hasOwn(reset.data, 'token'), false, 'reset responses must not expose tokens');

  const replay = await request('/api/auth/password/reset', {
    method: 'POST',
    csrf: false,
    body: { token: resetToken, password: 'Another-password-789' }
  });
  assert.equal(replay.response.status, 400, 'reset tokens must be single-use');

  const expiredToken = 'B'.repeat(43);
  const expiredDb = new DatabaseSync(path.join(tempDir, 'test.sqlite'));
  const expiredHash = crypto.createHash('sha256').update(expiredToken).digest('hex');
  expiredDb.prepare('INSERT INTO password_reset_tokens(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)')
    .run(expiredHash, resetUser.id, new Date(Date.now() - 60_000).toISOString(), new Date().toISOString());
  expiredDb.close();
  const expired = await request('/api/auth/password/reset', {
    method: 'POST',
    csrf: false,
    body: { token: expiredToken, password: 'Expired-password-789' }
  });
  assert.equal(expired.response.status, 400, 'expired reset tokens must be rejected');
  const resetLogin = await request('/api/auth/login', {
    method: 'POST',
    csrf: false,
    body: { email: 'tester@example.com', password: 'A-new-strong-password-456' }
  });
  assert.equal(resetLogin.response.status, 200);

  const session = await request('/api/auth/session');
  assert.equal(session.data.authenticated, true);
  assert.equal(session.data.user.email, 'tester@example.com');
  assert.ok(csrfToken.length > 10);

  const pinInitial = await request('/api/auth/pin/status');
  assert.equal(pinInitial.response.status, 200);
  assert.equal(pinInitial.data.enabled, false);
  const weakPin = await request('/api/auth/pin/set', { method: 'POST', body: { pin: '1234' } });
  assert.equal(weakPin.response.status, 400);
  const pinSet = await request('/api/auth/pin/set', { method: 'POST', body: { pin: '482916' } });
  assert.equal(pinSet.response.status, 200);
  assert.equal((await request('/api/auth/pin/status')).data.enabled, true);
  const pinWrong = await request('/api/auth/pin/verify', { method: 'POST', body: { pin: '111111' } });
  assert.equal(pinWrong.response.status, 401);
  const pinGood = await request('/api/auth/pin/verify', { method: 'POST', body: { pin: '482916' } });
  assert.equal(pinGood.response.status, 200);

  const noCsrf = await request('/api/chats', { method: 'POST', csrf: false, body: { mode: 'personal' } });
  assert.equal(noCsrf.response.status, 403);

  const created = await request('/api/chats', { method: 'POST', body: { mode: 'nursing' } });
  assert.equal(created.response.status, 201);
  chatId = created.data.chat.id;
  assert.equal(created.data.chat.mode, 'nursing');

  const cyberChat = await request('/api/chats', { method: 'POST', body: { mode: 'cybersecurity' } });
  assert.equal(cyberChat.response.status, 201);
  assert.equal(cyberChat.data.chat.mode, 'cybersecurity');
  const folaxChat = await request('/api/chats', { method: 'POST', body: { mode: 'folax' } });
  assert.equal(folaxChat.response.status, 201);
  assert.equal(folaxChat.data.chat.mode, 'folax');
  const jarvisChat = await request('/api/chats', { method: 'POST', body: { mode: 'jarvis' } });
  assert.equal(jarvisChat.response.status, 201);
  assert.equal(jarvisChat.data.chat.mode, 'jarvis');

  const noProvider = await request('/api/chat', { method: 'POST', body: { chatId, message: 'Test message', mode: 'nursing' } });
  assert.equal(noProvider.response.status, 503);
  assert.match(noProvider.data.error, /AI service/);
  const emptyMessages = await request(`/api/chats/${chatId}/messages`);
  assert.equal(emptyMessages.response.status, 200);
  assert.equal(emptyMessages.data.messages.length, 0, 'failed AI calls must not save a partial turn');

  const wrongLogin = await request('/api/auth/login', { method: 'POST', csrf: false, body: { email: 'tester@example.com', password: 'wrong-password' } });
  assert.equal(wrongLogin.response.status, 401);
  const logout = await request('/api/auth/logout', { method: 'POST', body: {} });
  assert.equal(logout.response.status, 200);
  cookie = '';
  csrfToken = '';
  assert.equal((await request('/api/chats')).response.status, 401);

  const login = await request('/api/auth/login', { method: 'POST', csrf: false, body: { email: 'tester@example.com', password: 'A-new-strong-password-456' } });
  assert.equal(login.response.status, 200);
  const syncedChats = await request('/api/chats');
  assert.equal(syncedChats.response.status, 200);
  assert.equal(syncedChats.data.chats.length, 4);
  assert.ok(syncedChats.data.chats.some(item => item.id === chatId), 'same account should see its saved chats after signing in again');
  assert.ok(syncedChats.data.chats.some(item => item.mode === 'cybersecurity'), 'cybersecurity chat mode should persist');
  assert.ok(syncedChats.data.chats.some(item => item.mode === 'folax'), 'Folax mode should persist');
  assert.ok(syncedChats.data.chats.some(item => item.mode === 'jarvis'), 'JARVIS mode should persist');

  const passkeyStatus = await request('/api/auth/passkey/register/options', { method: 'POST', body: {} });
  if (!health.data.passkeysAvailable) assert.equal(passkeyStatus.response.status, 503);
 });


test('configured server-side provider replies are persisted and available to a second sign-in', async t => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ujai-provider-test-'));
  let providerRequests = 0;
  const providerMessages = [];
  const provider = http.createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk.toString();
    const body = JSON.parse(raw || '{}');
    providerRequests += 1;
    assert.equal(req.url, '/v1/chat/completions');
    assert.equal(req.headers.authorization, 'Bearer test-only-key');
    assert.ok(Array.isArray(body.messages));
    providerMessages.push(body.messages);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ message: { content: 'UJ AI test reply — server provider connected.' } }] }));
  });
  await new Promise(resolve => provider.listen(0, '127.0.0.1', resolve));
  const providerPort = provider.address().port;
  const port = await freePort();
  const localBase = `http://127.0.0.1:${port}`;
  const dbFile = path.join(temp, 'sync.sqlite');
  const app = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: {
      PATH: process.env.PATH,
      PORT: String(port),
      NODE_ENV: 'test',
      DB_PATH: dbFile,
      META_API_KEY: 'test-only-key',
      META_BASE_URL: `http://127.0.0.1:${providerPort}/v1`,
      META_MODEL: 'mock-model',
      UJ_AI_PROVIDER_ORDER: 'meta'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let logs = '';
  app.stdout.on('data', chunk => { logs += chunk.toString(); });
  app.stderr.on('data', chunk => { logs += chunk.toString(); });
  t.after(async () => {
    if (app.exitCode === null) app.kill('SIGTERM');
    await new Promise(resolve => setTimeout(resolve, 100));
    await new Promise(resolve => provider.close(resolve));
    fs.rmSync(temp, { recursive: true, force: true });
  });
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`${localBase}/api/health`)).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.equal(ready, true, `server did not start. Logs: ${logs}`);

  let sessionCookie = '';
  let sessionCsrf = '';
  async function call(route, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (sessionCookie) headers.Cookie = sessionCookie;
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (sessionCsrf && (options.method || 'GET') !== 'GET') headers['X-CSRF-Token'] = sessionCsrf;
    const response = await fetch(`${localBase}${route}`, { method: options.method || 'GET', headers, body: options.body === undefined ? undefined : JSON.stringify(options.body) });
    const data = await response.json().catch(() => ({}));
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) sessionCookie = setCookie.split(';')[0];
    if (data.csrfToken) sessionCsrf = data.csrfToken;
    return { response, data };
  }

  const health = await call('/api/health');
  assert.equal(health.data.aiReady, true);
  const registered = await call('/api/auth/register', { method: 'POST', body: { email: 'sync@example.com', password: 'Another-strong-pass-123' } });
  assert.equal(registered.response.status, 201);
  const chat = await call('/api/chats', { method: 'POST', body: { mode: 'coding' } });
  assert.equal(chat.response.status, 201);
  const chatId2 = chat.data.chat.id;
  const sent = await call('/api/chat', { method: 'POST', body: { chatId: chatId2, message: 'Hello from the smoke test', mode: 'coding' } });
  assert.equal(sent.response.status, 200, JSON.stringify(sent.data));
  assert.equal(sent.data.reply, 'UJ AI test reply — server provider connected.');
  assert.equal(Object.hasOwn(sent.data, 'provider'), false, 'provider identity should not be returned to the app');
  assert.equal(providerRequests, 1);
  const messages = await call(`/api/chats/${chatId2}/messages`);
  assert.equal(messages.data.messages.length, 2);
  assert.equal(messages.data.messages[0].content, 'Hello from the smoke test');
  assert.equal(messages.data.messages[1].content, 'UJ AI test reply — server provider connected.');

  const privateSent = await call('/api/chat', { method: 'POST', body: {
    chatId: chatId2, message: 'This should stay temporary', mode: 'coding', privateMode: true
  } });
  assert.equal(privateSent.response.status, 200);
  assert.equal(privateSent.data.ephemeral, true);
  assert.equal(providerRequests, 2);
  assert.ok(providerMessages[1].some(item => item.content === 'This should stay temporary'));
  assert.ok(!providerMessages[1].some(item => item.content === 'Hello from the smoke test'), 'private requests must not send saved history to the provider');
  const afterPrivate = await call(`/api/chats/${chatId2}/messages`);
  assert.equal(afterPrivate.data.messages.length, 2, 'temporary messages must not be persisted');

  await call('/api/auth/logout', { method: 'POST', body: {} });
  sessionCookie = '';
  sessionCsrf = '';
  const signedInAgain = await call('/api/auth/login', { method: 'POST', body: { email: 'sync@example.com', password: 'Another-strong-pass-123' } });
  assert.equal(signedInAgain.response.status, 200);
  const restored = await call(`/api/chats/${chatId2}/messages`);
  assert.equal(restored.response.status, 200);
  assert.equal(restored.data.messages.length, 2, 'history should remain on the server after a new sign-in');
});

test('Google sign-in uses PKCE and rejects OAuth callbacks without the initiating browser binding', async t => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ujai-google-oauth-test-'));
  const port = await freePort();
  const localBase = `http://127.0.0.1:${port}`;
  const app = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: {
      PATH: process.env.PATH,
      PORT: String(port),
      NODE_ENV: 'test',
      DB_PATH: path.join(temp, 'google.sqlite'),
      PUBLIC_ORIGIN: localBase,
      GOOGLE_CLIENT_ID: 'test-client-id.apps.googleusercontent.com',
      GOOGLE_CLIENT_SECRET: 'test-client-secret'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let logs = '';
  app.stdout.on('data', chunk => { logs += chunk.toString(); });
  app.stderr.on('data', chunk => { logs += chunk.toString(); });
  t.after(async () => {
    if (app.exitCode === null) app.kill('SIGTERM');
    await new Promise(resolve => setTimeout(resolve, 100));
    fs.rmSync(temp, { recursive: true, force: true });
  });
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`${localBase}/api/health`)).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.equal(ready, true, `server did not start. Logs: ${logs}`);

  const health = await fetch(`${localBase}/api/health`).then(response => response.json());
  assert.equal(health.googleSignInAvailable, true);
  const start = await fetch(`${localBase}/api/auth/google`, { redirect: 'manual' });
  assert.equal(start.status, 302);
  const authorizationUrl = new URL(start.headers.get('location'));
  assert.equal(authorizationUrl.origin, 'https://accounts.google.com');
  assert.equal(authorizationUrl.searchParams.get('client_id'), 'test-client-id.apps.googleusercontent.com');
  assert.equal(authorizationUrl.searchParams.get('redirect_uri'), `${localBase}/api/auth/google/callback`);
  assert.equal(authorizationUrl.searchParams.get('response_type'), 'code');
  assert.deepEqual(authorizationUrl.searchParams.get('scope').split(' ').sort(), ['email', 'openid', 'profile']);
  assert.equal(authorizationUrl.searchParams.get('code_challenge_method'), 'S256');
  assert.match(authorizationUrl.searchParams.get('code_challenge'), /^[A-Za-z0-9_-]{43}$/);
  assert.match(authorizationUrl.searchParams.get('state'), /^[A-Za-z0-9_-]{43}$/);
  assert.ok(authorizationUrl.searchParams.get('nonce'));
  assert.equal(authorizationUrl.searchParams.has('client_secret'), false);

  const cookieHeader = start.headers.get('set-cookie');
  assert.match(cookieHeader, /HttpOnly/);
  assert.match(cookieHeader, /SameSite=Lax/);
  const browserCookie = cookieHeader.split(';')[0];
  const state = authorizationUrl.searchParams.get('state');
  const failCallback = query => fetch(`${localBase}/api/auth/google/callback?${query}`, {
    headers: { Cookie: browserCookie },
    redirect: 'manual'
  });

  const alteredState = `${state[0] === 'A' ? 'B' : 'A'}${state.slice(1)}`;
  const mismatch = await failCallback(new URLSearchParams({ state: alteredState, error: 'access_denied' }));
  assert.equal(mismatch.status, 303);
  assert.equal(mismatch.headers.get('location'), '/?google_auth=failed');

  const wrongBrowser = await fetch(`${localBase}/api/auth/google/callback?${new URLSearchParams({ state, error: 'access_denied' })}`, {
    headers: { Cookie: 'ujai_google_oauth=not-the-browser-binding' },
    redirect: 'manual'
  });
  assert.equal(wrongBrowser.status, 303);
  assert.match(wrongBrowser.headers.get('set-cookie'), /Max-Age=0/);

  const denied = await failCallback(new URLSearchParams({ state, error: 'access_denied' }));
  assert.equal(denied.status, 303);
  const replay = await failCallback(new URLSearchParams({ state, error: 'access_denied' }));
  assert.equal(replay.status, 303);
  assert.equal(replay.headers.get('location'), '/?google_auth=failed');
});

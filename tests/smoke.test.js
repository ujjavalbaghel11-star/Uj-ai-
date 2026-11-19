import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

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
    env: { PATH: process.env.PATH, PORT: String(port), NODE_ENV: 'test', DB_PATH: path.join(tempDir, 'test.sqlite') },
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
  assert.equal(health.data.imageGenerationReady, false);
  assert.equal(Object.hasOwn(health.data, 'providers'), false, 'provider identities should not be exposed');

  const shell = await fetch(`${baseUrl}/`);
  assert.equal(shell.status, 200);
  const shellHtml = await shell.text();
  assert.match(shellHtml, /UJ AI में स्वागत है/);
  assert.match(shellHtml, /data-mode=\"cybersecurity\"/);
  assert.match(shellHtml, /id=\"attachButton\"/);
  assert.match(shellHtml, /id="phoneControl"/);
  assert.match(shellHtml, /id="wakeButton"/);
  assert.match(shellHtml, /id="generateThemeImage"/);
  assert.match(shellHtml, /data-phone-action="youtube"/);
  const clientJs = await fetch(`${baseUrl}/app.js`);
  const clientSource = await clientJs.text();
  assert.match(clientSource, /function detectPhoneCommand/);
  assert.match(clientSource, /wakeWordArmed/);
  assert.match(clientSource, /UJ Wake/);
  assert.match(clientSource, /android\.settings\.WIFI_SETTINGS/);
  assert.match(clientSource, /android\.media\.action\.IMAGE_CAPTURE/);
  const manifest = await fetch(`${baseUrl}/manifest.webmanifest`);
  assert.equal(manifest.status, 200);
  assert.match(await manifest.text(), /"display": "standalone"/);
  assert.equal((await fetch(`${baseUrl}/icon-192.png`)).status, 200);

  const unauth = await request('/api/chats');
  assert.equal(unauth.response.status, 401);

  const register = await request('/api/auth/register', { method: 'POST', csrf: false, body: { email: 'tester@example.com', password: 'A-strong-test-pass-123' } });
  assert.equal(register.response.status, 201, JSON.stringify(register.data));
  assert.equal(register.data.authenticated, true);
  assert.ok(cookie.startsWith('ujai_session='));

  const session = await request('/api/auth/session');
  assert.equal(session.data.authenticated, true);
  assert.equal(session.data.user.email, 'tester@example.com');
  assert.ok(csrfToken.length > 10);
  const imageWithoutKey = await request('/api/theme/generate-image', { method: 'POST', body: { prompt: 'Jarvis blue futuristic background' } });
  assert.equal(imageWithoutKey.response.status, 503);
  assert.match(imageWithoutKey.data.error, /OPENAI_API_KEY/);

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

  const login = await request('/api/auth/login', { method: 'POST', csrf: false, body: { email: 'tester@example.com', password: 'A-strong-test-pass-123' } });
  assert.equal(login.response.status, 200);
  const syncedChats = await request('/api/chats');
  assert.equal(syncedChats.response.status, 200);
  assert.equal(syncedChats.data.chats.length, 3);
  assert.ok(syncedChats.data.chats.some(item => item.id === chatId), 'same account should see its saved chats after signing in again');
  assert.ok(syncedChats.data.chats.some(item => item.mode === 'cybersecurity'), 'cybersecurity chat mode should persist');
  assert.ok(syncedChats.data.chats.some(item => item.mode === 'folax'), 'Folax mode should persist');

  const voiceUnconfigured = await request('/api/voice/tts', { method: 'POST', body: { text: 'नमस्ते, मैं UJ हूँ।' } });
  assert.equal(voiceUnconfigured.response.status, 503, 'HeyGen TTS must stay unavailable until server credentials are configured');
  assert.match(voiceUnconfigured.data.error, /HeyGen voice/);
  const voiceTooLong = await request('/api/voice/tts', { method: 'POST', body: { text: 'x'.repeat(5001) } });
  assert.equal(voiceTooLong.response.status, 400, 'voice text must be length-limited');

  const passkeyStatus = await request('/api/auth/passkey/register/options', { method: 'POST', body: {} });
  if (!health.data.passkeysAvailable) assert.equal(passkeyStatus.response.status, 503);
 });


test('configured server-side provider replies are persisted and available to a second sign-in', async t => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ujai-provider-test-'));
  let providerRequests = 0;
  const provider = http.createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk.toString();
    const body = JSON.parse(raw || '{}');
    providerRequests += 1;
    assert.equal(req.url, '/v1/chat/completions');
    assert.equal(req.headers.authorization, 'Bearer test-only-key');
    assert.ok(Array.isArray(body.messages));
    assert.match(body.messages[0].content, /Emotional intelligence/i);
    assert.match(body.messages[0].content, /tentative/i);
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

  await call('/api/auth/logout', { method: 'POST', body: {} });
  sessionCookie = '';
  sessionCsrf = '';
  const signedInAgain = await call('/api/auth/login', { method: 'POST', body: { email: 'sync@example.com', password: 'Another-strong-pass-123' } });
  assert.equal(signedInAgain.response.status, 200);
  const restored = await call(`/api/chats/${chatId2}/messages`);
  assert.equal(restored.response.status, 200);
  assert.equal(restored.data.messages.length, 2, 'history should remain on the server after a new sign-in');
});

test('Gemini adapter and silent automatic fallback are exercised against local mock endpoints', async t => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ujai-gemini-test-'));
  let geminiRequests = 0;
  let fallbackRequests = 0;
  const gemini = http.createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk.toString();
    geminiRequests += 1;
    assert.match(req.url, /\/models\/gemini-test:generateContent$/);
    assert.equal(req.headers['x-goog-api-key'], 'gemini-test-key');
    const body = JSON.parse(raw || '{}');
    assert.ok(body.contents?.some(item => item.parts?.[0]?.text === 'Check Gemini adapter'));
    assert.match(body.systemInstruction?.parts?.[0]?.text || '', /Emotional intelligence/i);
    assert.match(body.systemInstruction?.parts?.[0]?.text || '', /tentative/i);
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { message: 'mock Gemini unavailable' } }));
  });
  const fallback = http.createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk.toString();
    fallbackRequests += 1;
    assert.equal(req.url, '/v1/chat/completions');
    assert.equal(req.headers.authorization, 'Bearer fallback-test-key');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ message: { content: 'UJ AI automatic fallback succeeded.' } }] }));
  });
  await new Promise(resolve => gemini.listen(0, '127.0.0.1', resolve));
  await new Promise(resolve => fallback.listen(0, '127.0.0.1', resolve));
  const port = await freePort();
  const localBase = `http://127.0.0.1:${port}`;
  const app = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: {
      PATH: process.env.PATH, PORT: String(port), NODE_ENV: 'test',
      DB_PATH: path.join(temp, 'gemini.sqlite'),
      GEMINI_API_KEY: 'gemini-test-key', GEMINI_MODEL: 'gemini-test',
      GEMINI_API_BASE_URL: `http://127.0.0.1:${gemini.address().port}/v1beta`,
      META_API_KEY: 'fallback-test-key',
      META_BASE_URL: `http://127.0.0.1:${fallback.address().port}/v1`,
      META_MODEL: 'fallback-model', UJ_AI_PROVIDER_ORDER: 'gemini,meta'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let logs = '';
  app.stdout.on('data', chunk => { logs += chunk.toString(); });
  app.stderr.on('data', chunk => { logs += chunk.toString(); });
  t.after(async () => {
    if (app.exitCode === null) app.kill('SIGTERM');
    await new Promise(resolve => setTimeout(resolve, 100));
    await new Promise(resolve => gemini.close(resolve));
    await new Promise(resolve => fallback.close(resolve));
    fs.rmSync(temp, { recursive: true, force: true });
  });
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`${localBase}/api/health`)).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.equal(ready, true, `server did not start. Logs: ${logs}`);
  let cookie = '';
  let csrf = '';
  async function call(route, options = {}) {
    const headers = {};
    if (cookie) headers.Cookie = cookie;
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (csrf && options.method && options.method !== 'GET') headers['X-CSRF-Token'] = csrf;
    const response = await fetch(`${localBase}${route}`, { method: options.method || 'GET', headers, body: options.body === undefined ? undefined : JSON.stringify(options.body) });
    const data = await response.json().catch(() => ({}));
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    if (data.csrfToken) csrf = data.csrfToken;
    return { response, data };
  }
  const register = await call('/api/auth/register', { method: 'POST', body: { email: 'gemini-fallback@example.com', password: 'Strong-test-pass-1234' } });
  assert.equal(register.response.status, 201);
  const chat = await call('/api/chats', { method: 'POST', body: { mode: 'personal' } });
  assert.equal(chat.response.status, 201);
  const sent = await call('/api/chat', { method: 'POST', body: { chatId: chat.data.chat.id, message: 'Check Gemini adapter', mode: 'personal' } });
  assert.equal(sent.response.status, 200, JSON.stringify(sent.data));
  assert.equal(sent.data.reply, 'UJ AI automatic fallback succeeded.');
  assert.equal(Object.hasOwn(sent.data, 'provider'), false);
  assert.equal(geminiRequests, 1);
  assert.equal(fallbackRequests, 1);
});

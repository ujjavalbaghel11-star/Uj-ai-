import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
async function freePort() {
  const server = net.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

test('native app CORS preflight is allowlisted and sessions use cross-site secure cookies', async t => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ujai-native-cors-'));
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const app = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: {
      PATH: process.env.PATH,
      PORT: String(port),
      NODE_ENV: 'test',
      DB_PATH: path.join(temp, 'native.sqlite'),
      PUBLIC_ORIGIN: baseUrl,
      NATIVE_ALLOWED_ORIGINS: 'https://localhost,capacitor://localhost'
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
    try { if ((await fetch(`${baseUrl}/api/health`)).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.equal(ready, true, `server did not start: ${logs}`);

  const preflight = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://localhost',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type,x-csrf-token'
    }
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), 'https://localhost');
  assert.equal(preflight.headers.get('access-control-allow-credentials'), 'true');
  assert.match(preflight.headers.get('access-control-allow-methods') || '', /POST/);

  const iosPreflight = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'capacitor://localhost',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type,x-csrf-token'
    }
  });
  assert.equal(iosPreflight.status, 204);
  assert.equal(iosPreflight.headers.get('access-control-allow-origin'), 'capacitor://localhost');
  assert.equal(iosPreflight.headers.get('access-control-allow-credentials'), 'true');

  const rejected = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://evil.example',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type'
    }
  });
  assert.equal(rejected.status, 403);

  const opaqueOrigin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'null',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type'
    }
  });
  assert.equal(opaqueOrigin.status, 403, 'opaque/null origins must never be allowlisted');

  const register = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { Origin: 'https://localhost', 'X-Forwarded-Proto': 'https', 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'native@example.com', password: 'A-strong-native-test-123' })
  });
  const registerBodyText = await register.text();
  assert.equal(register.status, 201, registerBodyText);
  assert.equal(register.headers.get('access-control-allow-origin'), 'https://localhost');
  const cookie = register.headers.get('set-cookie') || '';
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=None/);
  assert.match(cookie, /Secure/);
  const body = JSON.parse(registerBodyText);

  const session = await fetch(`${baseUrl}/api/auth/session`, {
    headers: { Origin: 'https://localhost', Cookie: cookie.split(';')[0], 'X-Forwarded-Proto': 'https' }
  });
  assert.equal(session.status, 200);
  assert.equal(session.headers.get('access-control-allow-origin'), 'https://localhost');
  const sessionBody = await session.json();
  assert.equal(sessionBody.authenticated, true);
  assert.equal(sessionBody.user.email, 'native@example.com');
  assert.ok(body.csrfToken.length > 10);

  const iosRegister = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { Origin: 'capacitor://localhost', 'X-Forwarded-Proto': 'https', 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'ios-native@example.com', password: 'A-strong-ios-test-123' })
  });
  assert.equal(iosRegister.status, 201);
  assert.equal(iosRegister.headers.get('access-control-allow-origin'), 'capacitor://localhost');
  const iosCookie = iosRegister.headers.get('set-cookie') || '';
  assert.match(iosCookie, /HttpOnly/);
  assert.match(iosCookie, /SameSite=None/);
  assert.match(iosCookie, /Secure/);
});

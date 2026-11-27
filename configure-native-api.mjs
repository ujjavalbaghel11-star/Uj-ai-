import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raw = String(process.env.UJ_API_BASE_URL || '').trim();
if (!raw) {
  console.error('Missing UJ_API_BASE_URL. Set the public HTTPS backend origin as a GitHub Actions repository variable.');
  process.exit(1);
}
let url;
try { url = new URL(raw); }
catch {
  console.error('UJ_API_BASE_URL must be a valid HTTPS URL.');
  process.exit(1);
}
if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
  console.error('UJ_API_BASE_URL must be an HTTPS origin only (no credentials, path, query or fragment).');
  process.exit(1);
}
const output = process.env.UJ_RUNTIME_CONFIG_OUTPUT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/runtime-config.js');
const content = `window.UJ_RUNTIME_CONFIG = Object.freeze({ apiBaseUrl: ${JSON.stringify(url.origin)}, nativeApp: true });\n`;
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, content, { mode: 0o644 });
console.log(`Configured native UJ AI API origin: ${url.origin}`);

# Patch contents

- `scripts/apply-native-api-patch.mjs` — anchored, idempotent source patcher for the current main branch.
- `scripts/configure-native-api.mjs` — validates public HTTPS backend URL and writes native runtime config; no secrets.
- `public/runtime-config.js` — safe PWA default (same-origin, nativeApp false).
- `tests/native-api.test.js` — API routing, config validation, Capacitor schemes, version/privacy and workflow checks.
- `tests/native-cors.test.js` — native Android/iOS preflight, allowlist, session-cookie and hostile-origin integration tests for the full server.
- `README_PATCH_HI.md`, `CROSS_PLATFORM_NATIVE_SETUP_HI.md`, `VERIFICATION.txt` — Hindi apply and verification instructions.

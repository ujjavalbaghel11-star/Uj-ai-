import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

test('native Android assistant bridge and role declaration are present', () => {
  const manifest = readFileSync(new URL('../android/app/src/main/AndroidManifest.xml', import.meta.url), 'utf8');
  const plugin = readFileSync(new URL('../android/app/src/main/java/com/ujai/app/UJNativePlugin.java', import.meta.url), 'utf8');
  const service = readFileSync(new URL('../android/app/src/main/java/com/ujai/app/UJVoiceInteractionService.java', import.meta.url), 'utf8');
  assert.match(manifest, /android\.service\.voice\.VoiceInteractionService/);
  assert.match(manifest, /BIND_VOICE_INTERACTION/);
  assert.match(plugin, /requestAssistantRole/);
  assert.match(plugin, /ROLE_ASSISTANT/);
  assert.match(plugin, /openPhoneTarget/);
  assert.match(service, /extends VoiceInteractionService/);
  assert.equal(existsSync(new URL('../android/app/src/main/java/com/ujai/app/UJVoiceInteractionSessionService.java', import.meta.url)), true);
});


test('native assistant panel is visible and app version matches project', () => {
  const gradle = readFileSync(new URL('../android/app/build.gradle', import.meta.url), 'utf8');
  const session = readFileSync(new URL('../android/app/src/main/java/com/ujai/app/UJVoiceInteractionSessionService.java', import.meta.url), 'utf8');
  assert.match(gradle, /versionName '3\.2\.12-native-preview'/);
  assert.match(session, /onCreateContentView/);
  assert.match(session, /UJ AI खोलें/);
  assert.match(session, /startActivity/);
});


test('original UJ background asset is packaged and applied to the chat shell', () => {
  const css = readFileSync(new URL('../public/app.css', import.meta.url), 'utf8');
  const image = new URL('../public/images/uj-background.png', import.meta.url);
  assert.equal(existsSync(image), true);
  assert.match(css, /url\([\"']?\/images\/uj-background\.png/);
  assert.match(css, /linear-gradient\(rgba\(7,12,27/);
});

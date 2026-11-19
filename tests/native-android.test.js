import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Capacitor Android shell is configured for the UJ AI app', () => {
  const manifest = readFileSync(new URL('../android/app/src/main/AndroidManifest.xml', import.meta.url), 'utf8');
  const activity = readFileSync(new URL('../android/app/src/main/java/com/ujai/app/MainActivity.java', import.meta.url), 'utf8');
  const gradle = readFileSync(new URL('../android/app/build.gradle', import.meta.url), 'utf8');

  assert.match(manifest, /android\.permission\.INTERNET/);
  assert.match(manifest, /android\.permission\.RECORD_AUDIO/);
  assert.doesNotMatch(manifest, /android\.permission\.(?:CAMERA|POST_NOTIFICATIONS|REQUEST_INSTALL_PACKAGES|READ_MEDIA|WRITE_EXTERNAL_STORAGE)/);
  assert.match(manifest, /android\.intent\.action\.MAIN/);
  assert.match(activity, /extends BridgeActivity/);
  assert.match(gradle, /applicationId "com\.ujai\.app"/);
  assert.match(gradle, /versionCode 331/);
  assert.match(gradle, /versionName "3\.3\.0"/);
});

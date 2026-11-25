import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('all AI provider prompts enforce same-language replies and spelling', () => {
  const source = fs.readFileSync(new URL('./server.js', import.meta.url), 'utf8');
  assert.match(source, /const LANGUAGE_POLICY =/);
  assert.match(source, /same language and writing system used in the user's latest message/);
  assert.match(source, /correctly spelled English only/);
  assert.match(source, /Hinglish\/Romanized Hindi/);
  assert.equal((source.match(/\$\{LANGUAGE_POLICY\}/g) || []).length, 2);
  assert.match(source, /version: '3\.2\.17'/);
});

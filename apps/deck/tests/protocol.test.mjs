import test from 'node:test';
import assert from 'node:assert/strict';
import { createCommand, validateAction } from '../js/core/protocol.js';

test('supported actions validate', () => {
  assert.equal(validateAction({type:'open_url', url:'https://example.com'}), true);
  assert.equal(validateAction({type:'launch_app', path:'C:\\App\\app.exe', args:[]}), true);
  assert.equal(validateAction({type:'hotkey', keys:['CTRL','SHIFT','K']}), true);
  assert.equal(validateAction({type:'media', key:'play_pause'}), true);
  assert.equal(validateAction({type:'system', key:'lock'}), true);
  assert.equal(validateAction({type:'integration', service:'browser', command:'new_tab', params:{}}), true);
});

test('shell action is not supported', () => {
  assert.throws(() => validateAction({type:'shell', command:'format c:'}));
});

test('command gets timestamp and id', () => {
  const cmd = createCommand({type:'media', key:'next'}, 'abc');
  assert.equal(cmd.type, 'command');
  assert.equal(cmd.id, 'abc');
  assert.equal(cmd.body.action.key, 'next');
  assert.equal(typeof cmd.ts, 'number');
});

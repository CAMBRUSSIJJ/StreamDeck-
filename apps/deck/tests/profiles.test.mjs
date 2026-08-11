import test from 'node:test';
import assert from 'node:assert/strict';
import { findMatchingPage, normalizeActiveApp, normalizeProfile, pageMatchesApp, profileAppsText } from '../public/js/core/profiles.js';

test('normalizeProfile cleans executable names and removes duplicates', () => {
  const profile = normalizeProfile({ enabled:true, apps:['C:\\Apps\\Obsidian.EXE', 'obsidian.exe', ' Code.exe '] });
  assert.deepEqual(profile, { enabled:true, apps:['obsidian.exe', 'code.exe'] });
});

test('disabled or empty profiles never match', () => {
  assert.equal(pageMatchesApp({ profile:{ enabled:false, apps:['obsidian.exe'] } }, { processName:'obsidian.exe' }), false);
  assert.equal(pageMatchesApp({ profile:{ enabled:true, apps:[] } }, { processName:'obsidian.exe' }), false);
});

test('active app matches profile case-insensitively', () => {
  const page = { id:'work', profile:{ enabled:true, apps:['obsidian.exe','code.exe'] } };
  assert.equal(pageMatchesApp(page, { processName:'OBSIDIAN.EXE' }), true);
  assert.equal(pageMatchesApp(page, { processName:'chrome.exe' }), false);
});

test('findMatchingPage respects page order', () => {
  const pages = [
    { id:'one', profile:{ enabled:true, apps:['chrome.exe'] } },
    { id:'two', profile:{ enabled:true, apps:['chrome.exe'] } }
  ];
  assert.equal(findMatchingPage(pages, { processName:'chrome.exe' }).id, 'one');
});

test('normalizeActiveApp accepts process path and profileAppsText is portable', () => {
  assert.equal(normalizeActiveApp({ processPath:'C:\\Program Files\\Code\\Code.exe' }).processName, 'code.exe');
  assert.equal(profileAppsText({ profile:{ enabled:true, apps:['Code.exe','OBS64.EXE'] } }), 'code.exe, obs64.exe');
});

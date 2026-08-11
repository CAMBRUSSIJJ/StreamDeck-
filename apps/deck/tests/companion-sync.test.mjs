import test from 'node:test';
import assert from 'node:assert/strict';
import { companionIsFresh, connectionQuality, integrationRollup, mediaSummary, normalizeCompanionStatus } from '../js/core/companion-sync.js';

test('normalizes audio and Spotify companion state', () => {
  const status = normalizeCompanionStatus({
    online:true, hostname:'DESKTOP', version:'1.7.0',
    audio:{available:true, volumePercent:47.6, muted:true},
    integrations:{ spotify:{connected:true, configured:true, state:{playing:true, track:'Midnight City', artist:'M83', progressMs:1234}} }
  }, {latencyMs:8, seenAt:1000, transport:'local'});
  assert.equal(status.audio.volumePercent, 48);
  assert.equal(status.audio.muted, true);
  assert.equal(status.spotify.track, 'Midnight City');
  assert.equal(status.spotify.playing, true);
  assert.equal(status.transport, 'local');
});

test('companion freshness expires stale status', () => {
  assert.equal(companionIsFresh({online:true, seenAt:1000}, 10000, 12000), true);
  assert.equal(companionIsFresh({online:true, seenAt:1000}, 14001, 12000), false);
});

test('connection quality buckets latency', () => {
  assert.equal(connectionQuality({online:true, seenAt:1000, latencyMs:9}, 1000).id, 'excellent');
  assert.equal(connectionQuality({online:true, seenAt:1000, latencyMs:90}, 1000).id, 'fair');
  assert.equal(connectionQuality({online:false, seenAt:1000}, 1000).id, 'offline');
});

test('rolls up integration health', () => {
  const rollup = integrationRollup({integrations:{
    obs:{connected:true,configured:true,error:''},
    spotify:{connected:false,configured:true,error:'expired'},
    browser:{connected:true,configured:true,error:''}
  }});
  assert.deepEqual(rollup, {total:3, connected:2, configured:3, errors:1});
});

test('prefers Spotify metadata for media summary', () => {
  const summary = mediaSummary({spotify:{available:true,playing:false,track:'Song',artist:'Artist',progressMs:500}});
  assert.equal(summary.source, 'Spotify');
  assert.equal(summary.title, 'Song');
  assert.equal(summary.subtitle, 'Artist');
});

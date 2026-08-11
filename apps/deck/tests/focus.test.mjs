import test from 'node:test';
import assert from 'node:assert/strict';
import { focusActionLabel, focusServices, formatMediaTime, nextRepeatMode, normalizeFocusAction, normalizeSpotifyFocus, progressPercent } from '../public/js/core/focus.js';

test('Spotify continua disponível no App Focus V1.8', () => {
  assert.deepEqual(focusServices().map(item => item.id), ['spotify']);
  assert.equal(normalizeFocusAction({type:'focus',service:'x'}).service, 'spotify');
  assert.match(focusActionLabel({type:'focus',service:'spotify'}), /Spotify Focus/);
});

test('normaliza snapshot rico do Spotify', () => {
  const focus = normalizeSpotifyFocus({
    available:true, playing:true, progressMs:61000, repeat:'context', shuffle:true,
    track:{name:'Midnight City',artist:'M83',album:'Hurry Up',durationMs:244000,artworkUrl:'https://i.scdn.co/x',spotifyUrl:'https://open.spotify.com/track/x'},
    devices:[{id:'1',name:'Desktop',active:true,volumePercent:62}],
    queue:[{name:'Outro',artist:'M83',durationMs:200000}]
  });
  assert.equal(focus.track.name, 'Midnight City');
  assert.equal(focus.device.name, 'Desktop');
  assert.equal(focus.queue.length, 1);
  assert.equal(focus.repeat, 'context');
});

test('tempo, progresso e ciclo de repetição', () => {
  assert.equal(formatMediaTime(61000), '1:01');
  assert.equal(Math.round(progressPercent(500, 1000)), 50);
  assert.equal(nextRepeatMode('off'), 'context');
  assert.equal(nextRepeatMode('context'), 'track');
  assert.equal(nextRepeatMode('track'), 'off');
});

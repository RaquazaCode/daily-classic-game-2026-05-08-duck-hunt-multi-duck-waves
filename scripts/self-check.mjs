import assert from 'node:assert/strict';
import { advanceWithPilot } from '../src/autopilot.js';
import { createGame, renderGameToText } from '../src/game-core.js';

const game = createGame({ seed: 20260508 });
let snapshot = game.getState();

for (let index = 0; index < 220; index += 1) {
  snapshot = advanceWithPilot(game, 100);
  if (snapshot.wavesCleared >= 1 && snapshot.lastResolvedWaveSize >= 2) {
    break;
  }
}

assert.equal(snapshot.mode, 'running');
assert(snapshot.wavesCleared >= 1, 'self-check expected one cleared wave');
assert(snapshot.lastResolvedWaveSize >= 2, 'self-check expected a multi-duck wave clear');
assert(snapshot.score >= 350, 'self-check expected combo and wave bonus scoring');

const payload = JSON.parse(renderGameToText(snapshot));
assert.equal(typeof payload.accuracy, 'number');
assert.equal(typeof payload.waveNumber, 'number');

console.log(renderGameToText(snapshot));
console.log('self-check ok');

import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceWithPilot } from '../src/autopilot.js';
import { createGame, renderGameToText } from '../src/game-core.js';

test('pilot clears a multi-duck wave and grows the score', () => {
  const game = createGame({ seed: 20260508 });
  let snapshot = game.getState();

  for (let index = 0; index < 220; index += 1) {
    snapshot = advanceWithPilot(game, 100);
    if (snapshot.wavesCleared >= 1 && snapshot.lastResolvedWaveSize >= 2) {
      break;
    }
  }

  assert.equal(snapshot.mode, 'running');
  assert(snapshot.wavesCleared >= 1, 'expected at least one cleared wave');
  assert(snapshot.lastResolvedWaveSize >= 2, 'expected proof of a multi-duck wave');
  assert(snapshot.score >= 350, `expected score to reflect combo and clear bonus, got ${snapshot.score}`);
});

test('pause freezes time and reset restores the title state', () => {
  const game = createGame({ seed: 20260508 });
  advanceWithPilot(game, 1200);

  const live = game.getState();
  assert.equal(live.mode, 'running');

  game.togglePause();
  const pausedBefore = game.getState();
  game.advance(2000);
  const pausedAfter = game.getState();

  assert.equal(pausedAfter.elapsedMs, pausedBefore.elapsedMs);
  assert.deepEqual(pausedAfter.crosshair, pausedBefore.crosshair);

  game.reset();
  const reset = game.getState();
  assert.equal(reset.mode, 'title');
  assert.equal(reset.score, 0);
  assert.equal(reset.crosshair.row, 2);
  assert.equal(reset.crosshair.col, 6);
  assert(reset.bestScore >= live.score);
});

test('render_game_to_text exposes wave and accuracy proof fields', () => {
  const game = createGame({ seed: 20260508 });
  advanceWithPilot(game, 1600);
  const payload = JSON.parse(renderGameToText(game.getState()));

  assert.equal(typeof payload.mode, 'string');
  assert.equal(typeof payload.waveNumber, 'number');
  assert.equal(typeof payload.waveSize, 'number');
  assert.equal(typeof payload.accuracy, 'number');
  assert(Array.isArray(payload.ducks));
  assert(Array.isArray(payload.recentEvents));
});

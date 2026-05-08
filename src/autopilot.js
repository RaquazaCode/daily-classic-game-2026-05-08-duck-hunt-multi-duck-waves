import { FIXED_STEP_MS, PILOT_TICK_MS } from './game-core.js';

function pickTarget(state) {
  if (!state.ducks.length) {
    return null;
  }

  return [...state.ducks].sort((left, right) => {
    const leftEscape = left.dir > 0 ? 13 - left.col : left.col;
    const rightEscape = right.dir > 0 ? 13 - right.col : right.col;
    if (leftEscape !== rightEscape) {
      return leftEscape - rightEscape;
    }

    const leftDistance =
      Math.abs(left.row - state.crosshair.row) + Math.abs(left.col - state.crosshair.col);
    const rightDistance =
      Math.abs(right.row - state.crosshair.row) + Math.abs(right.col - state.crosshair.col);
    return leftDistance - rightDistance;
  })[0];
}

function pilotTick(game) {
  const state = game.getState();

  if (state.mode === 'title') {
    game.start();
    return;
  }

  if (state.mode === 'paused') {
    game.togglePause();
    return;
  }

  if (state.mode === 'gameover') {
    game.start();
    return;
  }

  if (state.pendingWaveMs > 0 || state.shotsRemaining === 0) {
    return;
  }

  const target = pickTarget(state);
  if (!target) {
    return;
  }

  if (state.crosshair.row < target.row) {
    game.input('down');
    return;
  }
  if (state.crosshair.row > target.row) {
    game.input('up');
    return;
  }
  if (state.crosshair.col < target.col) {
    game.input('right');
    return;
  }
  if (state.crosshair.col > target.col) {
    game.input('left');
    return;
  }

  game.fire();
}

export function advanceWithPilot(game, ms = PILOT_TICK_MS) {
  let remaining = Math.max(0, ms);

  while (remaining > 0) {
    const step = Math.min(FIXED_STEP_MS, remaining);
    pilotTick(game);
    game.advance(step);
    remaining -= step;
  }

  return game.getState();
}

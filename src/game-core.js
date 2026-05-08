export const COLS = 14;
export const ROWS = 8;
export const SKY_ROWS = 5;
export const CELL_SIZE = 52;
export const WORLD_WIDTH = COLS * CELL_SIZE;
export const WORLD_HEIGHT = ROWS * CELL_SIZE;
export const FIXED_STEP_MS = 50;
export const PILOT_TICK_MS = 100;
export const START_COL = 6;
export const START_ROW = 2;

const ESCAPE_LIMIT = 6;
const MAX_SHOTS = 3;
const NEXT_WAVE_DELAY_MS = 900;
const WAVE_PATTERN = [2, 1, 2, 3, 2, 3];
const BOB_PATTERNS = [
  [0, 1, 0, -1],
  [0, 0, 1, 0, -1],
  [1, 0, -1, 0],
  [0, -1, 0, 1],
];
const DUCK_COLORS = ['#f4d35e', '#f7a072', '#8bd3dd', '#b8f2e6', '#ffcad4'];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function normalizeSeed(seed) {
  if (typeof seed === 'number' && Number.isFinite(seed)) {
    return Math.abs(Math.trunc(seed)) || 1;
  }

  const text = String(seed ?? 'duck-hunt');
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0 || 1;
}

function nextRandom(state) {
  state.rngState = (Math.imul(state.rngState, 1664525) + 1013904223) >>> 0;
  return state.rngState / 4294967296;
}

function pushEvent(state, message) {
  state.recentEvents.push(message);
  if (state.recentEvents.length > 8) {
    state.recentEvents.shift();
  }
}

function syncBestScore(state) {
  state.bestScore = Math.max(state.bestScore, state.score);
}

function awardScore(state, points, message) {
  state.score += points;
  syncBestScore(state);
  if (message) {
    pushEvent(state, `${message} +${points}.`);
  }
}

function cloneDuck(duck) {
  return {
    id: duck.id,
    row: duck.row,
    col: duck.col,
    dir: duck.dir,
    intervalMs: duck.intervalMs,
    progressMs: duck.progressMs,
    bobIndex: duck.bobIndex,
    bobPattern: [...duck.bobPattern],
    color: duck.color,
    points: duck.points,
  };
}

export function cloneState(state) {
  const accuracy = state.totalShots ? round(state.hits / state.totalShots) : 1;

  return {
    seed: state.seed,
    rngState: state.rngState,
    mode: state.mode,
    elapsedMs: state.elapsedMs,
    score: state.score,
    bestScore: state.bestScore,
    waveNumber: state.waveNumber,
    waveSize: state.waveSize,
    wavesResolved: state.wavesResolved,
    wavesCleared: state.wavesCleared,
    perfectWaves: state.perfectWaves,
    ducksCleared: state.ducksCleared,
    escapedDucks: state.escapedDucks,
    shotsRemaining: state.shotsRemaining,
    totalShots: state.totalShots,
    hits: state.hits,
    accuracy,
    combo: state.combo,
    maxCombo: state.maxCombo,
    pendingWaveMs: state.pendingWaveMs,
    fleeMode: state.fleeMode,
    waveEscapes: state.waveEscapes,
    currentWaveHits: state.currentWaveHits,
    currentWaveShots: state.currentWaveShots,
    waveResolved: state.waveResolved,
    lastResolvedWaveSize: state.lastResolvedWaveSize,
    lastWaveBonus: state.lastWaveBonus,
    statusLine: state.statusLine,
    crosshair: {
      row: state.crosshair.row,
      col: state.crosshair.col,
    },
    ducks: state.ducks.map(cloneDuck),
    recentEvents: [...state.recentEvents],
  };
}

function createFreshState(seed, sessionBestScore = 0) {
  return {
    seed,
    rngState: normalizeSeed(seed),
    mode: 'title',
    elapsedMs: 0,
    score: 0,
    bestScore: sessionBestScore,
    waveNumber: 0,
    waveSize: 0,
    wavesResolved: 0,
    wavesCleared: 0,
    perfectWaves: 0,
    ducksCleared: 0,
    escapedDucks: 0,
    shotsRemaining: MAX_SHOTS,
    totalShots: 0,
    hits: 0,
    combo: 0,
    maxCombo: 0,
    pendingWaveMs: 0,
    fleeMode: false,
    waveEscapes: 0,
    currentWaveHits: 0,
    currentWaveShots: 0,
    waveResolved: true,
    lastResolvedWaveSize: 0,
    lastWaveBonus: 0,
    statusLine: 'Press Start. Space fires once the run is live.',
    crosshair: {
      row: START_ROW,
      col: START_COL,
    },
    ducks: [],
    recentEvents: [
      'Press Start or Space to launch the hunt.',
      'Move with arrows or WASD.',
      'Each wave has three shells. P pauses and R resets.',
    ],
  };
}

function pickWaveSize(state) {
  return WAVE_PATTERN[state.waveNumber % WAVE_PATTERN.length];
}

function pickRows(state, waveSize) {
  const rows = Array.from({ length: SKY_ROWS }, (_, index) => index);
  for (let index = rows.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(nextRandom(state) * (index + 1));
    const current = rows[index];
    rows[index] = rows[swapIndex];
    rows[swapIndex] = current;
  }
  return rows.slice(0, waveSize);
}

function createDuck(state, waveSize, duckIndex, row) {
  const fromLeft = (state.waveNumber + duckIndex) % 2 === 0;
  const dir = fromLeft ? 1 : -1;
  const cadenceFloor = Math.max(130, 250 - Math.floor((state.waveNumber - 1) / 2) * 14);
  const intervalMs = cadenceFloor + duckIndex * 16;
  const bobPattern = BOB_PATTERNS[(state.waveNumber + duckIndex) % BOB_PATTERNS.length];

  return {
    id: `${state.waveNumber}-${duckIndex + 1}`,
    row,
    col: fromLeft ? 0 : COLS - 1,
    dir,
    intervalMs,
    progressMs: 0,
    bobIndex: 0,
    bobPattern: [...bobPattern],
    color: DUCK_COLORS[(state.waveNumber + duckIndex) % DUCK_COLORS.length],
    points: 100 + (waveSize - 1) * 30,
  };
}

function spawnWave(state) {
  state.waveNumber += 1;
  state.waveSize = pickWaveSize(state);
  state.waveEscapes = 0;
  state.currentWaveHits = 0;
  state.currentWaveShots = 0;
  state.waveResolved = false;
  state.lastResolvedWaveSize = 0;
  state.lastWaveBonus = 0;
  state.pendingWaveMs = 0;
  state.fleeMode = false;
  state.shotsRemaining = MAX_SHOTS;
  state.combo = 0;

  const rows = pickRows(state, state.waveSize);
  state.ducks = rows.map((row, index) => createDuck(state, state.waveSize, index, row));
  state.statusLine = `Wave ${state.waveNumber}: ${state.waveSize} ducks inbound.`;
  pushEvent(state, `Wave ${state.waveNumber} launched with ${state.waveSize} ducks.`);
}

function resolveWaveIfFinished(state) {
  if (state.waveResolved || state.ducks.length > 0) {
    return;
  }

  state.waveResolved = true;
  state.wavesResolved += 1;
  state.lastResolvedWaveSize = state.waveSize;

  if (state.currentWaveHits === state.waveSize) {
    state.wavesCleared += 1;
    const bonus = 40 + state.waveSize * 45 + state.shotsRemaining * 10;
    state.lastWaveBonus = bonus;
    awardScore(state, bonus, `Wave ${state.waveNumber} clean sweep`);
    if (state.waveEscapes === 0) {
      state.perfectWaves += 1;
    }
    state.statusLine = `Wave ${state.waveNumber} cleared. Next flock loading.`;
  } else {
    state.lastWaveBonus = 0;
    state.statusLine = `Wave ${state.waveNumber} slipped away.`;
    pushEvent(
      state,
      `Wave ${state.waveNumber} resolved with ${state.currentWaveHits}/${state.waveSize} ducks hit.`
    );
  }

  state.pendingWaveMs = state.mode === 'gameover' ? 0 : NEXT_WAVE_DELAY_MS;
}

function setGameOver(state, reason) {
  if (state.mode === 'gameover') {
    return;
  }
  syncBestScore(state);
  state.mode = 'gameover';
  state.pendingWaveMs = 0;
  state.statusLine = reason;
  pushEvent(state, `${reason} Press R to reset or Space to start again.`);
}

function moveCrosshair(state, deltaRow, deltaCol) {
  state.crosshair.row = clamp(state.crosshair.row + deltaRow, 0, SKY_ROWS - 1);
  state.crosshair.col = clamp(state.crosshair.col + deltaCol, 0, COLS - 1);
}

function removeDuckById(state, duckId) {
  state.ducks = state.ducks.filter((duck) => duck.id !== duckId);
}

function fireShot(state) {
  if (state.mode === 'title') {
    spawnWave(state);
    state.mode = 'running';
    state.statusLine = 'Run started. Track the flock and conserve shells.';
    return;
  }

  if (state.mode === 'gameover') {
    const bestScore = state.bestScore;
    Object.assign(state, createFreshState(state.seed, bestScore));
    spawnWave(state);
    state.mode = 'running';
    state.statusLine = 'Fresh run started.';
    return;
  }

  if (state.mode !== 'running' || state.waveResolved || state.ducks.length === 0) {
    return;
  }

  if (state.shotsRemaining <= 0) {
    pushEvent(state, 'Out of shells for this wave.');
    return;
  }

  state.shotsRemaining -= 1;
  state.totalShots += 1;
  state.currentWaveShots += 1;

  const target = state.ducks.find(
    (duck) => duck.row === state.crosshair.row && duck.col === state.crosshair.col
  );

  if (!target) {
    state.combo = 0;
    pushEvent(state, `Missed shot at (${state.crosshair.col}, ${state.crosshair.row}).`);
    if (state.shotsRemaining === 0 && state.ducks.length > 0) {
      state.fleeMode = true;
      state.statusLine = 'Empty chamber. Surviving ducks are fleeing.';
      pushEvent(state, 'The flock breaks hard after the final shell.');
    }
    return;
  }

  removeDuckById(state, target.id);
  state.hits += 1;
  state.ducksCleared += 1;
  state.currentWaveHits += 1;
  state.combo += 1;
  state.maxCombo = Math.max(state.maxCombo, state.combo);
  const comboBonus = Math.max(0, state.combo - 1) * 20;
  const totalPoints = target.points + comboBonus;
  awardScore(
    state,
    totalPoints,
    `Duck ${target.id} dropped with combo ${state.combo}`
  );
  state.statusLine = `${state.ducks.length} ducks left in wave ${state.waveNumber}.`;

  if (state.ducks.length === 0) {
    resolveWaveIfFinished(state);
  } else if (state.shotsRemaining === 0) {
    state.fleeMode = true;
    pushEvent(state, 'No shells left. The rest of the flock bolts.');
  }
}

function advanceDuck(state, duck, stepMs) {
  duck.progressMs += stepMs;
  const cadence = state.fleeMode ? Math.max(95, Math.floor(duck.intervalMs * 0.58)) : duck.intervalMs;

  while (duck.progressMs >= cadence) {
    duck.progressMs -= cadence;
    duck.col += duck.dir;
    const bobDelta = duck.bobPattern[duck.bobIndex % duck.bobPattern.length];
    duck.bobIndex += 1;
    duck.row = clamp(duck.row + bobDelta, 0, SKY_ROWS - 1);

    if (duck.col < 0 || duck.col >= COLS) {
      state.waveEscapes += 1;
      state.escapedDucks += 1;
      state.combo = 0;
      pushEvent(state, `Duck ${duck.id} escaped.`);
      if (state.escapedDucks >= ESCAPE_LIMIT) {
        removeDuckById(state, duck.id);
        setGameOver(state, 'Six ducks escaped. The marsh goes quiet.');
        return;
      }
      removeDuckById(state, duck.id);
      return;
    }
  }
}

function advanceRunning(state, deltaMs) {
  state.elapsedMs += deltaMs;

  if (state.pendingWaveMs > 0 && state.ducks.length === 0) {
    state.pendingWaveMs = Math.max(0, state.pendingWaveMs - deltaMs);
    if (state.pendingWaveMs === 0 && state.mode === 'running') {
      spawnWave(state);
    }
    return;
  }

  const ducks = [...state.ducks];
  for (const duck of ducks) {
    if (!state.ducks.find((candidate) => candidate.id === duck.id)) {
      continue;
    }
    advanceDuck(state, duck, deltaMs);
    if (state.mode === 'gameover') {
      return;
    }
  }

  if (state.ducks.length === 0) {
    resolveWaveIfFinished(state);
  }
}

export function renderGameToText(state) {
  const payload = {
    mode: state.mode,
    elapsedMs: state.elapsedMs,
    score: state.score,
    bestScore: state.bestScore,
    waveNumber: state.waveNumber,
    waveSize: state.waveSize,
    wavesResolved: state.wavesResolved,
    wavesCleared: state.wavesCleared,
    perfectWaves: state.perfectWaves,
    ducksCleared: state.ducksCleared,
    escapedDucks: state.escapedDucks,
    shotsRemaining: state.shotsRemaining,
    totalShots: state.totalShots,
    hits: state.hits,
    accuracy: state.totalShots ? round(state.hits / state.totalShots) : 1,
    combo: state.combo,
    maxCombo: state.maxCombo,
    pendingWaveMs: state.pendingWaveMs,
    fleeMode: state.fleeMode,
    waveEscapes: state.waveEscapes,
    currentWaveHits: state.currentWaveHits,
    currentWaveShots: state.currentWaveShots,
    lastResolvedWaveSize: state.lastResolvedWaveSize,
    lastWaveBonus: state.lastWaveBonus,
    statusLine: state.statusLine,
    crosshair: {
      row: state.crosshair.row,
      col: state.crosshair.col,
    },
    ducks: state.ducks.map((duck) => ({
      id: duck.id,
      row: duck.row,
      col: duck.col,
      dir: duck.dir,
      intervalMs: duck.intervalMs,
    })),
    recentEvents: [...state.recentEvents],
  };

  return JSON.stringify(payload, null, 2);
}

export function createGame({ seed = 20260508 } = {}) {
  let state = createFreshState(seed, 0);

  return {
    advance(ms) {
      let remaining = Math.max(0, ms);
      while (remaining > 0) {
        const step = Math.min(FIXED_STEP_MS, remaining);
        if (state.mode === 'running') {
          advanceRunning(state, step);
        }
        remaining -= step;
      }
      return cloneState(state);
    },
    input(action) {
      if (action === 'up') {
        moveCrosshair(state, -1, 0);
      } else if (action === 'down') {
        moveCrosshair(state, 1, 0);
      } else if (action === 'left') {
        moveCrosshair(state, 0, -1);
      } else if (action === 'right') {
        moveCrosshair(state, 0, 1);
      } else if (action === 'primary') {
        fireShot(state);
      } else if (action === 'start') {
        if (state.mode === 'title' || state.mode === 'gameover') {
          fireShot(state);
        }
      }
      return cloneState(state);
    },
    fire() {
      fireShot(state);
      return cloneState(state);
    },
    start() {
      if (state.mode === 'title' || state.mode === 'gameover') {
        fireShot(state);
      }
      return cloneState(state);
    },
    togglePause() {
      if (state.mode === 'running') {
        state.mode = 'paused';
        state.statusLine = 'Paused.';
        pushEvent(state, 'Paused.');
      } else if (state.mode === 'paused') {
        state.mode = 'running';
        state.statusLine = 'Back on target.';
        pushEvent(state, 'Resumed.');
      }
      return cloneState(state);
    },
    reset() {
      const bestScore = state.bestScore;
      state = createFreshState(state.seed, bestScore);
      return cloneState(state);
    },
    getState() {
      return cloneState(state);
    },
  };
}

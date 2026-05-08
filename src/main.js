import './style.css';
import {
  CELL_SIZE,
  COLS,
  ROWS,
  SKY_ROWS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  createGame,
  renderGameToText,
} from './game-core.js';
import { advanceWithPilot } from './autopilot.js';

const params = new URLSearchParams(window.location.search);
const manualClock = params.get('manual_clock') === '1';
const scriptedDemo = params.get('scripted_demo') === '1';
const game = createGame({ seed: 20260508 });

const app = document.querySelector('#app');
app.innerHTML = `
  <main class="page-shell">
    <section class="hero-panel">
      <div class="hero-copy">
        <p class="eyebrow">Daily Classic Game · 2026-05-08</p>
        <h1>Duck Hunt: Multi-Duck Waves</h1>
        <p class="lede">
          A deterministic marsh shooter where each round can spawn a whole flock instead of a single easy target.
        </p>
        <div class="pill-row">
          <span class="pill">Arrows / WASD aim</span>
          <span class="pill">Space fires</span>
          <span class="pill">P pause</span>
          <span class="pill">R reset</span>
        </div>
      </div>
      <div class="stage-panel">
        <canvas id="game-canvas" width="${WORLD_WIDTH}" height="${WORLD_HEIGHT}" aria-label="Duck Hunt multi-duck waves board"></canvas>
      </div>
    </section>

    <section class="meta-grid">
      <article class="panel">
        <h2>Scoreboard</h2>
        <dl class="stat-grid">
          <div><dt>Mode</dt><dd id="mode-value">title</dd></div>
          <div><dt>Score</dt><dd id="score-value">0</dd></div>
          <div><dt>Best</dt><dd id="best-value">0</dd></div>
          <div><dt>Wave</dt><dd id="wave-value">0</dd></div>
          <div><dt>Shells</dt><dd id="shots-value">3</dd></div>
          <div><dt>Escapes</dt><dd id="escapes-value">0 / 6</dd></div>
          <div><dt>Clears</dt><dd id="clears-value">0</dd></div>
          <div><dt>Accuracy</dt><dd id="accuracy-value">100%</dd></div>
        </dl>
      </article>

      <article class="panel">
        <h2>Controls</h2>
        <div class="controls-grid">
          <button type="button" data-action="start">Start</button>
          <button type="button" data-action="fire">Fire</button>
          <button type="button" data-action="pause">Pause</button>
          <button type="button" data-action="reset">Reset</button>
          <button type="button" data-action="up">Up</button>
          <button type="button" data-action="left">Left</button>
          <button type="button" data-action="down">Down</button>
          <button type="button" data-action="right">Right</button>
        </div>
        <p id="status-line" class="panel-note"></p>
      </article>

      <article class="panel">
        <h2>Deterministic Proof</h2>
        <pre id="proof-output"></pre>
      </article>

      <article class="panel panel-wide">
        <h2>Event Feed</h2>
        <ul id="event-feed" class="event-feed"></ul>
      </article>
    </section>
  </main>
`;

const canvas = document.querySelector('#game-canvas');
const ctx = canvas.getContext('2d');
const modeValue = document.querySelector('#mode-value');
const scoreValue = document.querySelector('#score-value');
const bestValue = document.querySelector('#best-value');
const waveValue = document.querySelector('#wave-value');
const shotsValue = document.querySelector('#shots-value');
const escapesValue = document.querySelector('#escapes-value');
const clearsValue = document.querySelector('#clears-value');
const accuracyValue = document.querySelector('#accuracy-value');
const statusLine = document.querySelector('#status-line');
const proofOutput = document.querySelector('#proof-output');
const eventFeed = document.querySelector('#event-feed');

function drawRoundedRect(x, y, width, height, radius, fillStyle, strokeStyle = null) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fillStyle = fillStyle;
  ctx.fill();
  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, WORLD_HEIGHT);
  sky.addColorStop(0, '#ffe5a6');
  sky.addColorStop(0.4, '#9dd9d2');
  sky.addColorStop(1, '#285943');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  for (let index = 0; index < 4; index += 1) {
    const cloudX = 40 + index * 170;
    const cloudY = 32 + (index % 2) * 24;
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(cloudX, cloudY, 38, 20, 0, 0, Math.PI * 2);
    ctx.ellipse(cloudX + 30, cloudY - 6, 34, 22, 0, 0, Math.PI * 2);
    ctx.ellipse(cloudX + 60, cloudY + 2, 30, 18, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const marshTop = SKY_ROWS * CELL_SIZE;
  const marsh = ctx.createLinearGradient(0, marshTop, 0, WORLD_HEIGHT);
  marsh.addColorStop(0, '#6a994e');
  marsh.addColorStop(1, '#386641');
  ctx.fillStyle = marsh;
  ctx.fillRect(0, marshTop, WORLD_WIDTH, WORLD_HEIGHT - marshTop);

  ctx.fillStyle = '#24472f';
  ctx.fillRect(0, marshTop - 18, WORLD_WIDTH, 18);

  for (let col = 0; col < COLS; col += 1) {
    const x = col * CELL_SIZE;
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, WORLD_HEIGHT);
    ctx.stroke();
  }

  for (let row = 0; row <= ROWS; row += 1) {
    const y = row * CELL_SIZE;
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WORLD_WIDTH, y);
    ctx.stroke();
  }

  for (let index = 0; index < 20; index += 1) {
    const reedX = 16 + index * 36;
    const reedHeight = 24 + (index % 4) * 8;
    ctx.strokeStyle = '#183a1d';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(reedX, WORLD_HEIGHT - 12);
    ctx.lineTo(reedX + (index % 2 === 0 ? -4 : 4), WORLD_HEIGHT - 12 - reedHeight);
    ctx.stroke();
  }
}

function drawDuck(duck) {
  const x = duck.col * CELL_SIZE + CELL_SIZE / 2;
  const y = duck.row * CELL_SIZE + CELL_SIZE / 2;
  const wingOffset = duck.bobIndex % 2 === 0 ? -6 : 6;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.14)';
  ctx.beginPath();
  ctx.ellipse(x, y + 18, 20, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = duck.color;
  ctx.beginPath();
  ctx.ellipse(x, y, 20, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#214e34';
  ctx.beginPath();
  ctx.ellipse(x - 6, y - 10, 12, 7, wingOffset * 0.02, 0, Math.PI * 2);
  ctx.ellipse(x + 4, y - 6, 10, 6, -wingOffset * 0.02, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#fff2cc';
  ctx.beginPath();
  ctx.arc(x + 12, y - 2, 7, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#2f1b0c';
  ctx.beginPath();
  ctx.arc(x + 14, y - 4, 1.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ff9f1c';
  ctx.beginPath();
  ctx.moveTo(x + 18, y - 1);
  ctx.lineTo(x + 28, y + 2);
  ctx.lineTo(x + 18, y + 5);
  ctx.closePath();
  ctx.fill();
}

function drawCrosshair(snapshot) {
  const x = snapshot.crosshair.col * CELL_SIZE + CELL_SIZE / 2;
  const y = snapshot.crosshair.row * CELL_SIZE + CELL_SIZE / 2;
  ctx.strokeStyle = '#d90429';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, 19, 0, Math.PI * 2);
  ctx.moveTo(x - 26, y);
  ctx.lineTo(x - 8, y);
  ctx.moveTo(x + 8, y);
  ctx.lineTo(x + 26, y);
  ctx.moveTo(x, y - 26);
  ctx.lineTo(x, y - 8);
  ctx.moveTo(x, y + 8);
  ctx.lineTo(x, y + 26);
  ctx.stroke();
}

function drawShells(snapshot) {
  const y = SKY_ROWS * CELL_SIZE + 28;
  for (let index = 0; index < 3; index += 1) {
    const x = 30 + index * 32;
    drawRoundedRect(
      x,
      y,
      18,
      34,
      9,
      index < snapshot.shotsRemaining ? '#ffd166' : 'rgba(255,255,255,0.16)',
      'rgba(0,0,0,0.18)'
    );
    ctx.fillStyle = index < snapshot.shotsRemaining ? '#7c3f00' : 'rgba(255,255,255,0.12)';
    ctx.fillRect(x + 3, y + 4, 12, 7);
  }
}

function drawOverlay(snapshot) {
  if (snapshot.mode === 'running') {
    return;
  }

  ctx.fillStyle = 'rgba(7, 14, 10, 0.58)';
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  ctx.fillStyle = '#fff6df';
  ctx.textAlign = 'center';
  ctx.font = '700 38px "Avenir Next Condensed", "Trebuchet MS", sans-serif';
  const title =
    snapshot.mode === 'title'
      ? 'Press Start'
      : snapshot.mode === 'paused'
        ? 'Paused'
        : 'Marsh Quiet';
  ctx.fillText(title, WORLD_WIDTH / 2, WORLD_HEIGHT / 2 - 18);
  ctx.font = '500 18px "Avenir Next", "Trebuchet MS", sans-serif';
  ctx.fillText(snapshot.statusLine, WORLD_WIDTH / 2, WORLD_HEIGHT / 2 + 18);
}

function drawBoard(snapshot) {
  drawBackground();

  for (const duck of snapshot.ducks) {
    drawDuck(duck);
  }

  drawCrosshair(snapshot);
  drawShells(snapshot);
  drawOverlay(snapshot);
}

function updateDom(snapshot) {
  modeValue.textContent = snapshot.mode;
  scoreValue.textContent = String(snapshot.score);
  bestValue.textContent = String(snapshot.bestScore);
  waveValue.textContent = String(snapshot.waveNumber);
  shotsValue.textContent = String(snapshot.shotsRemaining);
  escapesValue.textContent = `${snapshot.escapedDucks} / 6`;
  clearsValue.textContent = `${snapshot.wavesCleared} clear, ${snapshot.perfectWaves} perfect`;
  accuracyValue.textContent = `${Math.round(snapshot.accuracy * 100)}%`;
  statusLine.textContent = snapshot.statusLine;
  proofOutput.textContent = renderGameToText(snapshot);
  eventFeed.innerHTML = snapshot.recentEvents
    .slice()
    .reverse()
    .map((item) => `<li>${item}</li>`)
    .join('');
}

function render() {
  const snapshot = game.getState();
  drawBoard(snapshot);
  updateDom(snapshot);
}

function performAction(action) {
  if (action === 'reset') {
    game.reset();
  } else if (action === 'pause') {
    game.togglePause();
  } else if (action === 'fire') {
    game.fire();
  } else if (action === 'start') {
    game.start();
  } else {
    game.input(action);
  }
  render();
}

document.querySelectorAll('[data-action]').forEach((button) => {
  button.addEventListener('click', () => {
    performAction(button.dataset.action);
  });
});

window.addEventListener('keydown', (event) => {
  const actionMap = {
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right',
    KeyW: 'up',
    KeyS: 'down',
    KeyA: 'left',
    KeyD: 'right',
    Space: 'fire',
    Enter: 'start',
    KeyP: 'pause',
    KeyR: 'reset',
  };

  const action = actionMap[event.code];
  if (!action) {
    return;
  }

  event.preventDefault();
  performAction(action);
});

function advanceGame(ms) {
  if (scriptedDemo) {
    advanceWithPilot(game, ms);
  } else {
    game.advance(ms);
  }
  render();
}

window.advanceTime = (ms) => {
  advanceGame(ms);
};

window.render_game_to_text = () => renderGameToText(game.getState());

render();

if (!manualClock) {
  let previous = performance.now();

  function frame(now) {
    const delta = Math.min(now - previous, 160);
    previous = now;
    advanceGame(delta);
    window.requestAnimationFrame(frame);
  }

  window.requestAnimationFrame(frame);
}

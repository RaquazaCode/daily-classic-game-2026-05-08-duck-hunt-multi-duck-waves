import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const root = process.cwd();
const outDir = path.join(root, 'artifacts', 'playwright');
const gifDir = path.join(root, 'assets', 'gifs');

mkdirSync(outDir, { recursive: true });
mkdirSync(gifDir, { recursive: true });

const server = spawn('pnpm', ['dev', '--host', '127.0.0.1', '--port', '4173'], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'pipe'],
});

let ready = false;
const logs = [];

function collect(chunk) {
  const text = chunk.toString();
  logs.push(text);
  if (text.includes('http://127.0.0.1:4173')) {
    ready = true;
  }
}

server.stdout.on('data', collect);
server.stderr.on('data', collect);

async function waitReady(timeoutMs = 30000) {
  const startedAt = Date.now();
  while (!ready) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error('dev server did not become ready in time');
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

function writeJson(fileName, payload) {
  writeFileSync(path.join(outDir, fileName), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

async function getState(page) {
  return JSON.parse(await page.evaluate(() => window.render_game_to_text()));
}

async function advanceUntil(page, predicate, { stepMs = 100, maxSteps = 220 } = {}) {
  for (let index = 0; index < maxSteps; index += 1) {
    const state = await getState(page);
    if (predicate(state)) {
      return state;
    }
    await page.evaluate((ms) => {
      window.advanceTime(ms);
    }, stepMs);
  }

  throw new Error('advanceUntil predicate was not met');
}

function createGif(framesDir, outputFile) {
  const result = spawnSync(
    'ffmpeg',
    [
      '-y',
      '-framerate',
      '8',
      '-i',
      path.join(framesDir, 'frame-%02d.png'),
      '-vf',
      'scale=960:-1:flags=lanczos',
      outputFile,
    ],
    { encoding: 'utf8' }
  );

  if (result.status !== 0) {
    throw new Error(`ffmpeg failed for ${outputFile}: ${result.stderr || result.stdout}`);
  }
}

async function captureFrames(page, clipName, frameCount, advanceMs) {
  const framesDir = path.join(outDir, `frames-${clipName}`);
  rmSync(framesDir, { recursive: true, force: true });
  mkdirSync(framesDir, { recursive: true });

  for (let index = 0; index < frameCount; index += 1) {
    await page.evaluate((ms) => {
      window.advanceTime(ms);
    }, advanceMs);
    await page.screenshot({
      path: path.join(framesDir, `frame-${String(index).padStart(2, '0')}.png`),
      fullPage: true,
    });
  }

  return framesDir;
}

(async () => {
  let browser;
  try {
    await waitReady();
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1500, height: 1200 } });
    const url =
      process.env.WEB_GAME_URL ?? 'http://127.0.0.1:4173/?scripted_demo=1&manual_clock=1';

    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => typeof window.advanceTime === 'function');
    await page.waitForFunction(() => typeof window.render_game_to_text === 'function');

    await page.screenshot({ path: path.join(outDir, 'shot-0.png'), fullPage: true });
    writeFileSync(path.join(outDir, 'render-start.txt'), `${await page.evaluate(() => window.render_game_to_text())}\n`, 'utf8');

    const openingFrames = await captureFrames(page, 'opening-wave', 9, 130);
    const clearedState = await advanceUntil(
      page,
      (state) => state.wavesCleared >= 1 && state.lastResolvedWaveSize >= 2,
      { stepMs: 100, maxSteps: 220 }
    );
    await page.screenshot({ path: path.join(outDir, 'shot-1.png'), fullPage: true });
    writeJson('state-1.json', clearedState);

    const cleanSweepFrames = await captureFrames(page, 'clean-sweep', 8, 110);
    const scoreState = await advanceUntil(page, (state) => state.score >= 500 && state.ducksCleared >= 3, {
      stepMs: 100,
      maxSteps: 180,
    });
    await page.screenshot({ path: path.join(outDir, 'shot-2.png'), fullPage: true });
    writeJson('state-2.json', scoreState);

    await page.keyboard.press('KeyP');
    const pauseFrames = await captureFrames(page, 'pause-reset', 4, 60);
    await page.keyboard.press('KeyR');

    const resetFrames = path.join(outDir, 'frames-reset-title');
    rmSync(resetFrames, { recursive: true, force: true });
    mkdirSync(resetFrames, { recursive: true });
    for (let index = 0; index < 5; index += 1) {
      await page.screenshot({
        path: path.join(resetFrames, `frame-${String(index).padStart(2, '0')}.png`),
        fullPage: true,
      });
    }

    const resetState = await getState(page);
    await page.screenshot({ path: path.join(outDir, 'shot-3.png'), fullPage: true });
    writeJson('state-3-reset.json', resetState);

    createGif(openingFrames, path.join(gifDir, 'clip-01-opening-wave.gif'));
    createGif(cleanSweepFrames, path.join(gifDir, 'clip-02-clean-sweep.gif'));

    const mixedFrames = path.join(outDir, 'frames-pause-reset-mix');
    rmSync(mixedFrames, { recursive: true, force: true });
    mkdirSync(mixedFrames, { recursive: true });
    const frameSources = [
      ...Array.from({ length: 4 }, (_, index) =>
        path.join(pauseFrames, `frame-${String(index).padStart(2, '0')}.png`)
      ),
      ...Array.from({ length: 5 }, (_, index) =>
        path.join(resetFrames, `frame-${String(index).padStart(2, '0')}.png`)
      ),
    ];
    frameSources.forEach((source, index) => {
      copyFileSync(source, path.join(mixedFrames, `frame-${String(index).padStart(2, '0')}.png`));
    });
    createGif(mixedFrames, path.join(gifDir, 'clip-03-pause-reset.gif'));

    [openingFrames, cleanSweepFrames, pauseFrames, resetFrames, mixedFrames].forEach((dir) => {
      rmSync(dir, { recursive: true, force: true });
    });

    writeFileSync(path.join(outDir, 'render_game_to_text.txt'), `${await page.evaluate(() => window.render_game_to_text())}\n`, 'utf8');
    writeJson('action_payload.json', [
      {
        buttons: ['left_mouse_button'],
        mouse_x: 238,
        mouse_y: 834,
        frames: 1,
      },
      {
        buttons: [],
        mouse_x: 238,
        mouse_y: 834,
        frames: 24,
      },
      {
        buttons: ['left_mouse_button'],
        mouse_x: 238,
        mouse_y: 886,
        frames: 1,
      },
    ]);

    writeFileSync(path.join(outDir, 'dev-server.log'), logs.join(''), 'utf8');
    await browser.close();
    server.kill('SIGTERM');
    console.log('playwright capture complete');
  } catch (error) {
    writeFileSync(path.join(outDir, 'dev-server.log'), logs.join(''), 'utf8');
    if (browser) {
      await browser.close();
    }
    server.kill('SIGTERM');
    console.error(error);
    process.exit(1);
  }
})();

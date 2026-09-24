// Renders index.html frame-by-frame with headless Chromium and pipes the
// frames into ffmpeg, muxing in build/soundtrack.wav.
//
//   node render.mjs                 -> out/supabase-launch.mp4 (60 fps)
//   node render.mjs --stills 1,4.6  -> build/still-<t>.jpg for quick checks
//   FPS=30 node render.mjs          -> override frame rate
//   WORKERS=2 node render.mjs       -> parallel browser workers (default: CPU count)
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = require('/opt/node22/lib/node_modules/playwright'); }

const ROOT = dirname(fileURLToPath(import.meta.url));
const FPS = +(process.env.FPS || 60);
const DURATION = 48;
const args = process.argv.slice(2);
const stillsArg = args.includes('--stills') ? args[args.indexOf('--stills') + 1] : null;

const TYPES = { '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.wav': 'audio/wav', '.js': 'text/javascript' };
const server = createServer(async (req, res) => {
  try {
    const p = join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' });
    res.end(await readFile(p));
  } catch { res.writeHead(404); res.end(); }
}).listen(0);
const port = server.address().port;

function ffmpegPath() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  try { return execFileSync('python3', ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())']).toString().trim(); }
  catch { return 'ffmpeg'; }
}

async function openPage() {
  const browser = await playwright.chromium.launch({ args: ['--font-render-hinting=none'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.goto(`http://localhost:${port}/index.html?render=1`);
  await page.waitForFunction(() => window.READY === true);
  return { browser, page, stage: await page.$('#stage') };
}

await mkdir(join(ROOT, 'build', 'seg'), { recursive: true });
await mkdir(join(ROOT, 'out'), { recursive: true });
const FF = ffmpegPath();
const run = (argv, stdio = ['ignore', 'ignore', 'inherit']) => new Promise((res, rej) => {
  const p = spawn(FF, argv, { stdio });
  p.on('close', c => c === 0 ? res() : rej(new Error(`ffmpeg exited ${c}`)));
  return p;
});

if (stillsArg) {
  const { browser, page, stage } = await openPage();
  for (const t of stillsArg.split(',').map(Number)) {
    await page.evaluate(t => window.seek(t), t);
    await stage.screenshot({ path: join(ROOT, 'build', `still-${t.toFixed(2)}.jpg`), type: 'jpeg', quality: 85 });
  }
  await browser.close();
} else {
  // Split the timeline across parallel workers; each encodes its own segment.
  const WORKERS = +(process.env.WORKERS || Math.max(1, os.cpus().length));
  const total = Math.round(DURATION * FPS);
  const per = Math.ceil(total / WORKERS);
  const done = new Array(WORKERS).fill(0);
  const t0 = Date.now();
  const tick = setInterval(() => {
    const n = done.reduce((a, b) => a + b, 0);
    process.stdout.write(`\rframes ${n}/${total}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }, 2000);
  const segs = [];
  await Promise.all(Array.from({ length: WORKERS }, async (_, w) => {
    const a = w * per, b = Math.min(total, a + per);
    if (a >= b) return;
    const seg = join(ROOT, 'build', 'seg', `seg${w}.mp4`);
    segs[w] = seg;
    const { browser, page, stage } = await openPage();
    const ff = spawn(FF, ['-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-threads', '1', seg],
      { stdio: ['pipe', 'ignore', 'ignore'] });
    const closed = new Promise(r => ff.on('close', r));
    for (let f = a; f < b; f++) {
      await page.evaluate(t => window.seek(t), f / FPS);
      const buf = await stage.screenshot({ type: 'jpeg', quality: 95 });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      done[w]++;
    }
    ff.stdin.end();
    await closed;
    await browser.close();
  }));
  clearInterval(tick);
  const list = join(ROOT, 'build', 'seg', 'list.txt');
  await writeFile(list, segs.filter(Boolean).map(s => `file '${s}'`).join('\n'));
  const out = join(ROOT, 'out', 'supabase-launch.mp4');
  await run(['-y', '-f', 'concat', '-safe', '0', '-i', list, '-i', join(ROOT, 'build', 'soundtrack.wav'),
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', out]);
  console.log(`\nwrote ${out} in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
server.close();

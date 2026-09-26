/**
 * Viewer360: a smooth, drag-to-rotate 360° product spinner.
 *
 * Why it's smooth (and the old one wasn't):
 *  - Every frame is downloaded AND decoded up front (createImageBitmap), so
 *    rotating never waits on the network or the JPEG/WebP decoder.
 *  - Frames are painted onto a single <canvas> inside requestAnimationFrame.
 *    No <img> src swapping, no layout, no video seeking.
 *  - Drag follows the pointer 1:1, with momentum on release and gentle
 *    auto-spin that resumes after the visitor lets go.
 *
 * Usage:
 *   new Viewer360(document.querySelector('#spinner'), {
 *     frames: Array.from({length: 72}, (_, i) => `frames/f${String(i).padStart(3,'0')}.webp`),
 *   });
 */
export class Viewer360 {
  constructor(root, opts) {
    this.root = root;
    this.o = Object.assign({
      frames: [],
      autoSpeed: 10,          // frames per second while auto-spinning
      pxPerFrame: 9,          // drag distance (CSS px) to advance one frame
      reverse: false,         // flip drag direction if the footage spins the other way
      resumeAfter: 2500,      // ms of inactivity before auto-spin resumes
      startFrame: 0,
    }, opts);
    this.n = this.o.frames.length;
    this.pos = this.o.startFrame;   // fractional frame position
    this.vel = this.o.autoSpeed;    // frames per second
    this.dragging = false;
    this.lastInteract = -1e9;
    this.bitmaps = new Array(this.n);
    this._build();
    this._load();
  }

  _build() {
    const r = this.root;
    r.classList.add('v360');
    r.innerHTML = `
      <canvas class="v360-canvas" aria-label="360 degree view, drag to rotate" role="img"></canvas>
      <div class="v360-loader"><div class="v360-bar"><i></i></div><span>Loading 360° view… 0%</span></div>
      <div class="v360-hint"><svg viewBox="0 0 48 24" width="48" height="24"><path d="M4 12h40M4 12l6-6M4 12l6 6M44 12l-6-6M44 12l-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>Drag to rotate</div>
      <div class="v360-dial"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" class="t"/><circle cx="18" cy="18" r="15" class="p"/></svg><b>360°</b></div>`;
    this.canvas = r.querySelector('canvas');
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.loader = r.querySelector('.v360-loader');
    this.hint = r.querySelector('.v360-hint');
    this.dialP = r.querySelector('.v360-dial .p');

    const ro = new ResizeObserver(() => this._resize());
    ro.observe(r);
    this._resize();

    let lastX = 0, lastT = 0;
    const down = e => {
      if (!this.ready) return;
      this.dragging = true; lastX = e.clientX; lastT = performance.now();
      this.vel = 0; this.canvas.setPointerCapture(e.pointerId);
      r.classList.add('v360-grabbing'); this.hint.classList.add('gone');
    };
    const move = e => {
      if (!this.dragging) return;
      const now = performance.now(), dx = e.clientX - lastX, dt = Math.max(1, now - lastT);
      const df = (this.o.reverse ? 1 : -1) * dx / this.o.pxPerFrame;
      this.pos += df;
      // low-pass the release velocity so a flick feels natural
      this.vel = this.vel * 0.6 + (df / (dt / 1000)) * 0.4;
      lastX = e.clientX; lastT = now; this.lastInteract = now;
    };
    const up = () => {
      if (!this.dragging) return;
      this.dragging = false; this.lastInteract = performance.now();
      r.classList.remove('v360-grabbing');
    };
    this.canvas.addEventListener('pointerdown', down);
    this.canvas.addEventListener('pointermove', move);
    this.canvas.addEventListener('pointerup', up);
    this.canvas.addEventListener('pointercancel', up);
    r.tabIndex = 0;
    r.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        this.pos += (e.key === 'ArrowRight' ? 1 : -1) * 2; this.vel = 0;
        this.lastInteract = performance.now(); e.preventDefault();
      }
    });
    // pause work when off-screen
    this.visible = true;
    new IntersectionObserver(([en]) => { this.visible = en.isIntersecting; }).observe(r);
  }

  _resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.root.clientWidth, h = this.root.clientHeight;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this._lastDrawn = -1;
  }

  async _load() {
    let done = 0;
    const label = this.loader.querySelector('span'), bar = this.loader.querySelector('i');
    const tick = () => {
      done++;
      const p = Math.round(done / this.n * 100);
      bar.style.width = p + '%'; label.textContent = `Loading 360° view… ${p}%`;
    };
    // Load the first frame immediately so something shows at once, then the rest.
    const loadOne = async i => {
      const res = await fetch(this.o.frames[i]);
      const blob = await res.blob();
      this.bitmaps[i] = await createImageBitmap(blob);
      tick();
    };
    await loadOne(this.o.startFrame % this.n);
    this._draw(true);
    const queue = [...Array(this.n).keys()].filter(i => i !== this.o.startFrame % this.n);
    const workers = Array.from({ length: 6 }, async () => { while (queue.length) await loadOne(queue.shift()); });
    await Promise.all(workers);
    this.ready = true;
    this.loader.classList.add('gone');
    this.root.classList.add('v360-ready');
    this._t = performance.now();
    requestAnimationFrame(t => this._loop(t));
  }

  _loop(t) {
    const dt = Math.min(0.05, (t - this._t) / 1000); this._t = t;
    if (this.visible && !this.dragging) {
      const idle = t - this.lastInteract > this.o.resumeAfter;
      const target = idle ? this.o.autoSpeed : 0;
      // momentum decays toward either 0 (just released) or auto-spin speed (idle)
      const k = idle ? 1.6 : 3.2;
      this.vel += (target - this.vel) * (1 - Math.exp(-k * dt));
      this.pos += this.vel * dt;
    }
    this._draw();
    requestAnimationFrame(tt => this._loop(tt));
  }

  _draw(force) {
    const i = ((Math.round(this.pos) % this.n) + this.n) % this.n;
    if (!force && i === this._lastDrawn) return;
    const bmp = this.bitmaps[i];
    if (!bmp) return;
    this._lastDrawn = i;
    const cw = this.canvas.width, ch = this.canvas.height;
    const s = Math.max(cw / bmp.width, ch / bmp.height);       // object-fit: cover
    const w = bmp.width * s, h = bmp.height * s;
    this.ctx.drawImage(bmp, (cw - w) / 2, (ch - h) / 2, w, h);
    const frac = i / this.n;
    this.dialP.style.strokeDashoffset = String(94.25 * (1 - frac));
  }
}

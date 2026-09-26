// DBI: 10 animation concepts. No dependencies.
// Assets come as uncompressed ("stored") zips: one request each, streamed and
// decoded as they arrive. window.FX10 overrides the locations (hosted demo).
const A = window.FX10 || { img: 'assets/img.zip', heal: 'assets/heal.zip', water: 'assets/water.zip' };
const $ = (s, r = document) => r.querySelector(s);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------------- stored-zip streaming loader ---------------- */
async function loadZip(url, onEntry, onBytes) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(url + ' ' + res.status);
  const total = +res.headers.get('content-length') || 0;
  const reader = res.body.getReader();
  let buf = new Uint8Array(0), got = 0;
  const td = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (value) {
      const nb = new Uint8Array(buf.length + value.length); nb.set(buf); nb.set(value, buf.length); buf = nb;
      got += value.length; onBytes && onBytes(got, total);
      let off = 0;
      while (buf.length - off >= 30) {
        const dv = new DataView(buf.buffer, buf.byteOffset + off);
        if (dv.getUint32(0, true) !== 0x04034b50) { off = buf.length; break; }
        const size = dv.getUint32(18, true), nlen = dv.getUint16(26, true), xlen = dv.getUint16(28, true);
        const start = off + 30 + nlen + xlen;
        if (buf.length < start + size) break;
        const name = td.decode(buf.subarray(off + 30, off + 30 + nlen));
        const type = name.endsWith('.png') ? 'image/png' : name.endsWith('.jpg') ? 'image/jpeg' : 'image/webp';
        onEntry(name, new Blob([buf.slice(start, start + size)], { type }));
        off = start + size;
      }
      buf = buf.slice(off);
    }
    if (done) break;
  }
}

/* frame sequence: array of ImageBitmaps, drawn with a cross-fade between neighbours */
async function loadFrames(url, onBytes) {
  const frames = []; const jobs = [];
  await loadZip(url, (name, blob) => {
    const i = +(name.match(/(\d+)\.\w+$/) || [0, frames.length])[1];
    jobs.push(createImageBitmap(blob).then(b => (frames[i] = b)));
  }, onBytes);
  await Promise.all(jobs);
  return frames;
}
function nearest(frames, i) {
  if (frames[i]) return frames[i];
  for (let d = 1; d < frames.length; d++) { if (frames[i - d]) return frames[i - d]; if (frames[i + d]) return frames[i + d]; }
  return null;
}
function drawCover(ctx, img, alpha = 1) {
  const cw = ctx.canvas.width, ch = ctx.canvas.height;
  const s = Math.max(cw / img.width, ch / img.height), w = img.width * s, h = img.height * s;
  ctx.globalAlpha = alpha; ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h); ctx.globalAlpha = 1;
}
function drawAt(ctx, frames, pos) {
  const n = frames.length; if (!n) return;
  pos = clamp(pos, 0, n - 1);
  const i = Math.floor(pos), f = pos - i;
  const a = nearest(frames, i), b = nearest(frames, Math.min(n - 1, i + 1));
  if (!a) return;
  drawCover(ctx, a);
  if (b && b !== a && f > .01) drawCover(ctx, b, f);
}
function fitCanvas(c) {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const w = Math.round(c.clientWidth * dpr), h = Math.round(c.clientHeight * dpr);
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; return true; }
  return false;
}
function sectionProgress(el) {
  const r = el.getBoundingClientRect(), span = r.height - innerHeight;
  return span <= 0 ? 0 : clamp(-r.top / span);
}
const onScreen = new WeakMap();
const io = new IntersectionObserver(es => es.forEach(e => onScreen.set(e.target, e.isIntersecting)), { rootMargin: '200px' });
const watch = el => { onScreen.set(el, false); io.observe(el); };
const visible = el => onScreen.get(el);

/* ---------------- boot: stills first ---------------- */
const IMG = {};
const bar = $('#loadbar'), txt = $('#loadtxt');
await loadZip(A.img, (name, blob) => { IMG[name.replace(/\.\w+$/, '')] = URL.createObjectURL(blob); },
  (g, t) => { if (t) { bar.style.width = (g / t * 100) + '%'; txt.textContent = `loading images… ${Math.round(g / t * 100)}%`; } });
bar.style.width = '100%'; txt.textContent = 'ready. Scroll down';
document.querySelectorAll('img[data-src]').forEach(im => { if (IMG[im.dataset.src]) im.src = IMG[im.dataset.src]; });
const bitmap = async name => createImageBitmap(await (await fetch(IMG[name])).blob());

const loops = [];   // per-frame updaters for scroll-driven ideas
let last = performance.now();
requestAnimationFrame(function tick(t) {
  const dt = Math.min(.05, (t - last) / 1000); last = t;
  for (const f of loops) f(dt, t);
  requestAnimationFrame(tick);
});

/* ================= 1. BEFORE / AFTER ================= */
{
  const st = $('#ba'); let x = 8, dragging = false, intro = false;
  const set = v => { x = clamp(v, 0, 100); st.style.setProperty('--x', x + '%'); };
  set(x);
  const fromEvent = e => { const r = st.getBoundingClientRect(); set((e.clientX - r.left) / r.width * 100); };
  st.addEventListener('pointerdown', e => { e.preventDefault(); dragging = true; intro = true; st.setPointerCapture(e.pointerId); fromEvent(e); });
  st.addEventListener('pointermove', e => dragging && fromEvent(e));
  st.addEventListener('pointerup', () => (dragging = false));
  new IntersectionObserver(([e], o) => {
    if (!e.isIntersecting || intro) return; o.disconnect(); intro = true;
    // sweep in: 8% → 70% → 50% (a little overshoot so it feels physical)
    const t0 = performance.now(), D = 1600;
    const step = t => { const p = clamp((t - t0) / D); if (dragging) return;
      set(p < .6 ? lerp(8, 70, ease(p / .6)) : lerp(70, 50, ease((p - .6) / .4))); if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }, { threshold: .5 }).observe(st);
}

/* ================= 2. PRESS & HOLD: SELF-HEALING ================= */
{
  const st = $('#heal'), c = $('canvas', st), ctx = c.getContext('2d');
  const heat = $('.heat', st), gp = $('.gauge .p', st), gt = $('.gauge span', st), done = $('.done', st), hint = $('.hint', st);
  let frames = [], p = 0, holding = false, dirty = true, loadingStarted = false;
  const still = await bitmap('scratch');
  const load = () => { if (loadingStarted) return; loadingStarted = true; loadFrames(A.heal).then(f => { frames = f; dirty = true; }); };
  new IntersectionObserver(([e]) => e.isIntersecting && load(), { rootMargin: '600px' }).observe(st);
  const pos = e => { const r = st.getBoundingClientRect(); st.style.setProperty('--hx', (e.clientX - r.left) + 'px'); st.style.setProperty('--hy', (e.clientY - r.top) + 'px'); };
  st.addEventListener('pointerdown', e => { holding = true; st.setPointerCapture(e.pointerId); pos(e); hint.style.opacity = 0; });
  st.addEventListener('pointermove', pos);
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => st.addEventListener(ev, () => (holding = false)));
  addEventListener('keydown', e => { if (e.code === 'Space' && visible(st)) { holding = true; e.preventDefault(); } });
  addEventListener('keyup', e => { if (e.code === 'Space') holding = false; });
  watch(st);
  loops.push(dt => {
    if (!visible(st)) return;
    const resized = fitCanvas(c);
    const prev = p;
    p = clamp(p + (holding ? dt / 2.4 : -dt / 1.1));
    heat.style.opacity = holding ? .9 : 0;
    if (!resized && !dirty && prev === p) return;
    dirty = false;
    if (frames.length) drawAt(ctx, frames, p * (frames.length - 1)); else drawCover(ctx, still);
    gp.style.strokeDashoffset = 226 * (1 - p); gt.textContent = Math.round(p * 100) + '%';
    done.style.opacity = p > .97 ? 1 : 0;
  });
}

/* ================= 3. SCROLL-SCRUB: WATER BEADING ================= */
{
  const sec = $('#water'), c = $('canvas', sec), ctx = c.getContext('2d'), barEl = $('.bar', sec);
  const beats = [...sec.querySelectorAll('.beat')];
  let frames = [], pos = 0, started = false;
  const still = await bitmap('water0');
  new IntersectionObserver(([e]) => { if (e.isIntersecting && !started) { started = true; loadFrames(A.water).then(f => (frames = f)); } }, { rootMargin: '150% 0px' }).observe(sec);
  watch(sec);
  loops.push(() => {
    if (!visible(sec)) return;
    fitCanvas(c);
    const p = reduced ? 1 : sectionProgress(sec);
    if (!frames.length) { drawCover(ctx, still); return; }
    const target = p * (frames.length - 1);
    pos += (target - pos) * .14; if (Math.abs(target - pos) < .002) pos = target;
    drawAt(ctx, frames, pos);
    const shown = pos / (frames.length - 1);
    barEl.style.width = shown * 100 + '%';
    for (const b of beats) {
      const v = Math.min(clamp((shown - b.dataset.in) / .06), clamp((b.dataset.out - shown) / .06));
      b.style.opacity = v; b.style.transform = `translateY(${(1 - v) * 20}px)`;
    }
  });
}

/* ================= 4. WIPE THE FOAM ================= */
{
  const st = $('#foam'), c = $('canvas', st), ctx = c.getContext('2d', { willReadFrequently: true });
  const sponge = $('.sponge', st), meter = $('.meter', st), win = $('.win', st), hint = $('.hint', st);
  const foam = await bitmap('foam');
  let lastPt = null, finished = false, cleared = 0, since = 0;
  const reset = () => {
    fitCanvas(c); ctx.globalCompositeOperation = 'source-over'; drawCover(ctx, foam);
    c.style.transition = 'none'; c.style.opacity = 1; finished = false; win.style.opacity = 0; meter.textContent = '0% clean'; hint.style.opacity = 1;
  };
  reset();
  new ResizeObserver(() => { if (!finished) reset(); }).observe(st);
  const R = () => c.width * .055;
  const scrub = (x, y) => {
    ctx.globalCompositeOperation = 'destination-out';
    const pts = lastPt ? Math.ceil(Math.hypot(x - lastPt.x, y - lastPt.y) / (R() * .35)) : 1;
    for (let k = 1; k <= pts; k++) {
      const px = lastPt ? lerp(lastPt.x, x, k / pts) : x, py = lastPt ? lerp(lastPt.y, y, k / pts) : y;
      const g = ctx.createRadialGradient(px, py, 0, px, py, R());
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(.6, 'rgba(0,0,0,.85)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, R(), 0, Math.PI * 2); ctx.fill();
    }
    lastPt = { x, y };
  };
  const measure = () => {
    const d = ctx.getImageData(0, 0, c.width, c.height).data; let clear = 0, n = 0;
    for (let i = 3; i < d.length; i += 4 * 97) { n++; if (d[i] < 40) clear++; }
    cleared = clear / n;
    meter.textContent = Math.round(cleared * 100) + '% clean';
    if (cleared > .6 && !finished) {
      finished = true; c.style.transition = 'opacity 1.2s'; c.style.opacity = 0; win.style.opacity = 1; meter.textContent = '100% clean';
    }
  };
  st.addEventListener('pointermove', e => {
    const r = st.getBoundingClientRect(), dpr = c.width / r.width;
    sponge.style.left = (e.clientX - r.left) + 'px'; sponge.style.top = (e.clientY - r.top) + 'px'; sponge.style.opacity = 1;
    sponge.style.width = sponge.style.height = (R() * 2 / dpr) + 'px';
    if (finished) return;
    hint.style.opacity = 0;
    scrub((e.clientX - r.left) * dpr, (e.clientY - r.top) * dpr);
    const now = performance.now(); if (now - since > 150) { since = now; measure(); }
  });
  st.addEventListener('pointerdown', e => st.setPointerCapture(e.pointerId));
  st.addEventListener('pointerleave', () => { lastPt = null; sponge.style.opacity = 0; });
  st.addEventListener('pointerup', () => { lastPt = null; });
  $('button', win).addEventListener('click', reset);
}

/* ================= 5. EXPLODED LAYERS ================= */
{
  const sec = $('#layers'), stack = $('#stack'), tagsEl = $('#tags');
  const L = [ // bottom → top
    { n: 'Body panel', d: 'Steel / aluminium', face: 'repeating-linear-gradient(100deg,#8d9399 0 2px,#a7adb3 2px 5px)', edge: '#6b7076' },
    { n: 'Primer', d: 'Corrosion barrier', face: 'linear-gradient(135deg,#9a9a96,#7c7c78)', edge: '#5e5e5a' },
    { n: 'Base coat', d: 'The colour', face: 'linear-gradient(135deg,#1c1c1c,#050505)', edge: '#000' },
    { n: 'Clear coat', d: 'Factory gloss layer', face: 'linear-gradient(135deg,rgba(255,255,255,.22),rgba(255,255,255,.05))', edge: 'rgba(255,255,255,.25)' },
    { n: 'Matte PPF', d: 'DBI · self-healing TPU film', face: 'linear-gradient(135deg,rgba(90,90,90,.75),rgba(40,40,40,.75))', edge: 'rgba(242,201,76,.6)', dbi: 1 },
    { n: 'Ceramic coating', d: 'DBI · hydrophobic, UV-resistant', face: 'linear-gradient(135deg,rgba(140,200,255,.28),rgba(242,201,76,.18))', edge: 'rgba(242,201,76,.9)', dbi: 1 },
  ];
  const slabs = L.map((l, i) => {
    const s = document.createElement('div'); s.className = 'slab';
    s.innerHTML = `<div class="face" style="background:${l.face};${l.dbi ? 'box-shadow:0 0 0 2px rgba(242,201,76,.7),0 0 40px rgba(242,201,76,.25)' : 'box-shadow:0 0 0 1px rgba(255,255,255,.12)'}"></div><div class="edge" style="background:${l.edge}"></div>`;
    stack.appendChild(s);
    const t = document.createElement('div'); t.className = 'tag';
    t.innerHTML = `<i></i><span><b>${l.dbi ? '<span class="y">' + l.n + '</span>' : l.n}</b><br>${l.d}</span>`;
    tagsEl.appendChild(t);
    return { s, t, face: s.firstChild };
  });
  watch(sec);
  let sm = 0;
  loops.push(() => {
    if (!visible(sec)) return;
    const p = reduced ? 1 : sectionProgress(sec);
    sm += (p - sm) * .12;
    const open = ease(clamp((sm - .05) / .7));
    slabs.forEach(({ s, t, face }, i) => {
      s.style.transform = `translateZ(${i * 10 + open * i * 62}px)`;
      const r = face.getBoundingClientRect(), sr = sec.querySelector('.sticky').getBoundingClientRect();
      const show = clamp((open - i * .1) / .25);
      t.style.opacity = show;
      t.style.top = (r.top + r.height / 2 - sr.top - 18) + 'px';
      t.style.transform = `translateX(${(1 - show) * 30}px)`;
    });
    stack.style.transform = `translate(-50%,-50%) rotateX(${lerp(62, 56, open)}deg) rotateZ(${lerp(-34, -42, open)}deg)`;
  });
}

/* ================= 6. WRAP CONFIGURATOR ================= */
{
  const st = $('#config'), A1 = $('#cfgA img'), B = $('#cfgB'), B1 = $('img', B), sweep = $('.sweep', st), nameEl = $('#cfgName');
  const C = [
    ['c-black', 'Matte Black PPF', '#141414'], ['c-nardo', 'Satin Nardo Grey', '#8a8d8f'], ['c-yellow', 'Gloss Giallo Yellow', '#f2c230'],
    ['c-white', 'Satin Pearl White', '#ecebe6'], ['c-olive', 'Matte Military Olive', '#4d5236'], ['c-purple', 'Satin Midnight Purple', '#3b2a63'],
  ];
  const wrap = $('#swatches'); let cur = 0, busy = false;
  C.forEach(([k, n, col], i) => {
    const b = document.createElement('button'); b.className = 'swatch'; b.type = 'button'; b.setAttribute('aria-pressed', i === 0);
    b.innerHTML = `<i style="background:${col}"></i>${n}`;
    b.onclick = async () => {
      if (busy || i === cur) return; busy = true;
      wrap.querySelectorAll('.swatch').forEach((x, j) => x.setAttribute('aria-pressed', j === i));
      B1.src = IMG[k]; await B1.decode().catch(() => {});
      B.style.display = 'block';
      const D = reduced ? 10 : 1100, E = 'cubic-bezier(.65,0,.35,1)';
      B.animate([{ clipPath: 'polygon(0 0,0 0,-15% 100%,-15% 100%)' }, { clipPath: 'polygon(0 0,115% 0,100% 100%,-15% 100%)' }], { duration: D, easing: E, fill: 'forwards' });
      sweep.animate([{ left: '-3%', opacity: 1 }, { left: '104%', opacity: 1 }], { duration: D, easing: E });
      await new Promise(r => setTimeout(r, D));
      A1.src = IMG[k]; await A1.decode().catch(() => {});
      B.getAnimations().forEach(a => a.cancel()); B.style.display = 'none';
      nameEl.textContent = n; cur = i; busy = false;
    };
    wrap.appendChild(b);
  });
  B.style.display = 'none';
  Object.values(C).forEach(([k]) => { const im = new Image(); im.src = IMG[k]; });   // warm the cache
}

/* ================= 7. INSPECTION LAMP ================= */
{
  const st = $('#lamp'), hint = $('.hint', st); let user = false, t0 = performance.now(), idleSince = 0;
  const set = (x, y) => { st.style.setProperty('--lx', x + 'px'); st.style.setProperty('--ly', y + 'px'); };
  const size = () => st.style.setProperty('--r', Math.max(120, st.clientWidth * .17) + 'px');
  new ResizeObserver(size).observe(st); size();
  st.addEventListener('pointermove', e => { const r = st.getBoundingClientRect(); user = true; idleSince = performance.now(); hint.style.opacity = 0; set(e.clientX - r.left, e.clientY - r.top); });
  st.addEventListener('pointerleave', () => { user = false; });
  watch(st);
  loops.push((dt, t) => {   // when nobody's driving it, the lamp sweeps by itself (phones, idle)
    if (!visible(st) || (user && t - idleSince < 2500)) return;
    const w = st.clientWidth, h = st.clientHeight, k = (t - t0) / 1000;
    set(w * (.5 + .38 * Math.sin(k * .7)), h * (.55 + .18 * Math.sin(k * 1.3)));
  });
}

/* ================= 8. GARAGE SHUTTER ================= */
{
  const sec = $('#shutter'), door = $('#door'), light = $('#shLight'), behind = $('.behind img', sec), cta = $('.cta', sec);
  watch(sec);
  let sm = 0;
  loops.push(() => {
    if (!visible(sec)) return;
    sm += ((reduced ? 1 : sectionProgress(sec)) - sm) * .15;
    const open = ease(clamp((sm - .08) / .7));
    const h = sec.querySelector('.sticky').clientHeight;
    // the curtain rolls into the drum: shrink from the bottom up, slats scroll with it
    const doorH = (1 - open) * h;
    door.style.height = doorH + 'px';
    door.style.backgroundPosition = `0 ${-open * h}px`;
    light.style.top = (doorH - 20) + 'px'; light.style.opacity = open > .01 && open < .98 ? 1 : 0;
    behind.style.transform = `scale(${lerp(1.15, 1, open)})`;
    behind.style.filter = `brightness(${lerp(.35, 1, open)})`;
    cta.style.opacity = clamp((open - .7) / .25); cta.style.transform = `translateY(${(1 - clamp((open - .7) / .25)) * 30}px)`;
  });
}

/* ================= 9. KINETIC TYPE × CUT-OUT ================= */
{
  const sec = $('#kinetic'), rows = [...sec.querySelectorAll('.row')], car = $('#kcar');
  watch(sec);
  let sm = 0;
  loops.push(() => {
    if (!visible(sec)) return;
    const r = sec.getBoundingClientRect();
    const p = clamp((innerHeight - r.top) / (r.height + innerHeight));   // 0 as it enters → 1 as it leaves
    sm += (p - sm) * .12;
    rows.forEach((row, i) => { const d = +row.dataset.dir; row.style.transform = `translateX(${(d < 0 ? -10 : -55) + d * sm * 45}vw)`; });
    car.style.transform = `translateX(${lerp(-10, 8, sm)}%) scale(${lerp(.86, 1.12, sm)})`;
  });
}

/* ================= 10. HORIZONTAL SERVICES RIDE ================= */
{
  const sec = $('#hscroll'), track = $('#track'), prog = $('#hprog');
  const S = [
    ['after', 'PPF', 'Full body matte PPF', 'Self-healing satin film on every panel.'],
    ['water0', 'Ceramic', 'Ceramic coating', 'Hydrophobic gloss, or satin, that lasts.'],
    ['c-yellow', 'Wraps', 'Vehicle wrapping', 'Any colour, any finish, fully reversible.'],
    ['clean', 'Glass', 'Windshield protection', 'Film that shrugs off stone chips.'],
    ['foam', 'Detailing', 'Deep detailing', 'Inside and out, down to the last seam.'],
    ['c-purple', 'Colour', 'Colour-shift wraps', 'Finishes that change with the light.'],
    ['bridge', 'Book', 'Your car is next', 'Al Quoz 3, Dubai. Book the same treatment.'],
  ];
  S.forEach(([k, s, h, p]) => {
    const c = document.createElement('article'); c.className = 'card';
    c.innerHTML = `<img src="${IMG[k]}" alt=""><div class="shine"></div><div class="txt"><small>${s.toUpperCase()}</small><h4>${h}</h4><p>${p}</p></div>`;
    const im = c.firstChild;
    c.addEventListener('pointermove', e => {
      const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      c.style.transform = `perspective(900px) rotateY(${(x - .5) * 14}deg) rotateX(${(.5 - y) * 12}deg) translateZ(10px)`;
      im.style.transform = `translate(${(.5 - x) * 16}px,${(.5 - y) * 16}px)`;
      c.style.setProperty('--gx', x * 100 + '%'); c.style.setProperty('--gy', y * 100 + '%');
    });
    c.addEventListener('pointerleave', () => { c.style.transform = ''; im.style.transform = ''; });
    track.appendChild(c);
  });
  watch(sec);
  let sm = 0;
  loops.push(() => {
    if (!visible(sec)) return;
    sm += (sectionProgress(sec) - sm) * .12;
    const max = track.scrollWidth - innerWidth;
    track.style.transform = `translateX(${-sm * Math.max(0, max)}px)`;
    prog.style.width = sm * 100 + '%';
  });
}

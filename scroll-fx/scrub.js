/**
 * ScrollScrub: plays an image sequence with the scroll wheel, Apple-style.
 *
 *   <section class="scrub" style="height:400vh">          ← scroll distance
 *     <div class="scrub-sticky"><canvas></canvas> ...overlays...</div>
 *   </section>
 *   new ScrollScrub(section, { frames: [...bitmaps or urls], ... })
 *
 * Smoothness tricks:
 *  - the section's inner box is position:sticky, so the page itself does the
 *    scrolling and we only paint a canvas (no scroll hijacking, works on phones)
 *  - displayed position eases toward the scroll position every animation frame,
 *    so a notchy mouse wheel still produces a glide
 *  - between two frames we cross-fade (draw frame i, then i+1 at the fractional
 *    alpha), which hides the steps of a 24 fps source
 *  - every frame is decoded up front (createImageBitmap)
 *
 * Overlays: any child with data-in / data-out (0..1 progress) fades & slides in
 * and out as the visitor scrolls through that range.
 */
export class ScrollScrub {
  constructor(section, { frames, ease = 0.14, fit = 'cover', onProgress } = {}) {
    this.section = section;
    this.canvas = section.querySelector('canvas');
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.frames = frames;            // array of ImageBitmap | null (null = not loaded yet)
    this.n = frames.length;
    this.ease = ease;
    this.fit = fit;
    this.onProgress = onProgress;
    this.pos = 0;                    // displayed (fractional) frame
    this.overlays = [...section.querySelectorAll('[data-in]')];
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    new ResizeObserver(() => this.resize()).observe(this.canvas);
    this.resize();
    this.visible = true;
    new IntersectionObserver(([e]) => (this.visible = e.isIntersecting), { rootMargin: '200px' }).observe(section);
    requestAnimationFrame(t => this.loop(t));
  }

  resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.canvas.clientWidth * dpr);
    this.canvas.height = Math.round(this.canvas.clientHeight * dpr);
    this.dirty = true;
  }

  progress() {
    const r = this.section.getBoundingClientRect();
    const span = r.height - innerHeight;
    return span <= 0 ? 0 : Math.min(1, Math.max(0, -r.top / span));
  }

  nearest(i) {                        // closest loaded frame (frames stream in)
    if (this.frames[i]) return this.frames[i];
    for (let d = 1; d < this.n; d++) {
      if (this.frames[i - d]) return this.frames[i - d];
      if (this.frames[i + d]) return this.frames[i + d];
    }
    return null;
  }

  draw(img, alpha) {
    const cw = this.canvas.width, ch = this.canvas.height;
    const s = this.fit === 'cover' ? Math.max(cw / img.width, ch / img.height) : Math.min(cw / img.width, ch / img.height);
    const w = img.width * s, h = img.height * s;
    this.ctx.globalAlpha = alpha;
    this.ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
  }

  loop(t) {
    requestAnimationFrame(tt => this.loop(tt));
    if (!this.visible) return;
    const p = this.reduced ? 1 : this.progress();
    const target = p * (this.n - 1);
    const prev = this.pos;
    this.pos += (target - this.pos) * this.ease;
    if (Math.abs(target - this.pos) < 0.002) this.pos = target;
    if (!this.dirty && Math.abs(prev - this.pos) < 0.0005) return;
    this.dirty = false;
    const i = Math.floor(this.pos), f = this.pos - i;
    const a = this.nearest(i), b = this.nearest(Math.min(this.n - 1, i + 1));
    if (!a) return;
    this.draw(a, 1);
    if (b && b !== a && f > 0.01) this.draw(b, f);
    this.ctx.globalAlpha = 1;
    const shown = this.pos / (this.n - 1);
    for (const el of this.overlays) {
      const a0 = +el.dataset.in, a1 = +(el.dataset.out ?? 2), fade = 0.06;
      const vin = Math.min(1, Math.max(0, (shown - a0) / fade));
      const vout = Math.min(1, Math.max(0, (a1 - shown) / fade));
      const v = Math.min(vin, vout);
      el.style.opacity = v;
      el.style.transform = `translateY(${(1 - v) * (shown < a0 + fade ? 24 : -24)}px)`;
    }
    this.onProgress && this.onProgress(shown);
  }
}

/**
 * Loads a frame sequence packed into one uncompressed ("stored") zip —
 * a single HTTP request instead of 100+ — and decodes frames as they arrive.
 * Frames are delivered keyframes-first (every 8th frame, then the rest) so the
 * scrub works almost immediately at low temporal resolution and sharpens up.
 */
export async function loadZipSequence(url, onFrame, onBytes) {
  const res = await fetch(url);
  const total = +res.headers.get('content-length') || 0;
  const reader = res.body.getReader();
  let buf = new Uint8Array(0), got = 0, idx = 0;
  const pending = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (value) {
      const nb = new Uint8Array(buf.length + value.length); nb.set(buf); nb.set(value, buf.length); buf = nb;
      got += value.length; onBytes && onBytes(got, total);
      // parse as many complete local file entries as we have
      let off = 0;
      while (buf.length - off >= 30) {
        const dv = new DataView(buf.buffer, buf.byteOffset + off);
        if (dv.getUint32(0, true) !== 0x04034b50) { off = buf.length; break; }  // central directory reached
        const size = dv.getUint32(18, true), nlen = dv.getUint16(26, true), xlen = dv.getUint16(28, true);
        const start = off + 30 + nlen + xlen;
        if (buf.length < start + size) break;
        const name = new TextDecoder().decode(buf.subarray(off + 30, off + 30 + nlen));
        const m = name.match(/(\d+)\.\w+$/);
        const blob = new Blob([buf.slice(start, start + size)], { type: name.endsWith('.jpg') ? 'image/jpeg' : 'image/webp' });
        const frameIndex = m ? +m[1] : idx;
        idx++;
        pending.push(createImageBitmap(blob).then(bmp => onFrame(frameIndex, bmp)));
        off = start + size;
      }
      buf = buf.slice(off);
    }
    if (done) break;
  }
  await Promise.all(pending);
}

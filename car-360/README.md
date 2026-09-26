# Ferrari Purosangue in 360° (DBI Motor Wrapping)

A smooth drag-to-rotate 360° spinner for the "Ferrari Purosangue In 360°" section, replacing the old laggy frame viewer.

**Live demo (single file, frames embedded):**
https://d2ol7oe51mr4n9.cloudfront.net/user_32ug71yHbv31sGwpysALKqFqrXu/a57a4b2e-523d-4d5a-925d-aed55d67f710.html

**Website kit (drop-in folder with frames, 11 MB zip):**
https://d2ol7oe51mr4n9.cloudfront.net/user_32ug71yHbv31sGwpysALKqFqrXu/8e4f45d2-2783-44ba-be36-5f1026c9b89b.zip

## How the footage was made

The customer's four showroom photos went into Higgsfield (Seedance 2.0). The model generated a 10-second 1080p locked-off turntable shot: one clockwise 360° revolution in the same grey DBI studio, ending on the pose it started from. `tools/build_spin.py` finds the exact point where the loop closes and samples 120 evenly spaced frames from it (1280 px WebP, 5.3 MB total).

> This is AI-generated footage based on the real photos, not a filmed video. It's accurate to the photos, but fine details such as badges or panel gaps can differ slightly from the real car. For a 100% real result, film the car on a turntable (or walk a slow, level circle around it) and run the same script on that video.

## Why it's smooth now

- All frames are downloaded **and decoded** up front (`createImageBitmap`) with a progress bar, so dragging never waits on the network or the image decoder.
- Frames are painted to one `<canvas>` inside `requestAnimationFrame`. There's no `<img>` swapping and no video seeking.
- Drag tracks the pointer 1:1, a flick carries momentum, and auto-spin resumes gently 2.5 s after the visitor lets go.
- Arrow keys work, and rendering pauses while the section is off-screen.

## Files

| File | What it is |
|---|---|
| `index.html` | The section, styled like the live site (Oswald/Poppins, yellow block, checklist, CTA) |
| `viewer360.js` / `viewer360.css` | The spinner component, no dependencies |
| `frames/` | `f000.webp`…`f119.webp` + `manifest.json` (in the kit zip) |
| `tools/build_spin.py` | Turns any turntable video into frames + manifest + `standalone.html` |
| `model-viewer.js`, `vendor/` | Optional three.js 3D-model tab, shown only if `manifest.json` has a `"model"` URL |

## Using it on the site

```html
<link rel="stylesheet" href="/car-360/viewer360.css">
<div id="spin" style="aspect-ratio:16/10;border-radius:14px;overflow:hidden"></div>
<script type="module">
  import { Viewer360 } from '/car-360/viewer360.js';
  const m = await (await fetch('/car-360/frames/manifest.json')).json();
  new Viewer360(document.getElementById('spin'), { ...m, frames: m.frames.map(f => '/car-360/frames/' + f) });
</script>
```

To swap in a new car: `python3 tools/build_spin.py new-car.mp4 --frames 120` (this needs ffmpeg and Pillow).

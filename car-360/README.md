# Ferrari Purosangue in 360° (DBI Motor Wrapping)

A smooth drag-to-rotate 360° spinner for the "Ferrari Purosangue In 360°" section, replacing the old laggy frame viewer.

**Live demo (single file, frames embedded):**
https://d2ol7oe51mr4n9.cloudfront.net/user_32ug71yHbv31sGwpysALKqFqrXu/08fb08ea-4c83-404e-a5f1-096788889617.html

**Website kit (drop-in folder with frames + 3D model, 13.6 MB zip):**
https://d2ol7oe51mr4n9.cloudfront.net/user_32ug71yHbv31sGwpysALKqFqrXu/d583f9e6-c681-4780-a04c-f97a67b16832.zip

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
| `model-viewer.js`, `vendor/`, `model/purosangue.glb` | Bonus 3D-model tab (three.js). Shown only if `manifest.json` has a `"model"` URL |

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

## The 3D model tab (bonus)

Higgsfield's Multi-Image-to-3D (Meshy) turned three of the photos into a textured 3D mesh. The 18.4 MB raw GLB was optimized to 2.75 MB (meshopt + WebP textures). It's recognizable from every angle, with the yellow calipers, shield, taillights and quad exhausts. It's still a generated approximation, though, with some surface artifacts, and the scan came out glossy, so the viewer pushes the material toward satin. The 360° spin is the photoreal hero; the 3D tab is a "play with it" extra. Remove `"model"` from `frames/manifest.json` to hide it.

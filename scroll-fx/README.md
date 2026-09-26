# DBI scroll effects

**Live demo (v2):** https://d2ol7oe51mr4n9.cloudfront.net/user_32ug71yHbv31sGwpysALKqFqrXu/601e9f70-9447-4147-9f55-f2c7fc6eca74.html
(The intro plays on every visit. Add `?nointro` to skip it while testing.)

| # | Effect | Where on the site | Type |
|---|---|---|---|
| 1 | **Lights On**: the DBI studio light-box flickers on, the logo lights up, then the frame flies into the hero image slot | Page load, before the hero | ~4.5 s video, plays on every visit, skippable. The first frame is inlined as a poster so it shows on the very first paint |
| 2 | **The Wrap**: the camera holds on the car's side as scrolling sweeps it from gloss to matte PPF | Right before "Full Body Matte PPF" | Scroll-scrubbed, 96 frames |
| 3 | **The Drive-In**: the Ferrari drives toward the viewer across Meydan Bridge at sunset (glowing blue wave arches, Burj Khalifa behind), shot at an angle, and stops in front of them | Right before "Our Cars From Every Angle" (the 360° spinner) | Scroll-scrubbed, 120 frames |

All footage was generated with Higgsfield (Seedance 2.0), keyframed on the customer's real photos. The keyframes are the real photos widened to 16:9, plus AI-edited "before" states (lights off, glossy paint, car in the distance).

## How the smoothness works (`scrub.js`)
- The section uses `position: sticky`, so the browser does the scrolling natively. There's no scroll hijacking, and it works on phones.
- The displayed frame *eases* toward the scroll position every animation frame, so notchy mouse wheels still glide.
- Neighbouring frames are **cross-faded** according to the fractional position, which hides the steps of 24 fps source footage. The same fix applies to the 360° auto-spin.
- Frames are spaced by **visual change, not time** (`tools/build_fx.py`), so every bit of scrolling moves the car the same amount even where the AI clip idles or rushes.
- Each sequence is one stored `.zip` (one request), streamed and decoded as it arrives, **keyframes first**. The scrub works almost immediately and sharpens as the rest loads. The Drive-In only starts downloading when the visitor gets near it.
- `prefers-reduced-motion` shows the final frames, and the intro is skipped.

## Rebuild
```
python3 tools/build_fx.py --intro lights-on.mp4 --wrap wrap.mp4 --drive drive-in.mp4
```
Before production, generate a 1280 px desktop set and a ~720 px portrait mobile set. The demo Drive-In zip is 14.9 MB at 1600 px, which is fine for a demo but heavy for phones.

### Background note
The Meydan Bridge scene is an **original AI-generated image** (text prompt plus the customer's car photos). The watermarked photo that was sent over was *not* used as an input, and its watermark was not removed, because it's the photographer's copyrighted work. To use that exact photo, license it from the photographer.

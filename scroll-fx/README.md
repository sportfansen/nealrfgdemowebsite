# DBI scroll effects

**Live demo:** https://d2ol7oe51mr4n9.cloudfront.net/user_32ug71yHbv31sGwpysALKqFqrXu/7e98950a-8aaf-4d58-89c0-bc9bb391f229.html
(The intro plays once per browser tab. Add `?nointro` to skip it, or open a new tab to see it again.)

| # | Effect | Where on the site | Type |
|---|---|---|---|
| 1 | **Lights On**: the dark DBI studio, the light-box ceiling flickers on, the logo lights up, then the frame flies into the hero image slot | Page load, before the hero | 5 s video, plays once per session, skippable |
| 2 | **The Wrap**: the camera holds on the car's side as scrolling sweeps it from gloss to matte PPF | Right before "Full Body Matte PPF" | Scroll-scrubbed, 96 frames |
| 3 | **The Drive-In**: the Ferrari drives down a Dubai road at dusk toward the viewer and stops in front of them | Right before "Our Cars From Every Angle" (the 360° spinner) | Scroll-scrubbed, 120 frames |

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

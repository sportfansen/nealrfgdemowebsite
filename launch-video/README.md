# Supabase launch film (motion-graphics concept)

A 48-second, 1080p/60fps product launch video in the style of the SaaS launch
films that go around on X/Twitter. It's built entirely in code: an HTML/CSS/JS
motion-graphics composition, rendered frame-by-frame in headless Chromium, with
a soundtrack synthesized from scratch in Python.

**▶ Final video:** [`out/supabase-launch.mp4`](out/supabase-launch.mp4)

> Unofficial fan-made concept for demo purposes. It isn't affiliated with or
> endorsed by Supabase. The logos, product screenshots and feature art come
> from Supabase's own open-source repository
> ([supabase/supabase](https://github.com/supabase/supabase), `apps/www/public`
> and `packages/common/assets`). The Supabase name and logo are trademarks of
> Supabase, Inc.

## Storyboard

| Time | Scene | What happens |
|---|---|---|
| 0:00 | Hook | "You have an idea." → "Ship it **this weekend.**", with kinetic word reveals, an underline sweep and a zoom-through |
| 0:04 | Logo reveal | The two halves of the Supabase bolt fly in and collide on the beat. Shockwave ring, flash and camera shake, then the wordmark wipes on with the tagline |
| 0:08 | 01 Database | The Table Editor rises in 3D perspective. The camera pushes into the `name` column, a spotlight highlight follows, and feature chips pop in |
| 0:14 | 02 SQL + AI | Whip-pan in. The SQL Editor turns in 3D while the camera pans to the AI Assistant, a prompt types itself and the generated SQL appears |
| 0:19 | 03 Auth | The sign-in UI floats while 12 OAuth provider logos burst out and orbit it |
| 0:24 | Montage | Six hard cuts on the beat with diagonal wipes: Instant APIs, Storage, Edge Functions, Branching, Observability, Advisors |
| 0:30 | Code | `supabase-js` code types out, then a live JSON response card slams in |
| 0:35 | Integrations | 3D-tilted wall of 20 framework logos pops in as a ripple from the Supabase tile, with a glow wave |
| 0:39 | Benefits | "Open source." / "No lock-in." / "Scales to millions.", one per beat with a braam hit |
| 0:42 | Outro | Logo lockup, "Build in a weekend. Scale to millions.", then a cursor clicks **Start your project** and supabase.com fades in |

## How it works

```
index.html   the composition: every frame is a pure function of time, window.seek(t)
music.py     synthesizes build/soundtrack.wav (120 BPM, hits synced to the cuts)
render.mjs   headless Chromium → JPEG frames → ffmpeg (x264 + AAC) → out/*.mp4
assets/      logos, screenshots and product art, plus Inter and JetBrains Mono fonts (OFL)
```

Because the timeline is deterministic (no CSS transitions and no wall-clock
timers), rendering is frame-exact and repeatable. Easing curves, 3D camera
moves, kinetic typography, film grain, flashes and camera shake are all
computed per frame.

## Re-rendering

Requirements: Node 18+, Playwright with Chromium, Python 3 with `numpy`, `scipy`
and `imageio-ffmpeg` (which ships an ffmpeg binary). Alternatively, set `FFMPEG=/path/to/ffmpeg`.

```bash
pip install numpy scipy imageio-ffmpeg
python3 music.py                   # -> build/soundtrack.wav
node render.mjs                    # -> out/supabase-launch.mp4 (60 fps, about 10 min)
FPS=30 node render.mjs             # faster 30 fps render
node render.mjs --stills 4.7,12.8  # spot-check individual frames -> build/still-*.jpg
```

To preview live in a browser, serve this folder (for example with `npx http-server`), open
`index.html` and click to play it with sound. Add `?t=12.8` to freeze the preview on a given timestamp.

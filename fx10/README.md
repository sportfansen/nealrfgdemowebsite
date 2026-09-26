# DBI: 10 animation concepts

Ten independent interaction ideas for dbi-motor-wrapping.pages.dev, built with DBI's Ferrari Purosangue photos plus Higgsfield edits and clips made from them.

| # | Section id | Idea | Interaction |
|---|---|---|---|
| 1 | `#ba` | Before / After PPF | drag handle (auto-sweeps once) |
| 2 | `#heal` | Self-healing test | press & hold (Space also works) |
| 3 | `#water` | Water beading | scroll-scrubbed frames |
| 4 | `#foam` | Wipe the foam | pointer "wash" mini-game |
| 5 | `#layers` | Exploded paint layers | scroll, 3D split + labels |
| 6 | `#config` | Wrap colour configurator | swatch → squeegee wipe |
| 7 | `#lamp` | Inspection lamp | cursor spotlight, split finish |
| 8 | `#shutter` | Garage shutter | scroll, roller door reveal |
| 9 | `#kinetic` | Kinetic type × cut-out car | scroll parallax |
| 10 | `#hscroll` | Services ride | scroll → horizontal cards, 3D tilt |

## Files
- `index.html`, `fx10.css`, `fx10.js`: the page (no dependencies). Asset URLs come from `window.FX10` or default to `assets/*.zip`.
- `tools/build_assets.py sources.json`: builds `assets/img.zip` (WebP stills), `heal.zip` (72 frames) and `water.zip` (96 frames). Needs ffmpeg and Pillow.
- `tools/make_demo.py urls.json > demo.html`: inlines the CSS and JS into one page.

Assets (~7.5 MB) are git-ignored; rebuild them with the tool.

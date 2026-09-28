# DBI Digital Garage

Four full redesigns of dbi-motor-wrapping.pages.dev, built from the DBI Instagram and showroom branding (grey walls, ceiling lightbox, tile floor, metallic gold logo).

| Page | Style |
|---|---|
| `night/` | Showroom Night: dark and cinematic, services as full-screen "bays" that stack on scroll |
| `daylight/` | Workshop Daylight: light concrete greys, the floor-tile grid as the page grid, service data sheets |
| `launch/` | Launch Night: the @dbiwrap Instagram look, profile header, poster type, English + Arabic |
| `service/` | Service Centre: classic auto-service layout (framed hero slider, icon band, about + car cut-out, service cards) in DBI gold and black |
| `index.html` | Picker linking to all four |

All four share `core/`:
- `garage.js`: the branded shutter (opens after 2.2 s or on scroll/tap/key), then the "Lights On" clip of the showroom lightbox flickering on, then the page. It also handles the hero video (desktop or phone cut), in-view video playback, scroll reveals and the every-angle car viewer.
- `garage.css`: shutter, lights, WhatsApp button, Instagram-style highlight circles, and the CSS showroom stage (lightbox, wall, tile floor, drain line) the car cut-outs sit on.

`media/` is not in git. It holds the site's own photos and videos (same file names as on pages.dev) plus `shutter-wide.webp`, `shutter-tall.webp`, `lights-wide.mp4` and `lights-tall.mp4`. Add `?nointro` to a URL to skip the opening.

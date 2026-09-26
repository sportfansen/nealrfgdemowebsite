#!/usr/bin/env python3
"""Pack the 10-concept assets into stored zips (one request each on the page).

    python3 tools/build_assets.py sources.json

sources.json: {"stills": {"after": "path-or-url", ...}, "heal": "video", "water": "video"}
Writes assets/img.zip (WebP stills, 1600 px; the cut-out keeps its alpha channel),
assets/heal.zip (72 frames) and assets/water.zip (96 frames, spaced by visual change).
Needs ffmpeg + Pillow; URLs are downloaded with curl.
"""
import io, json, os, subprocess, sys, tempfile, zipfile, glob
from PIL import Image

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(HERE, 'assets')
os.makedirs(OUT, exist_ok=True)
src = json.load(open(sys.argv[1]))
tmp = tempfile.mkdtemp()


def local(p, name):
    if p.startswith('http'):
        dst = os.path.join(tmp, name)
        subprocess.check_call(['curl', '-sfL', '-o', dst, p])
        return dst
    return p


def webp(im, q=80):
    b = io.BytesIO(); im.save(b, 'WEBP', quality=q, method=6); return b.getvalue()


with zipfile.ZipFile(os.path.join(OUT, 'img.zip'), 'w', zipfile.ZIP_STORED) as z:
    total = 0
    for name, p in src['stills'].items():
        im = Image.open(local(p, name + '.src'))
        keep_alpha = im.mode in ('RGBA', 'LA') and name == 'cutout'
        im = im.convert('RGBA' if keep_alpha else 'RGB')
        im.thumbnail((1600, 1600), Image.LANCZOS)
        data = webp(im, 82 if keep_alpha else 78)
        z.writestr(name + '.webp', data); total += len(data)
    print('img.zip', len(src['stills']), 'stills', round(total / 1e6, 2), 'MB')


def frames(video, name, count, width=1280, q=74):
    v = local(video, name + '.mp4'); d = os.path.join(tmp, name); os.makedirs(d)
    subprocess.check_call(['ffmpeg', '-v', 'error', '-i', v, '-vf', f'scale={width}:-2:flags=lanczos', f'{d}/%05d.png'])
    fs = sorted(glob.glob(d + '/*.png'))
    small = [Image.open(f).convert('L').resize((96, 54)) for f in fs]
    dist = [0.0]
    for a, b in zip(small, small[1:]):
        pa, pb = a.tobytes(), b.tobytes()
        dist.append(dist[-1] + sum(abs(x - y) for x, y in zip(pa, pb)) / len(pa) + .15)
    pick, j = [], 0
    for i in range(count):
        t = dist[-1] * i / (count - 1)
        while j < len(dist) - 1 and dist[j + 1] <= t: j += 1
        pick.append(fs[j])
    order = list(range(0, count, 8)) + [i for i in range(count) if i % 8]
    tot = 0
    with zipfile.ZipFile(os.path.join(OUT, name + '.zip'), 'w', zipfile.ZIP_STORED) as z:
        for i in order:
            data = webp(Image.open(pick[i]).convert('RGB'), q); z.writestr(f'f{i:03d}.webp', data); tot += len(data)
    print(name + '.zip', count, 'frames', round(tot / 1e6, 2), 'MB')


if src.get('heal'): frames(src['heal'], 'heal', 72)
if src.get('water'): frames(src['water'], 'water', 96)

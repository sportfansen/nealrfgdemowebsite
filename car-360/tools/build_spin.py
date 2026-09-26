#!/usr/bin/env python3
"""Turn a turntable video into a smooth 360° spinner.

    python3 tools/build_spin.py turntable.mp4 [--frames 120] [--width 1280] [--start 0] [--end auto]

Outputs, next to index.html:
    frames/f000.webp ... frames/fNNN.webp   evenly spaced frames, one full revolution
    frames/manifest.json                     frame list + playback settings
    standalone.html                          single-file demo (frames embedded), easy to share

Requires ffmpeg on PATH and Pillow.
"""
import argparse, base64, glob, json, os, re, shutil, subprocess, tempfile
from PIL import Image, ImageChops, ImageStat

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def probe_duration(path):
    err = subprocess.run(['ffmpeg', '-i', path], capture_output=True, text=True).stderr
    h, m, s = re.search(r'Duration: (\d+):(\d+):([\d.]+)', err).groups()
    return int(h) * 3600 + int(m) * 60 + float(s)


def diff(a, b):
    return ImageStat.Stat(ImageChops.difference(a, b)).mean[0]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('video')
    ap.add_argument('--frames', type=int, default=120)
    ap.add_argument('--width', type=int, default=1280)
    ap.add_argument('--quality', type=int, default=80)
    ap.add_argument('--start', type=float, default=0.0)
    ap.add_argument('--end', default='auto', help="seconds, or 'auto' = frame closest to the first one near the end")
    ap.add_argument('--reverse', action='store_true', help='flip drag direction')
    ap.add_argument('--model', default=None, help='optional GLB url for the 3D tab')
    args = ap.parse_args()

    tmp = tempfile.mkdtemp()
    dur = probe_duration(args.video)
    # 1) dump every frame (small) to find where the revolution closes
    subprocess.check_call(['ffmpeg', '-v', 'error', '-ss', str(args.start), '-i', args.video,
                           '-vf', 'scale=160:-1', f'{tmp}/s%04d.png'])
    small = sorted(glob.glob(f'{tmp}/s*.png'))
    fps = len(small) / max(0.01, dur - args.start)
    if args.end == 'auto':
        first = Image.open(small[0]).convert('L')
        tail = small[int(len(small) * 0.8):]
        scores = [(diff(first, Image.open(f).convert('L')), i) for i, f in enumerate(tail)]
        best = min(scores)[1] + int(len(small) * 0.8)
        end = args.start + best / fps
        print(f'loop closes at {end:.2f}s (frame {best}, diff {min(scores)[0]:.2f})')
    else:
        end = float(args.end)

    # 2) sample N evenly spaced frames over [start, end) — end frame == start frame, so exclude it
    span = end - args.start
    out_dir = os.path.join(HERE, 'frames')
    shutil.rmtree(out_dir, ignore_errors=True)
    os.makedirs(out_dir)
    step = span / args.frames
    subprocess.check_call(['ffmpeg', '-v', 'error', '-ss', str(args.start), '-t', str(span), '-i', args.video,
                           '-vf', f'fps={1/step:.6f},scale={args.width}:-2:flags=lanczos', '-frames:v', str(args.frames),
                           f'{tmp}/b%04d.png'])
    names = []
    for i, f in enumerate(sorted(glob.glob(f'{tmp}/b*.png'))):
        name = f'f{i:03d}.webp'
        Image.open(f).convert('RGB').save(os.path.join(out_dir, name), 'WEBP', quality=args.quality, method=6)
        names.append(name)
    manifest = {'frames': names, 'autoSpeed': round(len(names) / 7.5), 'pxPerFrame': max(3, round(720 / len(names))),
                'reverse': args.reverse}
    if args.model:
        manifest['model'] = args.model
    json.dump(manifest, open(os.path.join(out_dir, 'manifest.json'), 'w'), indent=1)
    total = sum(os.path.getsize(os.path.join(out_dir, n)) for n in names)
    print(f'{len(names)} frames, {total/1e6:.1f} MB')

    # 3) single-file standalone demo: inline CSS/JS, frames as data URIs
    html = open(os.path.join(HERE, 'index.html')).read()
    css = open(os.path.join(HERE, 'viewer360.css')).read()
    js = open(os.path.join(HERE, 'viewer360.js')).read().replace('export class', 'class')
    html = html.replace('<link rel="stylesheet" href="viewer360.css">', f'<style>{css}</style>')
    html = re.sub(r'<script type="importmap">.*?</script>\n', '', html, flags=re.S)
    inline = dict(manifest)
    inline['frames'] = ['data:image/webp;base64,' + base64.b64encode(open(os.path.join(out_dir, n), 'rb').read()).decode()
                        for n in names]
    inline.pop('model', None)  # the standalone page is spin-only
    html = html.replace("import { Viewer360 } from './viewer360.js';", js)
    html = html.replace('<script type="module">', '<script>window.SPIN_MANIFEST=' + json.dumps(inline) + ';</script>\n<script type="module">', 1)
    open(os.path.join(HERE, 'standalone.html'), 'w').write(html)
    print('standalone.html', round(os.path.getsize(os.path.join(HERE, 'standalone.html')) / 1e6, 1), 'MB')
    shutil.rmtree(tmp)


if __name__ == '__main__':
    main()

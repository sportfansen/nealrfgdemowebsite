#!/usr/bin/env python3
"""Build the scroll-effect assets from the three source videos.

    python3 tools/build_fx.py --intro lights-on.mp4 --wrap wrap.mp4 --drive drive-in.mp4

Writes into assets/:
    intro.mp4          1280px H.264, no audio, faststart (plays as a normal video)
    intro-last.jpg     last frame = the hero image the intro lands on
    wrap.zip           N frames, stored (uncompressed) zip, keyframes-first order
    wrap-first.jpg     poster shown until frames arrive
    drive.zip / drive-first.jpg
Requires ffmpeg + Pillow.
"""
import argparse, glob, io, json, os, shutil, subprocess, tempfile, zipfile
from PIL import Image

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(HERE, 'assets')


def ff(*a):
    subprocess.check_call(['ffmpeg', '-v', 'error', '-y', *a])


def sequence(video, name, count, width, quality, trim_start=0.0, trim_end=0.0):
    tmp = tempfile.mkdtemp()
    ff('-i', video, '-vf', f'scale={width}:-2:flags=lanczos', f'{tmp}/%05d.png')
    all_frames = sorted(glob.glob(f'{tmp}/*.png'))
    a = int(len(all_frames) * trim_start)
    b = len(all_frames) - int(len(all_frames) * trim_end)
    src = all_frames[a:b]
    pick = [src[round(i * (len(src) - 1) / (count - 1))] for i in range(count)]
    # keyframes first (every 8th), then the rest, so scrubbing works before the download finishes
    order = list(range(0, count, 8)) + [i for i in range(count) if i % 8]
    zpath = os.path.join(OUT, f'{name}.zip')
    total = 0
    with zipfile.ZipFile(zpath, 'w', zipfile.ZIP_STORED) as z:
        for i in order:
            b_ = io.BytesIO()
            Image.open(pick[i]).convert('RGB').save(b_, 'WEBP', quality=quality, method=6)
            z.writestr(f'f{i:03d}.webp', b_.getvalue())
            total += b_.tell()
    Image.open(pick[0]).convert('RGB').save(os.path.join(OUT, f'{name}-first.jpg'), quality=82)
    Image.open(pick[-1]).convert('RGB').save(os.path.join(OUT, f'{name}-last.jpg'), quality=86)
    shutil.rmtree(tmp)
    print(f'{name}: {count} frames from {len(src)} source frames, {total/1e6:.1f} MB')
    return count


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--intro'); ap.add_argument('--wrap'); ap.add_argument('--drive')
    ap.add_argument('--width', type=int, default=1600)
    ap.add_argument('--quality', type=int, default=78)
    args = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    counts = {}
    if args.intro:
        ff('-i', args.intro, '-an', '-vf', 'scale=1600:-2:flags=lanczos', '-c:v', 'libx264', '-preset', 'slow', '-crf', '21',
           '-pix_fmt', 'yuv420p', '-movflags', '+faststart', os.path.join(OUT, 'intro.mp4'))
        ff('-sseof', '-0.1', '-i', args.intro, '-frames:v', '1', '-q:v', '2', '-vf', 'scale=1600:-2', os.path.join(OUT, 'intro-last.jpg'))
        print('intro.mp4', round(os.path.getsize(os.path.join(OUT, 'intro.mp4')) / 1e6, 2), 'MB')
    if args.wrap:
        counts['wrapCount'] = sequence(args.wrap, 'wrap', 96, args.width, args.quality)
    if args.drive:
        counts['driveCount'] = sequence(args.drive, 'drive', 120, args.width, args.quality)
    json.dump(counts, open(os.path.join(OUT, 'counts.json'), 'w'))


if __name__ == '__main__':
    main()

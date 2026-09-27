#!/usr/bin/env python3
"""Bundle index.html + scrub.js into one self-contained demo page.

    python3 tools/make_demo.py assets.json > demo.html

assets.json maps asset names to their hosted URLs:
    {"intro": ..., "introPoster": ..., "wrap": ..., "wrapPoster": ..., "drive": ..., "drivePoster": ...}
Frame counts come from assets/counts.json. The intro's first frame is inlined as a
data-URI poster, and the video src is written into the markup, so the intro shows
on the very first paint and starts downloading while the page is still parsing.
"""
import base64, json, os, sys

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
urls = json.load(open(sys.argv[1]))
fx = dict(urls, **json.load(open(os.path.join(HERE, 'assets', 'counts.json'))))
html = open(os.path.join(HERE, 'index.html')).read()
js = open(os.path.join(HERE, 'scrub.js')).read().replace('export class', 'class').replace('export async function', 'async function')
html = html.replace("import { ScrollScrub, loadZipSequence } from './scrub.js';", js)
html = html.replace('<script type="module">', '<script>window.FX=' + json.dumps(fx) + ';</script>\n<script type="module">', 1)
poster = 'data:image/jpeg;base64,' + base64.b64encode(open(os.path.join(HERE, 'assets', 'intro-first.jpg'), 'rb').read()).decode()
html = html.replace('<video id="introVideo" muted playsinline preload="auto"></video>',
                    f'<video id="introVideo" muted playsinline preload="auto" src="{fx["intro"]}" poster="{poster}"></video>')
html = html.replace('<head>', f'<head>\n<link rel="preload" as="video" href="{fx["intro"]}" type="video/mp4">', 1)
sys.stdout.write(html)

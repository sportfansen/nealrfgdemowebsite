#!/usr/bin/env python3
"""Inline fx10.css + fx10.js into index.html → one self-contained page.

    python3 tools/make_demo.py urls.json > demo.html
urls.json: {"img": ..., "heal": ..., "water": ...}  (hosted zip URLs)
"""
import json, os, sys
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
urls = json.load(open(sys.argv[1]))
h = open(os.path.join(HERE, 'index.html')).read()
css = open(os.path.join(HERE, 'fx10.css')).read()
js = open(os.path.join(HERE, 'fx10.js')).read()
h = h.replace('<link rel="stylesheet" href="fx10.css">', '<style>' + css + '</style>')
h = h.replace('<script type="module" src="fx10.js"></script>',
              '<script>window.FX10=' + json.dumps(urls) + ';</script>\n<script type="module">' + js + '</script>')
sys.stdout.write(h)

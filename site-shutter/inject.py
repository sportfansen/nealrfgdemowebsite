#!/usr/bin/env python3
"""Add the garage-shutter opener to a static copy of the DBI site.

    python3 inject.py path/to/index.html

Inserts shutter-snippet.html right after <body ...> and preload hints in <head>.
Copy gate/gate-wide.webp and gate/gate-tall.webp next to the page.
"""
import os, re, sys

page = sys.argv[1]
snippet = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'shutter-snippet.html')).read()
html = open(page, encoding='utf-8').read()
if 'id="dbiGate"' in html:
    sys.exit('already injected')
preload = ('<link rel="preload" as="image" href="gate/gate-wide.webp" media="(orientation: landscape)">\n'
           '<link rel="preload" as="image" href="gate/gate-tall.webp" media="(orientation: portrait)">\n')
html = re.sub(r'(<head[^>]*>)', lambda m: m.group(1) + '\n' + preload, html, count=1)
html, n = re.subn(r'(<body[^>]*>)', lambda m: m.group(1) + '\n' + snippet, html, count=1)
if not n:
    sys.exit('no <body> tag found')
open(page, 'w', encoding='utf-8').write(html)
print('injected into', page)

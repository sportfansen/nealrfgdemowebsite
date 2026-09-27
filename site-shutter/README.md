# DBI garage-shutter opener

A branded roller shutter covers dbi-motor-wrapping on load. It opens by itself after 2.2 s, or straight away on scroll, swipe, tap or any key, and then the normal site is there.

- `shutter-snippet.html`: self-contained CSS, markup and JS. Paste it right after `<body>`.
- `inject.py index.html`: does that paste for you and adds preload hints in `<head>`.
- Needs `gate/gate-wide.webp` (16:9, desktop) and `gate/gate-tall.webp` (9:16, phones) next to the page. Both come in the kit zip on the demo site.

Skipped automatically for visitors with "reduce motion" turned on.

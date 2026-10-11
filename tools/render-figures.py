#!/usr/bin/env python3
"""Regenerate each teardown's architecture figure from its interactive diagram.

The article figures (<slug>/figures/<slug>.svg and @2x.png) are exported by
diagrams/template.html itself (its ?export mode), so they always match the
interactive diagram. Run after changing a diagram JSON or the template:

    python3 tools/render-figures.py            # every teardown on the homepage
    python3 tools/render-figures.py aider pi   # just these

Needs Google Chrome (or set CHROME=/path/to/chrome).
"""
import html
import http.server
import os
import re
import subprocess
import sys
import tempfile
import threading
from functools import partial
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CHROME = os.environ.get("CHROME", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")


def teardowns():
    """(slug, data param) for every homepage card, in homepage order."""
    index = (ROOT / "index.html").read_text()
    for card in re.findall(r'<div class="article" id="([\w-]+)">(.*?)</div>\s*</div>', index, re.S):
        m = re.search(r'href="diagrams/template\.html\?data=([^"]+)"', card[1])
        if m:
            yield card[0], m.group(1)


def chrome(*args):
    return subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", *args],
                          capture_output=True, text=True, timeout=120)


def main(only):
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *args):
            pass
    handler = partial(Quiet, directory=str(ROOT))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{server.server_address[1]}"
    failed = 0
    for slug, data in teardowns():
        if only and slug not in only:
            continue
        dom = chrome("--virtual-time-budget=10000", "--dump-dom",
                     f"{base}/diagrams/template.html?export&data={data}").stdout
        found = re.findall(r'<textarea id="svgExport">(.*?)</textarea>', dom, re.S)
        if not found:
            print(f"{slug}: export failed", file=sys.stderr)
            failed += 1
            continue
        svg = html.unescape(found[-1])
        out = ROOT / slug / "figures" / f"{slug}.svg"
        out.write_text(svg + "\n")
        w, h = (re.search(rf'\b{a}="(\d+)"', svg[:svg.index(">")]).group(1) for a in ("width", "height"))
        with tempfile.TemporaryDirectory() as tmp:
            png = Path(tmp) / "shot.png"
            chrome(f"--window-size={w},{h}", "--force-device-scale-factor=2",
                   f"--screenshot={png}", out.as_uri())
            if png.exists():
                png.replace(out.with_name(f"{slug}@2x.png"))
            else:
                print(f"{slug}: png screenshot failed", file=sys.stderr)
                failed += 1
        print(f"{slug}: {out.relative_to(ROOT)}")
    server.shutdown()
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(set(sys.argv[1:])))

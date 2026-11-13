#!/usr/bin/env python3
"""Joins rotty (asciiverse/rotty), this game's terminal layout
(asciiverse/game.js) and the browser game itself into one ES module for
QuickJS: the game's scripts in index.html's order become one classic
script, run unchanged; the page's <body> and the files the game fetches
are carried along as strings.

    python3 asciiverse/build.py OUT.mjs VERSION
"""
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RUNTIME = ["prelude.js", "dom.js", "term.js", "panel.js", "main.js"]


def main():
    out, version = Path(sys.argv[1]), sys.argv[2]
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    game = (ROOT / "asciiverse" / "game.js").read_text(encoding="utf-8")
    conf = json.loads(re.search(r"/\* BUILD (\{.*?\}) \*/", game, re.S).group(1))

    head_end = html.lower().find("</head>")
    scripts = re.findall(r'<script[^>]*\bsrc="([^"]+)"', html, re.I)
    inline = [m for m in re.findall(r"<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>", html, re.I | re.S)]
    source = []
    for src in scripts:
        source.append("// " + src + "\n" + (ROOT / src).read_text(encoding="utf-8"))
    source.extend(conf.get("inline", inline))
    body = re.search(r"<body[^>]*>(.*)</body>", html, re.I | re.S).group(1)
    body = re.sub(r"<script.*?</script>", "", body, flags=re.I | re.S)
    files = {f: (ROOT / f).read_text(encoding="utf-8") for f in conf.get("files", [])}

    parts = [(ROOT / "asciiverse" / "rotty" / f).read_text(encoding="utf-8") for f in RUNTIME]
    parts.append(game)
    parts.append("GAME.version = %s;" % json.dumps(version))
    parts.append("GAME.source = %s;" % json.dumps("\n;\n".join(source)))
    parts.append("GAME.body = %s;" % json.dumps(body))
    parts.append("GAME.files = %s;" % json.dumps(files))
    parts.append("MAIN.run();")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(parts) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()

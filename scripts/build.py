#!/usr/bin/env python3
"""Reproducible offline mini-tool ZIP build; downloads only public, SHA-pinned fonts."""
from __future__ import annotations

import hashlib
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app"
BUILD = ROOT / "build"
DIST = BUILD / "dist"
ZIP = BUILD / "xhs-minitool-cover-layout.zip"
FONT_DEST = DIST / "assets" / "fonts"
MAX_ZIP_SIZE = 10 * 1024 * 1024

# SHA values are SHA-1 of the git blob (including its "blob <size>\\0" prefix).
SOURCES = {
    "LXGWBright-Regular.woff2": (
        "https://raw.githubusercontent.com/lxgw/LxgwBright/v5.528/"
        "LXGWBright/LXGWBright-Regular.woff2",
        "e8ab4aff8ee9d29d2533b6a0be26c40f9a129692",
    ),
    "Cormorant-Regular.woff2": (
        "https://raw.githubusercontent.com/CatharsisFonts/Cormorant/master/"
        "fonts/webfonts/Cormorant-Regular.woff2",
        "09e4c2b117a0557e940b5bb9df82f0afb2549d8d",
    ),
    "HuiwenMincho-Source.otf": (
        "https://raw.githubusercontent.com/FourthLetter63/photo-collage/main/"
        "fonts/%E5%8C%AF%E6%96%87%E6%98%8E%E6%9C%9D%E9%AB%94.otf",
        "9bdd945525790fab64d61fba8c8d35f3e19064bb",
    ),
}


def git_blob_sha(data: bytes) -> str:
    return hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()


def download(url: str, target: Path, expected_git_blob_sha: str) -> None:
    req = urllib.request.Request(url, headers={"User-Agent": "xhs-minitool-cover-layout-builder/1.0"})
    with urllib.request.urlopen(req, timeout=120) as stream:
        content = stream.read()
    actual = git_blob_sha(content)
    if actual != expected_git_blob_sha:
        raise RuntimeError(f"Upstream source changed or incomplete: {target.name} ({actual})")
    target.write_bytes(content)
    print(f"Downloaded and verified: {target.name} ({len(content):,} bytes)")


def ui_text() -> str:
    # Fixed UI strings in HTML and code, including dynamic button labels/toasts.
    # Chinese and other non-ASCII punctuation are subset; Latin falls back to Cormorant.
    chars = set()
    for file in [APP / "index.html", APP / "assets" / "style.css", APP / "assets" / "main.js"]:
        chars.update(c for c in file.read_text(encoding="utf-8") if ord(c) > 127)
    # Keep normal Chinese/Western punctuation even when only dynamically constructed.
    chars.update('，。！？：；「」『』（）【】《》、—·“”‘’…％＋－')
    return ''.join(sorted(chars))


def ensure_source() -> None:
    if not (APP / "index.html").is_file():
        raise RuntimeError("Missing app/index.html")
    subprocess.run(["node", "--check", str(APP / "assets" / "main.js")], check=True)
    js = (APP / "assets" / "main.js").read_text(encoding="utf-8")
    html = (APP / "index.html").read_text(encoding="utf-8")
    if "<script src=\"./assets/main.js\"" not in html:
        raise RuntimeError("Expected external classic script not found")
    if re.search(r"<script(?![^>]+\bsrc=)[^>]*>", html, re.I) or "type=\"module\"" in html:
        raise RuntimeError("Inline/module scripts are forbidden")
    if re.search(r"https?://|(?<![a-z])fetch\s*\(|XMLHttpRequest|WebSocket", html + js):
        raise RuntimeError("Potential prohibited online resource or API in runtime")


def audit() -> None:
    allowed = {".html", ".css", ".js", ".json", ".woff", ".woff2", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"}
    files = [p for p in DIST.rglob("*") if p.is_file()]
    for p in files:
        if p.suffix.lower() not in allowed:
            raise RuntimeError(f"Unsupported mini-tool file: {p.relative_to(DIST)}")
        if p.is_symlink():
            raise RuntimeError(f"Symlink not allowed: {p}")
    if not (DIST / "index.html").is_file():
        raise RuntimeError("index.html is not ZIP root entry")
    for fname in ["LXGWBright-Regular.woff2", "Cormorant-Regular.woff2", "HuiwenMingchao-UI.woff2"]:
        p = FONT_DEST / fname
        if not p.is_file() or p.read_bytes()[:4] != b"wOF2":
            raise RuntimeError(f"Missing or invalid WOFF2 font: {fname}")
    with zipfile.ZipFile(ZIP, "r") as z:
        names = [i.filename for i in z.infolist()]
        if "index.html" not in names:
            raise RuntimeError("ZIP root index.html is missing")
        if not set(names) <= {p.relative_to(DIST).as_posix() for p in files}:
            raise RuntimeError("Unexpected ZIP contents")
        if z.testzip() is not None:
            raise RuntimeError("ZIP CRC failure")
    if ZIP.stat().st_size > MAX_ZIP_SIZE:
        raise RuntimeError(f"ZIP exceeds 10 MiB: {ZIP.stat().st_size:,} bytes")
    print(f"PASS: {len(files)} files; ZIP {ZIP.stat().st_size:,} bytes (limit {MAX_ZIP_SIZE:,})")


def main() -> None:
    ensure_source()
    BUILD.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory() as temporary:
        temp = Path(temporary)
        fonts = {}
        for name, (url, digest) in SOURCES.items():
            source = temp / name
            download(url, source, digest)
            fonts[name] = source
        (temp / "ui-chars.txt").write_text(ui_text(), encoding="utf-8")
        if DIST.exists():
            shutil.rmtree(DIST)
        shutil.copytree(APP, DIST)
        FONT_DEST.mkdir(exist_ok=True)
        shutil.copy2(fonts["LXGWBright-Regular.woff2"], FONT_DEST / "LXGWBright-Regular.woff2")
        shutil.copy2(fonts["Cormorant-Regular.woff2"], FONT_DEST / "Cormorant-Regular.woff2")
        subprocess.run([
            sys.executable, "-m", "fontTools.subset", str(fonts["HuiwenMincho-Source.otf"]),
            f"--text-file={temp / 'ui-chars.txt'}", "--flavor=woff2",
            f"--output-file={FONT_DEST / 'HuiwenMingchao-UI.woff2'}",
            "--layout-features=*",
        ], check=True)
    with zipfile.ZipFile(ZIP, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for p in sorted(DIST.rglob("*")):
            if p.is_file():
                z.write(p, arcname=p.relative_to(DIST).as_posix())
    audit()
    print(f"Wrote {ZIP}")


if __name__ == "__main__":
    main()
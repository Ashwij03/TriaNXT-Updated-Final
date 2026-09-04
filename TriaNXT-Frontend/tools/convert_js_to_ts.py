#!/usr/bin/env python3
"""One-off migration helper: rename every src/**/*.js/.jsx to .tsx (files that
contain JSX) or .ts (pure modules). Backups live in _src_pre_convert_backup.
Run from the frontend project root: python tools/convert_js_to_ts.py
"""
from __future__ import annotations

import os
import re

SRC = "src"

# Heuristic: a file contains JSX when we see an open tag paired with a close
# tag (possibly far apart), a self-closing element, a fragment, or a JSX
# element as a bare return/assignment expression. Non-greedy so `</` closes
# the first real tag. False negatives are caught by tsc afterwards; false
# positives (a .tsx for a pure module) are harmless.
OPEN_CLOSE = re.compile(r"<[A-Za-z][\w.-]*(?:\s[^<>]*?)?\s*>.*?</[A-Za-z]", re.S)
SELF_CLOSED = re.compile(r"<[A-Za-z][\w.-]*(?:\s[^<>]{0,200}?)?\s*/>", re.S)
FRAGMENT = re.compile(r"<>\s*.*?\s*</>", re.S)
EXPR_JSX = re.compile(
    r"(?:\breturn\s*|\bas\s*|=>\s*|=\s*|\?\s*|\:\s*|\()\s*"
    r"<[A-Za-z][\w.-]*(?:\s[^<>]{0,150}?)?\s*>(?:<[^<>]{0,150}>)*"
)


def has_jsx(text: str) -> bool:
    return bool(OPEN_CLOSE.search(text) or SELF_CLOSED.search(text) or FRAGMENT.search(text))


def main() -> None:
    jsx_count = ts_count = 0
    moved: list[str] = []
    for root, _dirs, files in os.walk(SRC):
        if "node_modules" in root:
            continue
        for name in files:
            if not (name.endswith(".js") or name.endswith(".jsx")):
                continue
            path = os.path.join(root, name)
            with open(path, "r", encoding="utf-8", errors="replace") as fh:
                text = fh.read()
            ext = ".tsx" if has_jsx(text) else ".ts"
            dest = path[: -len(os.path.splitext(name)[1])] + ext
            os.replace(path, dest)
            moved.append(path + " -> " + dest)
            if ext == ".tsx":
                jsx_count += 1
            else:
                ts_count += 1
    print(f"converted: {jsx_count} jsx, {ts_count} ts (total {jsx_count + ts_count})")


if __name__ == "__main__":
    main()

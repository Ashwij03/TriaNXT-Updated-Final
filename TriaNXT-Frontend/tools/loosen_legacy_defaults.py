#!/usr/bin/env python3
"""One-off migration helper (pass 2).

Remaining inference frictions from legacy JS:

1. Parameters with literal defaults (`function f(document = {})`,
   `list = []`) get their type inferred FROM the default, yielding `{}`
   (every member read errors TS2339) or `never[]`. Annotate those exact
   top-level parameter defaults as `any`.

2. Accumulator objects seeded empty then filled with arbitrary keys
   (`const errors = {}; errors.name = ...`) are typed `{}`; annotate the
   declaration with a string index signature.

3. `useState({})`/`useRef({})`/`useState([])` empty seeds get widened so
   later property access/pushes compile.

Run: python tools/loosen_legacy_defaults.py
"""
from __future__ import annotations

import os
import re

SRC = "src"

_OPEN = re.compile(
    r"(?:\b(function|export)\s+[\w$]*\s*\(|"
    r"\b(?:const|let|var)\s+[\w$]+\s*=\s*(?:async\s+)?(?:function\s*)?\(|"
    r"\b(?:memo|forwardRef|useCallback|useMemo|createContext|React\.memo)\s*\()"
)

_CONST_EMPTY = re.compile(r"\b(const|let|var)\s+([\w$]+)\s*=\s*\{\}(?=[\s;)}\]]|$)")
_STATE_EMPTY = re.compile(r"\b(useState|useRef)\(\{\}\)")
_STATE_EMPTY_ARR = re.compile(r"\buseState\(\[\]\)")
_ID_DEF = re.compile(r"^\s*([\w$]+)\s*=\s*(\{\}|\[\])\s*$")


def _scan_param_lists(text: str):
    spans = []
    for m in _OPEN.finditer(text):
        i = text.find("(", m.start())
        if i < 0:
            continue
        depth = 0
        j = i
        in_str = None
        while j < len(text):
            c = text[j]
            if in_str:
                if c == "\\":
                    j += 2
                    continue
                if c == in_str:
                    in_str = None
            elif c in "\"'`":
                in_str = c
            elif c in "([{":
                depth += 1
            elif c in ")]}":
                depth -= 1
                if depth == 0 and c == ")":
                    break
            j += 1
        if j < len(text):
            spans.append((i, j + 1))
    return spans


def _split_top_level(seg: str):
    """Split a parameter-list body on top-level commas (respecting nesting
    and strings). Returns list of (start, end) param offsets inside seg."""
    parts = []
    depth = 0
    in_str = None
    start = 0
    for idx, c in enumerate(seg):
        if in_str:
            if c == "\\":
                continue
            if c == in_str:
                in_str = None
            continue
        if c in "\"'`":
            in_str = c
        elif c in "([{":
            depth += 1
        elif c in ")]}":
            depth -= 1
        elif c == "," and depth == 0:
            parts.append((start, idx))
            start = idx + 1
    parts.append((start, len(seg)))
    return parts


def _fix_params(text: str) -> str:
    out = []
    prev = 0
    changed = False
    for s, e in _scan_param_lists(text):
        seg = text[s:e]
        seg_fixed = seg
        # find the body between '(' and ')'
        inner = seg[1:-1]
        pieces = _split_top_level(inner)
        replacements = []
        for ps, pe in pieces:
            piece = inner[ps:pe]
            mm = _ID_DEF.match(piece)
            if mm:
                ident, default = mm.group(1), mm.group(2)
                if not piece[: mm.start()].rstrip().endswith(":"):
                    if default == "{}":
                        replacements.append((ps, pe, f"{ident}: any = {{}}"))
                    else:
                        replacements.append((ps, pe, f"{ident}: any = []"))
        if replacements:
            buf = []
            p = 0
            for ps, pe, rep in replacements:
                buf.append(inner[p:ps])
                buf.append(rep)
                p = pe
            buf.append(inner[p:])
            seg_fixed = "(" + "".join(buf) + ")"
        if seg_fixed != seg:
            out.append(text[prev:s])
            out.append(seg_fixed)
            prev = e
            changed = True
    if changed:
        out.append(text[prev:])
        return "".join(out)
    return text


def main() -> None:
    touched = 0
    for root, _dirs, files in os.walk(SRC):
        if "node_modules" in root:
            continue
        for name in files:
            if not (name.endswith(".ts") or name.endswith(".tsx")):
                continue
            path = os.path.join(root, name)
            with open(path, "r", encoding="utf-8", errors="replace") as fh:
                text = fh.read()
            orig = text
            text = _fix_params(text)
            text = _CONST_EMPTY.sub(r"\1 \2: Record<string, any> = {};", text)
            text = _STATE_EMPTY.sub(r"\g<1><Record<string, any>>({})", text)
            text = _STATE_EMPTY_ARR.sub(r"useState<any[]>([])", text)
            if text != orig:
                with open(path, "w", encoding="utf-8", newline="") as fh:
                    fh.write(text)
                touched += 1
    print(f"touched {touched} files")


if __name__ == "__main__":
    main()

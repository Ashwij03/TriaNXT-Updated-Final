#!/usr/bin/env python3
"""One-off migration helper.

Legacy JS components/services often declare parameters by destructuring
WITHOUT any type annotation. When a pattern mixes defaulted and
non-defaulted names (e.g. `function K({ title, variant = "blue" })`),
TypeScript infers a props type whose non-defaulted members are *required*
`any`, which makes every call site that omits them fail to compile.

This pass appends an explicit `: any` parameter annotation to every
unannotated destructured parameter so the legacy boundary typechecks
loosely, exactly like the original plain JS. Runtime behavior is untouched
(a type annotation is erased at compile time). No file with existing
annotations is modified.

Run from the frontend project root: python tools/annotate_legacy_props.py
"""
from __future__ import annotations

import os
import re
import sys

SRC = "src"

_PARAM_OPEN = re.compile(r"(function\s+[\w$]*\s*\(|\b(?:const|let|var)\s+[\w$]+\s*=\s*(?:async\s+)?(?:\(|\b(?:function\b))|\bexport\s+default\s+function\s*[\w$]*\s*\()")


def find_destructured_params(text: str):
    """Yield (start, end) byte-ish char offsets of `{ ... }` patterns that are
    function/arrow parameters and are not already annotated."""
    results = []
    i = 0
    n = len(text)
    while i < n:
        m = _PARAM_OPEN.search(text, i)
        if not m:
            break
        # position right after the opening '(' (or at the char after `(`);
        # arrows like `const f = ({a}) => ...` have '(' before '{'; the
        # pattern above consumed up to '(' for the arrow form.
        j = m.end()
        # skip whitespace
        while j < n and text[j] in " \t\r\n":
            j += 1
        if j < n and text[j] == "{":
            # find matching close brace (nested braces inside defaults ok)
            depth = 0
            k = j
            while k < n:
                c = text[k]
                if c == "{":
                    depth += 1
                elif c == "}":
                    depth -= 1
                    if depth == 0:
                        break
                k += 1
            if k >= n:
                i = m.end()
                continue
            # look past the closing brace for an annotation or `= default`
            after = k + 1
            probe = text[after : after + 40].lstrip(" \t\r\n")
            if probe.startswith(":") or probe.startswith("="):
                # annotated `: T` or default `= {}`; if it's `= {}` the
                # pattern yields {} typing -> still annotate to any
                if probe.startswith(":") and not probe.startswith(": any") and not probe.startswith(":any"):
                    i = after
                    continue  # already typed; skip
            # also skip when param list has trailing ')' right away? the
            # close-brace we found IS the param pattern end; annotations for
            # function decls appear right after '}'.
            results.append((j, k + 1, after))
            i = k + 1
        else:
            i = m.end()
    return results


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
            params = find_destructured_params(text)
            if not params:
                continue
            out = []
            prev = 0
            for start, end, after in sorted(params):
                out.append(text[prev:start])
                out.append(text[start:end])
                # insert annotation after the pattern's closing '}'
                out.append(": any")
                prev = after
            out.append(text[prev:])
            new_text = "".join(out)
            if new_text != text:
                with open(path, "w", encoding="utf-8", newline="") as fh:
                    fh.write(new_text)
                touched += 1
    print(f"annotated {touched} files")


if __name__ == "__main__":
    main()

#!/usr/bin/env python
"""Precise structural validation for CTMSScripts.sql (no DB required)."""
import io
import re
import sys
from collections import Counter

PATH = "TriaNxtEngine-Backend/sql/CTMSScripts.sql"


def main():
    with io.open(PATH, encoding="utf-8") as f:
        text = f.read()
    lines = text.split("\n")
    errors = []

    # --- 1. paren balance ----------------------------------------------------
    depth = 0
    in_string = False
    for i, ch in enumerate(text):
        if ch == "'" and (i == 0 or text[i - 1] != "\\"):
            in_string = not in_string
        if not in_string:
            if ch == "(":
                depth += 1
            elif ch == ")":
                depth -= 1
                if depth < 0:
                    errors.append(f"Unbalanced ')' at char {i}")
                    depth = 0
    if depth != 0:
        errors.append(f"Unbalanced '(' at EOF (depth {depth})")

    # --- 2. enums + tables with line numbers ---------------------------------
    enums = {}
    tables = {}
    current_block = None
    for lineno, line in enumerate(lines, 1):
        m = re.match(r"CREATE TYPE (\w+) AS ENUM", line)
        if m:
            enums[m.group(1)] = lineno
            current_block = ("type", m.group(1))
            continue
        m = re.match(r"CREATE TABLE (\w+)", line)
        if m:
            tables[m.group(1)] = lineno
            current_block = ("table", m.group(1))
            continue
        if line.strip() == ");":
            current_block = None
        # FK ordering: REFERENCES x must exist already (self-ref allowed)
        for ref in re.findall(r"REFERENCES (\w+)\(", line):
            if ref in tables and tables[ref] < lineno:
                continue
            if current_block and current_block[0] == "table" and current_block[1] == ref:
                continue  # self-referential FK inside its own CREATE TABLE
            errors.append(f"L{lineno}: REFERENCES {ref} before its CREATE TABLE")

    # --- 3. every *_status / *_type / *_disposition token --------------------
    tokens = Counter()
    for line in lines:
        for tok in re.findall(r"\b(\w+_(?:status|type|disposition))\b", line):
            tokens[tok] += 1
    unknown = [t for t in tokens if t not in enums]
    legit_columns = set()
    for m in re.finditer(
        r"^\s+(\w+_(?:status|type|disposition))\s+(VARCHAR|TEXT|JSONB|BOOLEAN|DATE|TIMESTAMP|INT|NUMERIC|BIGINT)",
        text,
        re.M,
    ):
        legit_columns.add(m.group(1))
    unknown = [
        t
        for t in tokens
        if t not in enums and t not in legit_columns and not t.startswith("idx_")
    ]
    if unknown:
        errors.append(
            "tokens ending in _status/_type/_disposition not defined as enums: "
            + ", ".join(sorted(unknown))
        )

    # --- 4. section numbering -------------------------------------------------
    headers = re.findall(r"^-- (\d+)\.\s+(.+?)\s*$", text, re.M)
    nums = [int(n) for n, _ in headers]
    if nums != list(range(1, len(headers) + 1)):
        missing = set(range(1, len(headers) + 1)) - set(nums)
        dupes = sorted({n for n in nums if nums.count(n) > 1})
        errors.append(
            f"Section numbers not sequential ({len(headers)} headers); "
            f"missing={missing or None} duplicates={dupes or None}"
        )

    # --- 5. duplicates ---------------------------------------------------------
    for name, c in Counter(re.findall(r"^CREATE TABLE (\w+)", text, re.M)).items():
        if c > 1:
            errors.append(f"table {name} defined {c}x")
    for name, c in Counter(re.findall(r"^CREATE TYPE (\w+)", text, re.M)).items():
        if c > 1:
            errors.append(f"type {name} defined {c}x")

    if errors:
        print("VALIDATION FAILED:")
        for e in errors:
            print("  -", e)
        sys.exit(1)

    print(
        f"OK — {len(tables)} tables, {len(enums)} enums, "
        f"{len(headers)} sections, parens balanced"
    )
    print("tables:", ", ".join(sorted(tables)))
    print("enums :", ", ".join(sorted(enums)))


if __name__ == "__main__":
    main()
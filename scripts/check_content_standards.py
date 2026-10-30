#!/usr/bin/env python3
"""Fail the build if tracked content contains an EM-DASH or an EMOJI (ADR-0067).

House rule for every product: no emojis and no em-dashes in repo content (code, docs, UI strings,
commit-tracked files alike). This guard enforces it structurally.

Flags:
  - EM-DASH U+2014 and HORIZONTAL BAR U+2015.
  - EMOJI: codepoints in U+1F000..U+1FAFF plus the emoji-presentation selector U+FE0F. Functional
    glyphs stay allowed: info mark U+24D8, middot U+00B7, arrows like U+2197, check/cross marks.

Not flagged: ASCII "--" and the en-dash U+2013.

Scanned set = git-tracked text files only. Exit 1 on any hit, printing file:line:col.
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SELF = "scripts/check_content_standards.py"

BANNED_DASHES = {0x2014, 0x2015}  # em dash, horizontal bar
EMOJI_SELECTOR = 0xFE0F


def is_emoji(cp: int) -> bool:
    return 0x1F000 <= cp <= 0x1FAFF or cp == EMOJI_SELECTOR


TEXT_SUFFIXES = {
    ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".md", ".json",
    ".css", ".html", ".yml", ".yaml", ".toml", ".txt", ".cfg", ".ini", ".svg",
    ".kt", ".kts", ".java", ".cpp", ".h", ".hpp", ".c", ".gradle", ".pro",
}


def tracked_files() -> list[str]:
    out = subprocess.run(
        ["git", "ls-files"], cwd=ROOT, capture_output=True, text=True, check=True
    )
    return [ln.strip() for ln in out.stdout.splitlines() if ln.strip()]


def main() -> int:
    hits: list[str] = []
    for rel in tracked_files():
        if rel == SELF or Path(rel).suffix.lower() not in TEXT_SUFFIXES:
            continue
        try:
            lines = (ROOT / rel).read_text(encoding="utf-8").splitlines()
        except (OSError, UnicodeDecodeError):
            continue
        for lineno, line in enumerate(lines, 1):
            for col, ch in enumerate(line, 1):
                cp = ord(ch)
                if cp in BANNED_DASHES:
                    hits.append(f"  {rel}:{lineno}:{col}  em-dash (U+{cp:04X})")
                elif is_emoji(cp):
                    hits.append(f"  {rel}:{lineno}:{col}  emoji (U+{cp:04X} {ch!r})")

    if not hits:
        print("check_content_standards: OK, no em-dash or emoji in tracked content.")
        return 0

    print("::error::banned characters found (no em-dash, no emoji in product content, ADR-0067):")
    for h in hits:
        print(h)
    print("\nReplace an em-dash with a comma, colon, semicolon, period, parentheses, or a middot "
          "as the sense requires. Remove emojis. This applies to code, docs, and UI strings alike.")
    return 1


if __name__ == "__main__":
    sys.exit(main())

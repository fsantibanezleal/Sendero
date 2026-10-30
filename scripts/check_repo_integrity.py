#!/usr/bin/env python3
"""Repository integrity guard for Sendero (a PUBLIC repository).

Fails when the repository breaks its base hygiene rules:
  1. No tracked secrets or signing material: .env files, keystores (.jks, .keystore, .p12, .pem, .key),
     keystore.properties, service-account files.
  2. No local machine paths (a drive-letter path into a repos, data, models, temp or users folder, or a
     Unix home path) inside tracked text files.
  3. Version coherence: VERSION (display X.XX.XXX) agrees with package.json and app.json (semver).
  4. CHANGELOG.md mentions the current VERSION (or the repository is still at 0.00.000).
  5. Every bundled third-party asset (files under assets/music, assets/voice, assets/models,
     assets/fonts) is named in ASSETS.md, so no asset ships without its source and licence.

Stdlib only. Exit 1 on any violation, printing every finding.
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SELF = Path(__file__).name

TEXT_SUFFIXES = {
    ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".md", ".json", ".css", ".html", ".yml",
    ".yaml", ".toml", ".txt", ".cfg", ".ini", ".svg", ".kt", ".kts", ".java", ".gradle", ".pro",
    ".ps1", ".sh", ".xml", ".properties",
}
LOCAL_PATH_PATTERNS = [
    re.compile(r"\b[A-Za-z]:[\\/]+_?(Repos|Datos|Data|Models|Temp|Training|venvs|worktrees)\b", re.IGNORECASE),
    re.compile(r"\b[A-Za-z]:[\\/]+Users[\\/]+", re.IGNORECASE),
    re.compile(r"(?<![\w.])/(home|Users)/[a-z][\w.-]*/", re.IGNORECASE),
]
SECRET_NAMES = {"keystore.properties", "credentials.json", "service-account.json", "google-services.json"}
SECRET_SUFFIXES = {".jks", ".keystore", ".p12", ".pem", ".key", ".p8"}
ALLOWED_ENV = {".env.example"}
ASSET_DIRS = ("assets/music/", "assets/voice/", "assets/models/", "assets/fonts/")
ASSET_IGNORED = {"README.md", ".gitkeep"}


def tracked_files() -> list[str]:
    out = subprocess.run(["git", "ls-files"], cwd=ROOT, capture_output=True, text=True, check=True)
    return [ln.strip() for ln in out.stdout.splitlines() if ln.strip()]


def display_to_semver(display: str) -> str:
    major, minor, patch = display.strip().split(".")
    return f"{int(major)}.{int(minor)}.{int(patch)}"


def check_secrets(files: list[str]) -> list[str]:
    problems = []
    for rel in files:
        p = Path(rel)
        if p.name.startswith(".env") and p.name not in ALLOWED_ENV:
            problems.append(f"tracked environment file: {rel}")
        elif p.name in SECRET_NAMES or p.suffix.lower() in SECRET_SUFFIXES:
            problems.append(f"tracked secret or signing file: {rel}")
    return problems


def check_local_paths(files: list[str]) -> list[str]:
    problems = []
    for rel in files:
        p = Path(rel)
        if p.name == SELF or p.suffix.lower() not in TEXT_SUFFIXES:
            continue
        try:
            text = (ROOT / rel).read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        for lineno, line in enumerate(text.splitlines(), 1):
            if any(pat.search(line) for pat in LOCAL_PATH_PATTERNS):
                problems.append(f"local machine path: {rel}:{lineno}")
    return problems


def check_versions() -> list[str]:
    problems = []
    display = (ROOT / "VERSION").read_text(encoding="utf-8").strip()
    if not re.fullmatch(r"\d+\.\d{2}\.\d{3}", display):
        return [f"VERSION must be the X.XX.XXX display form, got '{display}'"]
    semver = display_to_semver(display)
    pkg = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
    if pkg.get("version") != semver:
        problems.append(f"package.json version {pkg.get('version')} != VERSION {display} (semver {semver})")
    app = json.loads((ROOT / "app.json").read_text(encoding="utf-8"))
    if app.get("expo", {}).get("version") != semver:
        problems.append(f"app.json expo.version {app.get('expo', {}).get('version')} != semver {semver}")
    changelog = (ROOT / "CHANGELOG.md").read_text(encoding="utf-8")
    if display != "0.00.000" and f"[{display}]" not in changelog:
        problems.append(f"CHANGELOG.md has no section [{display}]")
    return problems


def check_assets(files: list[str]) -> list[str]:
    bundled = [f for f in files if f.startswith(ASSET_DIRS) and Path(f).name not in ASSET_IGNORED]
    if not bundled:
        return []
    manifest = ROOT / "ASSETS.md"
    if not manifest.exists():
        return [f"ASSETS.md is missing but {len(bundled)} third-party asset files are tracked"]
    text = manifest.read_text(encoding="utf-8")
    return [f"asset not listed in ASSETS.md: {rel}" for rel in bundled if Path(rel).name not in text]


def main() -> int:
    files = tracked_files()
    problems = check_secrets(files) + check_local_paths(files) + check_versions() + check_assets(files)
    if problems:
        print("::error::repository integrity violations:")
        for p in problems:
            print(f"  {p}")
        return 1
    print("check_repo_integrity: OK (no secrets, no local paths, versions coherent, assets listed).")
    return 0


if __name__ == "__main__":
    sys.exit(main())

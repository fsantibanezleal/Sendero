"""Fit order-6 Fourier series to the mean sagittal gait curves of the Fukuchi 2018 dataset.

    python -m pipeline.gait.fit

Input (data root, never extracted into the repository): gait/WBDSascii.zip and gait/WBDSinfo.csv from
https://doi.org/10.6084/m9.figshare.5722711 (CC BY 4.0). Output: data/gait/fukuchi2018-sagittal.json and, for
inspection, gait/fit-check.csv in the data root.

The files are overground comfortable-speed joint angles, 101 samples over the gait cycle (Visual3D ISB-style
axes). The sagittal component is the Z column of every joint of the right side: flexion positive for the hip and
knee, dorsiflexion positive for the ankle, anterior tilt positive for the pelvis. The dataset already uses the
anatomical convention, so nothing is negated; fit() checks the observed ranges and fails when they disagree.
"""
from __future__ import annotations

import csv
import io
import re
import sys
import zipfile

import numpy as np

from pipeline import common
from pipeline.gait import fourier

ORDER = 6
YOUNG_MAX_AGE = 39  # under 40
OLDER_MIN_AGE = 50
COLUMNS = {
    "pelvisTilt": "RPelvisAngleZ",
    "hipFlexion": "RHipAngleZ",
    "kneeFlexion": "RKneeAngleZ",
    "ankleDorsiflexion": "RAnkleAngleZ",
}
SOURCE = {
    "citation": (
        "Fukuchi CA, Fukuchi RK, Duarte M (2018) A public dataset of overground and treadmill walking "
        "kinematics and kinetics in healthy individuals. PeerJ 6:e4640"
    ),
    "doi": "10.7717/peerj.4640",
    "data": "https://doi.org/10.6084/m9.figshare.5722711",
    "license": "CC BY 4.0",
}
OUT = common.REPO_ROOT / "data" / "gait" / "fukuchi2018-sagittal.json"
FILE_RE = re.compile(r"WBDS(\d+)walkOCang\.txt$")


def read_ages(path) -> dict[int, int]:
    ages = {}
    with open(path, encoding="utf-8-sig", newline="") as fh:
        for row in csv.DictReader(fh):
            ages[int(row["Subject"])] = int(row["Age"])
    return ages


def read_subject(text: str) -> dict[str, np.ndarray]:
    header = text.splitlines()[0].split("\t")
    data = np.genfromtxt(io.StringIO(text), skip_header=1, delimiter="\t")
    if data.shape != (101, len(header)):
        raise ValueError(f"unexpected shape {data.shape}")
    return {name: data[:, i] for i, name in enumerate(header)}


def check_convention(group: str, curves: dict[str, np.ndarray]) -> None:
    hip, knee, ankle = curves["hipFlexion"], curves["kneeFlexion"], curves["ankleDorsiflexion"]
    problems = []
    if not (20 < hip[0] < 45 and hip.min() < 0 and 40 <= hip.argmin() <= 60):
        problems.append("hip is not flexed at initial contact and extended near 50 percent")
    if not (50 <= knee.max() <= 70 and 62 <= knee.argmax() <= 80 and knee.min() > -5):
        problems.append("knee peak flexion is not about 55 to 65 degrees near 70 percent, or it hyperextends")
    if not (ankle.min() >= -20 and ankle.max() <= 15):
        problems.append("ankle is outside -20 to +15 degrees")
    if problems:
        raise ValueError(f"{group}: sign convention check failed: " + "; ".join(problems))


def main() -> int:
    root = common.data_root() / "gait"
    ages = read_ages(root / "WBDSinfo.csv")
    members: dict[str, list[np.ndarray]] = {"young": [], "older": []}
    member_ages: dict[str, list[int]] = {"young": [], "older": []}
    skipped_nan: list[str] = []
    with zipfile.ZipFile(root / "WBDSascii.zip") as zf:
        for name in sorted(zf.namelist()):
            m = FILE_RE.search(name)
            if not m:
                continue
            subject = int(m.group(1))
            age = ages[subject]
            group = "young" if age <= YOUNG_MAX_AGE else "older" if age >= OLDER_MIN_AGE else None
            if group is None:
                continue
            cols = read_subject(zf.read(name).decode("utf-8"))
            stack = np.stack([cols[c] for c in COLUMNS.values()])
            if np.isnan(stack).any():
                skipped_nan.append(name)
                continue
            members[group].append(stack)
            member_ages[group].append(age)

    groups, check_rows = {}, []
    for group in ("young", "older"):
        mean = np.mean(np.stack(members[group]), axis=0)  # (4, 101)
        mean100 = {k: mean[i, :100] for i, k in enumerate(COLUMNS)}  # the 101st sample repeats the first
        check_convention(group, {k: mean[i] for i, k in enumerate(COLUMNS)})
        curves = {}
        for key, y in mean100.items():
            f = fourier.fit(y, ORDER)
            curves[key] = f
            fitted = fourier.evaluate(f, np.arange(100) / 100.0)
            check_rows += [(group, key, i, y[i], fitted[i]) for i in range(100)]
            print(f"{group:6s} {key:18s} range {y.min():7.2f} .. {y.max():7.2f} deg  rms {f['rmsDeg']:.3f} deg")
        groups[group] = {
            "subjects": len(members[group]),
            "ageMean": round(float(np.mean(member_ages[group])), 1),
            "speedLabel": "overground comfortable",
            "curves": curves,
        }
    common.write_json(OUT, {
        "version": 1, "source": SOURCE, "order": ORDER, "units": "degrees",
        "convention": "flexion and dorsiflexion positive", "groups": groups,
    })
    with open(root / "fit-check.csv", "w", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh, lineterminator="\n")
        w.writerow(["group", "curve", "phasePercent", "meanDeg", "fittedDeg"])
        for g, k, i, y, f in check_rows:
            w.writerow([g, k, i, f"{y:.4f}", f"{f:.4f}"])
    print(f"skipped for missing values: {len(skipped_nan)} {skipped_nan}")
    print({g: (len(members[g]), groups[g]["ageMean"]) for g in groups})
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (common.DataRootError, FileNotFoundError) as exc:
        print(f"FAILED: {exc}")
        sys.exit(1)

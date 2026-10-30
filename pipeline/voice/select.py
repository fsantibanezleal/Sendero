"""Voice selection by measured median F0 of the neutral synthesis of m01 (objective rule, nobody listens during the run).

`mujer` is the first candidate (in preference order) with median F0 at or above 165 Hz; `hombre` the first with
median F0 at or below 155 Hz. A voice is never pitch-shifted into the other gender: with no qualifying candidate
the choice is None and the caller reports BLOCKED.
"""
from __future__ import annotations

FEMALE_MIN_HZ = 165.0
MALE_MAX_HZ = 155.0


def pick(f0_by_id: dict, order: list, gender: str):
    for cid in order:
        f0 = f0_by_id.get(cid)
        if f0 is None:
            continue
        if gender == "female" and f0 >= FEMALE_MIN_HZ:
            return cid
        if gender == "male" and 0.0 < f0 <= MALE_MAX_HZ:
            return cid
    return None

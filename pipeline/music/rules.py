"""Composition rule for bundling a recording in the public repository.

A recording is bundled only when its composition is traditional, or its composer died before 1926 (the Mexican
term is life plus 100 years) AND it was published before 1931 (United States). An unknown composer, or one whose
death year is not established, excludes the item.
"""
from __future__ import annotations

MEXICAN_TERM_YEARS = 100
LAST_DEATH_YEAR_FREE = 1925  # died before 1926
FIRST_PUBLICATION_YEAR_NOT_FREE = 1931  # published before 1931


def decide(name: str | None, death_year: int | None, traditional: bool, published: int) -> tuple[bool, str]:
    if published >= FIRST_PUBLICATION_YEAR_NOT_FREE:
        return False, f"published {published}, not before {FIRST_PUBLICATION_YEAR_NOT_FREE} in the United States"
    if traditional:
        return True, f"traditional composition, published {published}"
    if not name:
        return False, (
            "composer not named in the Internet Archive or Library of Congress metadata and not identified "
            "from a cited source; excluded"
        )
    if death_year is None:
        return False, f"death year of {name} not established from a source; excluded"
    if death_year > LAST_DEATH_YEAR_FREE:
        return False, (
            f"composer {name} died {death_year}; Mexican term (life plus {MEXICAN_TERM_YEARS} years) runs to "
            f"{death_year + MEXICAN_TERM_YEARS}"
        )
    return True, f"composer {name} died {death_year} (before 1926), published {published} (before 1931)"

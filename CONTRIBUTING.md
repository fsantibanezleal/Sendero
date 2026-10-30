# Contributing

Thank you for helping Sendero. The app is a kiosk experience for a Dia de Muertos home altar, so changes are judged
first by how they feel at the altar: calm, warm and respectful.

## Branches

`main` holds released versions; `develop` integrates work. Create a branch `task/<topic>` from `develop`, open a pull
request into `develop`, and `develop` is promoted to `main` at a release.

## Before a pull request

```bash
npm run check    # typecheck, lint, tests and the repository guards
```

The guards reject an em-dash or an emoji in repository text, a secret or a personal path, and a version that
disagrees between `VERSION`, `package.json` and `app.json`.

## Content rules

- Repository text (code, comments, docs) is English. App strings shown to visitors are Spanish (Mexico).
- Every bundled asset must be redistributable (public domain, CC0, CC BY, MIT, Apache-2.0, Unlicense or our own
  work) and listed in `ASSETS.md` with its source and licence. Commercial recordings, including the Coco
  soundtrack, are never committed.
- No figures of children, no skulls or frightening imagery, no message that assigns guilt or belief.

## Versions

The display version is `X.XX.XXX` (in `VERSION`, `CHANGELOG.md`, the tag `vX.XX.XXX` and the staff panel); the
manifests (`package.json`, `app.json`) hold the semver form without padding. Bump by the nature of the change.

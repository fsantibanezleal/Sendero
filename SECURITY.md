# Security and privacy policy

## What the app does with the camera

Sendero shows the live front camera on screen and computes a person mask on the device during the reveal. Camera
frames are processed in memory only: they are never written to storage and never sent anywhere. The release build
declares no internet permission.

## Supported versions

Only the latest release receives fixes.

## Reporting a vulnerability

Report security or privacy issues privately to fsantibanez@gmail.com, not in a public issue. Include the app
version (shown in the staff panel), the device model and Android version, and the steps to reproduce. You will get
an answer within a week.

## Secrets

This repository is public and holds no secrets: the release keystore and its passwords are kept outside the
repository, and the build reads them from Gradle properties on the build machine. A pull request that adds a
keystore, a password, a token or a personal path is rejected by the repository guard
(`scripts/check_repo_integrity.py`).

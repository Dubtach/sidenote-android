# SideNote Android v1.5.1 — GitHub Actions CI fix

This patch fixes the final workflow test failure from the v1.5.0 build.

## What happened

The workflow decodes `SIDENOTE_GOOGLE_SERVICES_JSON_BASE64` into `app/google-services.json` before running the Node regression tests. The test incorrectly asserted that this file must not exist. That assertion passed locally (where the secret-generated file was absent) but failed in GitHub Actions (where the workflow correctly created it).

## Fix

The test now checks the actual security requirement: `app/google-services.json` is covered by `.gitignore`. The file may exist temporarily inside the CI runner for the Gradle build, but it must not be committed to the repository. Firebase configuration validation and OAuth checks remain unchanged.

## Version

- Android version: 1.5.1
- Version code: 108

# SideNote Android v1.5.1 — GitHub Actions CI fix

This patch fixes the final workflow test failure from the v1.5.0 build.

## What happened

The workflow decodes `SIDENOTE_GOOGLE_SERVICES_JSON_BASE64` into `app/google-services.json` before running the Node regression tests. The test incorrectly asserted that this file must not exist. That assertion passed locally (where the secret-generated file was absent) but failed in GitHub Actions (where the workflow correctly created it).

## Fix

The test now checks the actual security requirement: `app/google-services.json` is covered by `.gitignore`. The file may exist temporarily inside the CI runner for the Gradle build, but it must not be committed to the repository. Firebase configuration validation and OAuth checks remain unchanged.

## Version

- Android version: 1.5.1
- Version code: 108


## v1.5.2 follow-up

- Google sign-in now uses Credential Manager's explicit `GetSignInWithGoogleOption` for the visible Google button, with `googleid:1.2.1`.
- The build checks that `SIDENOTE_GOOGLE_WEB_CLIENT_ID` exactly matches a Web OAuth client included in the selected Android client's `google-services.json`.
- Added compact mobile sizing, a single-line horizontally scrollable selection toolbar, and double-back-to-exit after dismissing app surfaces.

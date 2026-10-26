# SideNote for Android

SideNote for Android is a full-screen Android app using the SideNote v2.6.2 interface, note model, smart editor, checklist renderer, page-link metadata, account UI, and Firebase REST sync. The 1.0.1 project update adds explicit authentication error diagnostics and GitHub Actions secret injection for the Google Web OAuth client ID. Version 1.1.0 adds a phone-first list/editor flow, keyboard-aware viewport sizing, larger touch targets, and mobile-optimized account/settings panels. The Android host provides the platform-specific storage shim, Google Credential Manager login, clipboard integration, native confirmation dialogs, and Android Share-sheet handling.

## What works in this project

- Local-first notes, auto-save, the two-column colorful note grid, search and sorting.
- Existing smart writing tools, ordered/bulleted/alphabetic lists, checklists, selection/bulk actions, pinning, duplication, merge and deletion.
- Themes, editor font sizes, profile avatars, and other preferences.
- Email/password Firebase Authentication, password reset and Firestore synchronization using the same `notebeedubtach` project and `/users/{uid}/...` data layout.
- Actionable authentication errors for common Firebase setup, API-key, and connectivity problems.
- Google Web OAuth client ID injected at build time from the `SIDENOTE_GOOGLE_WEB_CLIENT_ID` GitHub Actions secret; no client ID needs to be hardcoded in source.
- Automatic sync while open, reconnect sync, and localStorage persistence when offline.
- Google sign-in through Android Credential Manager after an Android OAuth Web client ID is configured.
- Share a webpage from Chrome or another browser to SideNote. After sharing it, open a note and use **Link page** to attach the URL as metadata without inserting it into note text.
- Native Android clipboard and confirmation dialogs.

The legacy Google Drive extension-backup controls and Chrome keyboard-shortcut settings are intentionally not shown in Android; the app uses SideNote account sync instead.

## Build an APK without Android Studio

**Recommended:** use GitHub Actions. This project includes `.github/workflows/build-apk.yml`, which builds a debug APK on GitHub's hosted runner. Your computer only needs a browser and Git; you do not need Android Studio or the Android SDK locally. Follow [BUILD_WITH_GITHUB_ACTIONS.md](BUILD_WITH_GITHUB_ACTIONS.md).

For a local command-line build, install a JDK 17 and Android SDK Platform 36 with matching Build Tools, then configure `ANDROID_HOME`/`ANDROID_SDK_ROOT`. On Windows run `gradlew.bat assembleDebug`; on macOS/Linux run `./gradlew assembleDebug`. The custom bootstrap downloads the official Gradle 8.13 distribution and verifies its SHA-256 checksum. The APK is written to `app/build/outputs/apk/debug/app-debug.apk`. See [ANDROID_SETUP.md](ANDROID_SETUP.md) for Firebase and Google sign-in setup, including login error troubleshooting.

The GitHub Actions workflow generates a **debug APK for personal testing**, not a production-signed release. Before distributing publicly, configure release signing and test the app on real devices.

## Firebase data and migration

The app uses the same Firebase project configuration as the extension. Sign in using the same account as SideNote Chrome to download cloud-synced notes. Notes that existed only in the Chrome extension's local storage must first be synced from the extension to Firebase; Chrome's local storage and Android app storage are separate sandboxes.

The app uses Firebase Authentication and Firestore REST calls from a local HTTPS WebView origin. It does not embed an admin key or service-account credential.


### v1.1.1 mobile usability polish

The phone UI uses full-screen list/editor navigation, keyboard-safe viewport sizing, larger writing controls, and a single-column note list on very narrow devices. See `MOBILE-UX-v1.1.1.md`.

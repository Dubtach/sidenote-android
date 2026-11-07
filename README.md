# SideNote Android v1.5.3

A phone-first Android app built from the SideNote editor and notes experience.

## Included

- Colorful two-column notes on wider phones/tablets and a readable single-column list on narrow phones.
- Smart lists, alphabetic/numbered list continuation, checklists, undo/redo, note appearance controls, and Trash with 30-day recovery.
- Long-press and drag multi-selection, bulk actions, note menus, linked-page metadata, and Android share intents.
- Balanced phone sizing, adaptive keyboard viewport, smooth nested scrolling, haptic feedback, subtle spring feedback, compact one-row selection actions, and double-back-to-exit behavior.
- Native Firebase Authentication for email/password and Credential Manager Sign in with Google button flow.
- Local-first note editing with Firestore REST synchronization compatible with the SideNote Chrome extension.

## Build without Android Studio

Use the GitHub Actions workflow at `.github/workflows/build-apk.yml`. Add the required secrets `SIDENOTE_GOOGLE_SERVICES_JSON_BASE64` and `SIDENOTE_GOOGLE_WEB_CLIENT_ID`, push the project to GitHub, then download the `SideNote-Android-debug-APK` artifact from Actions.

Start with `ANDROID_SETUP.md` for Firebase setup, OAuth fingerprints, sign-in troubleshooting, and install guidance. See `BUILD_WITH_GITHUB_ACTIONS.md` for the no-Android-Studio build process.

## Compatibility

- Package: `com.dubtach.sidenote`
- Firebase project: `notebeedubtach`
- Release: `1.5.3` (version code `110`)
- Firestore layout: `users/{uid}/notes/{noteId}` and `users/{uid}/meta/main`

The Android project does not include `google-services.json`; GitHub Actions injects it from repository secrets at build time. Never add service-account credentials or private keys to this repository.

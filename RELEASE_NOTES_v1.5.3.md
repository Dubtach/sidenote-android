# SideNote Android v1.5.3 — polished mobile release

- Android app version: 1.5.3 (version code 110).
- Rebalanced phone typography, note cards, headers, controls, and selection actions to avoid oversized and wrapping controls.
- Selection actions stay in one compact horizontal row with horizontal scrolling where needed.
- Improved spacing consistency across notes, editor, account, Trash, and Settings.
- Uses Credential Manager's explicit Sign in with Google button flow (`GetSignInWithGoogleOption`) with Google Identity library 1.2.1 and the Firebase Web application client ID.
- The GitHub workflow verifies that the configured Web client ID matches a Web OAuth client in the Firebase Android configuration before building.
- Added double-back-to-exit on the main notes screen. Back closes overlays, cancels selection, or returns from the editor before asking for a second press within 2.2 seconds to exit.
- Preserves Firebase notes, Trash, Undo/Redo, note appearance, Android native FirebaseAuth session, and local-first behavior.

## Build

Use the existing GitHub Actions workflow. Keep `SIDENOTE_GOOGLE_SERVICES_JSON_BASE64` and `SIDENOTE_GOOGLE_WEB_CLIENT_ID` configured. The workflow validates the project ID, package name, Web OAuth client match, runs regression tests, builds the debug APK, and prints its SHA fingerprints.

This source release was validated with automated tests and static checks. It was not compiled in this environment because the Android SDK/Gradle toolchain is not installed here.

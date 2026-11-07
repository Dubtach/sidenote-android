# SideNote Android v1.5.9

A phone-first Android app built from the SideNote editor and notes experience.

## Included

- User-selectable note layouts: two columns (default), single column, compact grid, and list.
- Smart lists, alphabetic/numbered list continuation, checklists, undo/redo, note appearance controls, and Trash with 30-day recovery.
- Long-press and drag multi-selection, bulk actions, note menus, and Trash with 30-day recovery. The Android app intentionally has no page-link controls or share-sheet integration; link metadata from Chrome remains preserved in synced notes.
- Compact, coordinated phone sizing; adaptive keyboard viewport; smooth nested scrolling; haptic/spring feedback; dimmed editor/account/settings sheets with outside-tap dismissal; and double-back-to-exit behavior.
- Native Firebase Authentication for email/password and Credential Manager Sign in with Google button flow.
- Local-first note editing with Firestore REST synchronization compatible with the SideNote Chrome extension.

## Build without Android Studio

Use the GitHub Actions workflow at `.github/workflows/build-apk.yml`. Add the required secrets `SIDENOTE_GOOGLE_SERVICES_JSON_BASE64` and `SIDENOTE_GOOGLE_WEB_CLIENT_ID`, push the project to GitHub, then download the `SideNote-Android-debug-APK` artifact from Actions.

Start with `ANDROID_SETUP.md` for Firebase setup, OAuth fingerprints, sign-in troubleshooting, and install guidance. See `BUILD_WITH_GITHUB_ACTIONS.md` for the no-Android-Studio build process.

## Compatibility

- Package: `com.dubtach.sidenote`
- Firebase project: `notebeedubtach`
- Release: `1.5.9` (version code `159`)
- Firestore layout: `users/{uid}/notes/{noteId}` and `users/{uid}/meta/main`

The Android project does not include `google-services.json`; GitHub Actions injects it from repository secrets at build time. Never add service-account credentials or private keys to this repository.


## v1.5.4 mobile update

See `RELEASE_NOTES_v1.5.4.md`. In Settings → Appearance, choose Two columns (default), Single column, Compact grid, or List. Page-link UI and Android share intents are removed from the phone app; Chrome page-link metadata remains compatible. Editor, account, and Settings open as dimmed bottom sheets and close on outside tap. The redundant footer is removed, the header keeps only the account name and sync indicator, and Trash is icon-only.


## Latest Android build fix

Version 1.5.5 includes the missing null-safe `safe(String)` helper that previously caused `cannot find symbol: method safe(String)` during Java compilation. See `RELEASE_NOTES_v1.5.5.md`.


## v1.5.6 mobile interaction update

See `RELEASE_NOTES_v1.5.6.md`. Untouched blank drafts are discarded with a toast and never synced. Android list controls use icon menus for sorting and card layout. Expanding writing tools preserves keyboard focus. Destructive confirmations use SideNote's own dialog, and scrollable surfaces have a damped rubber-band release effect with reduced-motion support.


## Latest update — v1.5.7

Trash is now a coordinated dimmed overlay; the writing toolbar visibility/touch behavior is stabilized; Delete is grouped with Pin at the bottom of the editor; Android editor header uses the X close control; and Editor, Account, Settings, and Trash have matched open/close animations. See `RELEASE_NOTES_v1.5.7.md`.


## v1.5.7 overlay and editor polish

Trash now behaves as a shared dimmed bottom-sheet overlay with outside-tap dismissal. The writing toolbar has a reliable visible state and horizontal scrolling on small screens. Delete now sits beside Pin in the editor bottom row, with an X close action in the header. Editor, Account, Settings, and Trash have coordinated entrance and exit motion. See `RELEASE_NOTES_v1.5.7.md`.


## Latest release — v1.5.9

Destructive and account confirmations now use an explicit native Android `AlertDialog` bridge, with separate Cancel/confirm callbacks, dismissal handling, a danger-colored destructive action, and a timeout fallback. This avoids relying on a WebView custom dialog or a WebChrome `window.confirm` callback for the app's primary destructive actions. Modal close timers are aligned to the restrained 130–150ms transition system. The obsolete footer Settings action has been removed. See `RELEASE_NOTES_v1.5.9.md`.

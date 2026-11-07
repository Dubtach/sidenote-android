# SideNote Android v1.5.2 — polished mobile release

## Google sign-in
- Replaced the generic `GetGoogleIdOption` call used by the explicit Google button with Credential Manager `GetSignInWithGoogleOption`.
- Updated Google Identity library to 1.2.1.
- Added clearer diagnostics for missing accounts, provider configuration failures, and OAuth SHA/signature errors.
- GitHub Actions now verifies the Web OAuth client secret matches a Web client entry in the selected Android app's `google-services.json`. It fails before Gradle build on mismatch.

## Mobile layout
- Rebalanced the Android type scale, card padding, top bar, settings rows, account sheet, editor, and bottom controls.
- Kept the selection toolbar on one compact horizontal row rather than wrapping into a large panel.
- Put note count inline with the section label and aligned Trash and Sort controls.
- Refined press/spring feedback and preserved reduced-motion behavior.

## Navigation
- Back dismisses open sheets, search, note menus, Trash, style chooser, selection mode, and the editor before exiting.
- On the main notes list, users press Back twice within 2.2 seconds to exit.

## Compatibility
- Firebase project: `notebeedubtach`.
- Package: `com.dubtach.sidenote`.
- Version: 1.5.2 (version code 109).
- Existing notes, Trash, undo/redo, page links, appearance presets, and Firestore schema are unchanged.

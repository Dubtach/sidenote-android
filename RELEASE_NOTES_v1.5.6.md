# SideNote Android v1.5.6 — draft handling and mobile interaction polish

## New note behavior
- Newly created notes remain transient until the user enters non-whitespace content in the title or body.
- Closing or switching away from an untouched blank draft discards it and shows a brief toast.
- Untouched drafts are excluded from local and cloud snapshots, so they cannot create empty synced notes.
- Once a user has written content, the note is treated as a real note even if they later clear the text.

## Notes list controls
- Android now uses compact icon-only Sort and View controls in the notes heading.
- Sort options: newest, oldest, title A–Z/Z–A, and most/fewest words.
- View options: two columns (default), single column, compact grid, and list.
- Both choices update the existing synced settings and the Appearance setting controls.

## Editor and confirmations
- Expanding writing tools on touch preserves the editor's active focus to avoid dismissing the Android keyboard.
- Destructive and account confirmations use a SideNote-styled dialog on Android rather than the WebView native confirm prompt.
- Confirmation dialogs have coordinated entrance/exit motion and can be dismissed with outside tap, Cancel, or Android Back.

## Motion and feedback
- Added a damped rubber-band pull at the top/bottom edges of the notes, settings, account, Trash, and editor scrolling surfaces, followed by a spring release.
- Added compact menu transitions, active touch feedback, and confirmation-sheet transitions.
- Reduced-motion preferences disable the added motion effects.

## Compatibility
- Keeps Firebase authentication, Google sign-in, Firestore sync schema, Trash lifecycle, note appearance, Undo/Redo, and existing note storage intact.
- Android package remains `com.dubtach.sidenote`.
- Version: 1.5.6 (version code 156).

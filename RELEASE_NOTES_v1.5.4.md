# SideNote Android v1.5.4

## Mobile interface update

- Added four note list arrangements in Settings → Appearance: Two columns (default), Single column, Compact grid, and List. The selected layout is stored in normal app settings and syncs with the same SideNote account.
- Removed webpage linking controls and Android share/open intent filters from the phone app. Webpage-link metadata remains preserved in synced note records for Chrome compatibility; Android no longer exposes page-link actions.
- Removed the redundant bottom save-status / Settings footer. The top account sync indicator remains the status source, and Settings stays in the top toolbar.
- Simplified the header account block to the profile name and sync indicator only.
- Changed Trash to an icon-only action with a small count badge.
- Converted the editor, account panel, and Settings into consistent dimmed/blurred mobile overlays. Tapping outside closes the active overlay; the editor preserves its content and saves before closing.
- Added a single gentle sign-in reminder after the first note created while signed out in an app session. It does not interrupt typing and is not repeated for every note.

## Compatibility

- Existing note records and Firestore schema are unchanged.
- Existing Firebase Authentication, Google Credential Manager, Trash, Undo/Redo, note appearance, and sync behavior are preserved.
- Existing Chrome client retains page-link features; Android hides those actions and preserves synced link metadata without changing it.

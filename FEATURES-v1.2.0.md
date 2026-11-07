# SideNote Android 1.2.0 — Trash, Undo/Redo & Note Appearance

## Trash (30-day recovery)

- Deleting a note moves it to Trash and stamps `trashedAt`; it does not erase the body.
- Trash cards show the deletion date and remaining retention time.
- Restore removes `trashedAt` and updates the note timestamp.
- Delete forever and Empty Trash write Firestore-compatible deletion tombstones.
- Expired notes are purged on startup and hourly while SideNote is running. The next sync propagates tombstones to other signed-in devices.

## Undo / Redo

- The writing toolbar contains Undo and Redo buttons.
- Keyboard shortcuts work when the note title or note body is focused: Ctrl/Cmd+Z for Undo, Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z for Redo.
- Input is grouped into short typing sessions; the editor keeps a bounded history and restores the selection/caret with a restored snapshot.

## Note appearance

- The paintbrush button opens note-specific appearance options.
- Seven paper colors: Butter, Peach, Blush, Sky, Lavender, Mint, and Sand.
- Five textures: Plain, Diagonal, Grid, Dots, and Lined.
- Both fields are saved with the note and included in Firestore synchronization.

## Compatibility

- Existing note IDs and storage keys are unchanged.
- Existing Firebase account and Firestore paths are unchanged.
- `trashedAt` is an additive note field. The companion SideNote Chrome v2.7.0 release understands it and supports the same Trash workflow; update both clients when using the same Firebase account.

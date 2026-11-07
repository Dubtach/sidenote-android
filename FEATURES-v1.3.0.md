# SideNote Android 1.3.0 — Trash Sync Conflict Hardening

## What changed

- Added the `trashStateAt` note field to record the latest explicit Trash or Restore action independently of ordinary content edits.
- Cross-device note merging now selects content by the latest `updatedAt`, but resolves Trash/Restore state using the latest lifecycle-action timestamp.
- An edit made offline on another device cannot silently restore a note that was subsequently moved to Trash.
- A later explicit Restore wins over an older Trash action, provided the note is still within its 30-day retention period.
- Permanent-deletion tombstones take precedence over stale offline copies, preventing a note deleted forever or expired from reappearing.
- Firestore reads/writes preserve `trashStateAt`; existing notes without the field remain compatible by falling back to `trashedAt`.

## Retention timing

The client checks expiry at app startup, when the app becomes visible again, and hourly while it is running. Expired notes are removed locally and recorded as permanent-deletion tombstones. Those tombstones are sent to Firestore at the next successful sync. This is client-driven cleanup, not a server-side scheduled job: if the app is closed or offline, cloud cleanup waits until a device next runs SideNote and successfully synchronizes.

## Existing features retained

- 30-day Trash with Restore, Delete forever, and Empty Trash.
- Undo/Redo buttons and Ctrl/Cmd+Z, Ctrl/Cmd+Y, Ctrl/Cmd+Shift+Z shortcuts for focused title/body fields.
- Seven note background colors and five paper textures through the editor paintbrush menu.
- Firebase Authentication, Firestore sync, offline local storage, page links, and mobile-first interface.

## Compatibility

The data model is additive; existing notes do not require a migration. Use Android v1.3.0 with the companion Chrome extension v2.8.0 for consistent Trash/Restore behavior across devices.

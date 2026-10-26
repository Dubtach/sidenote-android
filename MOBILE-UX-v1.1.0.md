# SideNote Android v1.1.0 — Mobile UX update

- Phone layout uses a full-screen notes list; opening a note switches to a full-screen editor.
- Added a prominent Back to notes control. Android system Back closes overlays first, returns from the editor to the list second, and exits only from the list.
- Improved touch targets, card typography, note previews, sorting controls, and editor action buttons.
- Settings now uses a full-screen mobile panel with larger preference rows and switches. The account panel is a bottom sheet with scrollable content.
- Added a dedicated empty-list state with a primary Create a note action.
- The app follows Android's resized visible viewport when the keyboard opens, so the writing area remains usable without the keyboard covering it.
- Existing note storage, note schema, Firebase paths, OAuth build secret, and share-to-app flow are unchanged.

## Build

Use the existing GitHub Actions workflow. Push the updated project to your repository and download the `SideNote-Android-debug-APK` artifact from the successful workflow run.

## Testing note

Static syntax, manifest, resource, and ZIP checks are performed for this source bundle. The APK still needs a GitHub Actions build and device testing for the final keyboard, back-navigation, and touch behavior.

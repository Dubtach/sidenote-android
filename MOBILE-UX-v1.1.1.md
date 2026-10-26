# SideNote Android v1.1.1 — Mobile usability polish

- Kept the phone-first navigation: list and editor each use the full available screen.
- Fixed initial navigation class placement so the app shell, not the document root, owns the list/editor state.
- Fixed the empty-notes layout so the notes grid no longer consumes the space needed by the welcome state.
- Improved narrow-screen behavior: very narrow phones switch to a single-column note list for legible titles and previews.
- Tuned editor typography for mobile reading and made the title size responsive.
- Improved keyboard-safe sizing and scroll padding for settings, account, and editor areas.
- Enlarged/standardized key controls for touch input while keeping the interface compact.
- Firebase account configuration, Google OAuth build secret, local note schema, page-link behavior, share-to-app flow, and smart editor logic remain unchanged.

## Build

Push this project to the existing GitHub repository, then run the `Build SideNote Android APK` workflow. Download the `SideNote-Android-debug-APK` artifact from the successful run.

## Validation note

Run JavaScript/HTML/CSS/XML checks locally or use the GitHub Actions build before installing. Physical device testing is still recommended for keyboard resizing, Android back navigation, and touch feel.

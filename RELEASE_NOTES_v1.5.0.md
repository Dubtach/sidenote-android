# SideNote Android v1.5.0

## Authentication

- Moved Android email/password authentication to the native Firebase Authentication SDK.
- Moved Google sign-in to Android Credential Manager → Google ID token → FirebaseAuth credential exchange.
- Added clearer Firebase configuration, provider, network, and OAuth error messages.
- Native Firebase SDK restores persistent sessions across app launches.
- Preserved the native session marker during ID token refresh so Firestore sync continues after token expiry.
- Keeps a locally authenticated account visible through a temporary offline token-refresh failure; sync retries when connectivity returns.
- GitHub Actions validates required Firebase Android and Web OAuth configuration before building.

## Mobile experience

- Increased header, toolbar, note card, editor, settings, and account controls for touch use.
- Larger title and body typography for comfortable phone reading/writing.
- Uses a single-column note list on narrow phones and two columns on wider screens/tablets.
- Improved note card spacing, menu hit areas, settings rows, account bottom sheet, and Trash controls.
- Improved native WebView overscroll, nested scrolling, keyboard resize behavior, and scrollbar presentation.
- Shortened Android long-press selection activation and retained drag-across selection with haptic feedback.
- Added subtle spring/squish interactions while respecting reduced-motion preferences.

## Data compatibility

- Keeps the existing Firestore document structure and SideNote Chrome compatibility.
- Preserves local-first editing, Trash retention/tombstones, undo/redo, note color/texture, linked-page metadata, and note management features.
- No note schema migration is required.

## Build

- App version: 1.5.0 (version code 107).
- Build with GitHub Actions; Android Studio is not required on the local PC.
- Requires GitHub Actions secrets `SIDENOTE_GOOGLE_SERVICES_JSON_BASE64` and `SIDENOTE_GOOGLE_WEB_CLIENT_ID`.
- Android Firebase app package: `com.dubtach.sidenote`.

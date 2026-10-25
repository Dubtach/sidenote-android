# SideNote Android — Firebase and Google sign-in setup

Package name: `com.dubtach.sidenote`
Firebase project: `notebeedubtach`

## 1. Register this Android app in Firebase

1. Open Firebase Console → project `notebeedubtach` → Project settings → General.
2. Under Your apps, add an Android app with package name `com.dubtach.sidenote`.
3. Add SHA-1 and SHA-256 fingerprints for the debug signing key and, before release, the release signing key.
4. For a default Windows debug keystore, run in Command Prompt:

   ```bat
   keytool -list -v -keystore "%USERPROFILE%\.android\debug.keystore" -alias androiddebugkey -storepass android -keypass android
   ```

   On macOS/Linux, use `~/.android/debug.keystore` in place of the Windows path.

This project currently calls Firebase Auth/Firestore REST APIs using the Web app config in `firebase-config.js`, so it does not need the generated `google-services.json` to compile. Registering the app and fingerprints is still important for configuring Google sign-in.

## 2. Configure Google Credential Manager

The Chrome Extension OAuth client ID is **not** the Android Credential Manager's server client ID. Create or locate an OAuth client of type **Web application** in Google Cloud Console / Firebase Authentication's Google provider configuration.

1. In Firebase Console → Authentication → Sign-in method, confirm Email/Password and Google are enabled.
2. Open Google provider configuration and find the **Web client ID**. If it is not suitable for this project, create an OAuth 2.0 client ID of type Web application in the same Google Cloud project.
3. Open `app/src/main/java/com/dubtach/sidenote/AppConfig.java`.
4. Replace `YOUR_GOOGLE_WEB_CLIENT_ID.apps.googleusercontent.com` with that Web application client ID.
5. Rebuild the APK.

Credential Manager returns a Google ID token for the configured Web client; the app exchanges it with Firebase Authentication to obtain the normal SideNote Firebase session. The existing Chrome Extension client ID from the browser extension should remain in the extension's `manifest.json`, not be copied here unless it is genuinely a Web application client.

## 3. Verify Firestore security rules

The app expects the same rules as the Chrome extension, restricting each signed-in user to `users/{uid}/...`:

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Publish these rules only if they match the schema for your existing SideNote extension. Do not use public/test-mode rules.

## 4. Test the app

- Create or sign in with an email/password account.
- Open the profile panel and check sync status; create a note and confirm it appears in Firestore.
- Sign in to the same account in the Chrome extension and ensure both apps show the same cloud-synced notes.
- Try Google sign-in after the Web client ID and Android signing fingerprints are configured.
- Test offline edits, then reconnect while SideNote is open; local changes should save immediately and queue for sync.
- In Chrome on Android, use Share → SideNote on a webpage. SideNote opens with that page as its current shared URL; select a note and tap **Link page**. The URL is stored as note metadata, not inserted into note text.

## Notes

- Android's app storage is separate from the Chrome extension's `chrome.storage.local`. To migrate old notes, sign into the same Firebase account in the extension and run Sync now first. Notes that never reached Firebase remain local to the extension until synced.
- Automatic synchronization runs while the app is open and is retried when network connectivity returns or the app is reopened. This first version does not run an Android background worker when the app is fully closed.
- Google sign-in requires a device with current Google Play services.

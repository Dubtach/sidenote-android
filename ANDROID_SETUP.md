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

**Google sign-in is intentionally not active until a Web application OAuth client ID is supplied.** The Chrome Extension OAuth client ID is not the Android Credential Manager's server client ID.

1. In Firebase Console → Authentication → Sign-in method, confirm Email/Password and Google are enabled.
2. Open the Google provider settings and copy the **Web client ID** (OAuth client type `Web application`) from the same Google Cloud/Firebase project. Do not use the Chrome Extension client ID or the Android client ID.
3. In your GitHub repository, open Settings → Secrets and variables → Actions → New repository secret.
4. Set the secret name to exactly `SIDENOTE_GOOGLE_WEB_CLIENT_ID` and paste the Web application client ID as the secret value.
5. Push the project changes or manually run Actions → Build SideNote Android APK. The workflow passes the secret to Gradle; it is not stored directly in source files. If the secret is absent, the workflow still builds, but Android Google sign-in displays a setup error.
6. Register the Android app with package `com.dubtach.sidenote`, then add the SHA-1 fingerprint printed in the successful GitHub Actions build log to Firebase Console → Project settings → Your apps → Android app → SHA certificate fingerprints.

Credential Manager returns a Google ID token for the configured Web client; the app exchanges it with Firebase Authentication to obtain the normal SideNote Firebase session. The existing Chrome Extension client ID from the browser extension should remain in the extension's `manifest.json` and is not a substitute for this Web application client ID.

**Signing note:** GitHub-hosted runners generate a fresh debug signing key on each run by default. The printed SHA-1 matches that build's APK. If you want to install future APK builds as updates without uninstalling, configure a persistent signing keystore in GitHub Actions and keep the same signing key for all builds.

## 3. If email/password login fails

Email/password login does not require the Google OAuth client ID or Android SHA fingerprint. If it fails:

1. In Firebase Console → Authentication → Sign-in method, make sure Email/Password is enabled.
2. Confirm `app/src/main/assets/www/firebase-config.js` still contains the Web app configuration for project `notebeedubtach`.
3. Read the error shown in the SideNote account panel. Errors are mapped to actionable messages: wrong password/account, disabled provider, invalid/restricted API key, or network failure.
4. If the message mentions `API_KEY_HTTP_REFERRER_BLOCKED`, open Google Cloud Console → APIs & Services → Credentials and review restrictions on the API key used by this Firebase Web app. A browser-only HTTP referrer allowlist may reject calls from the Android WebView origin. Adjust the key restrictions carefully instead of making the key unrestricted across unrelated APIs.
5. If it says `Failed to fetch` or could not reach Firebase, test the device's network and retry on another network. A VPN, DNS filter, or network firewall may block `identitytoolkit.googleapis.com`.

Please keep the full error message; it identifies whether the problem is app setup or the entered credentials.

## 4. Verify Firestore security rules

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

## 5. Test the app

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

# SideNote Android v1.5.3 — Firebase and Google sign-in setup

Package name: `com.dubtach.sidenote`  
Firebase project: `notebeedubtach`

This release uses the **native Firebase Android Authentication SDK** for email/password and Google sign-in. Firestore note data continues to use the existing REST schema so it remains compatible with the Chrome extension.

## 1. Register the Android app in Firebase

1. Open Firebase Console → project `notebeedubtach` → Project settings → General.
2. Under **Your apps**, add or select an Android app whose package name is exactly `com.dubtach.sidenote`.
3. Download its `google-services.json` file. It must belong to project `notebeedubtach` and package `com.dubtach.sidenote`.
4. Do not commit this file to GitHub. The build workflow receives it through a GitHub Actions secret.

## 2. Add the GitHub Actions secrets

Open your GitHub repository → Settings → Secrets and variables → Actions → New repository secret.

### Secret A: `SIDENOTE_GOOGLE_SERVICES_JSON_BASE64`

On Windows PowerShell, from the folder where `google-services.json` was downloaded, run:

```powershell
$encoded = [Convert]::ToBase64String([IO.File]::ReadAllBytes(".\google-services.json"))
$encoded | Set-Clipboard
```

Create the secret named `SIDENOTE_GOOGLE_SERVICES_JSON_BASE64` and paste the clipboard contents as its value.

On macOS/Linux:

```bash
base64 -w 0 google-services.json
```

Copy the entire output into the same GitHub secret. This is Firebase client configuration, not a service-account private key, but keep it out of public source repositories as a good practice.

### Secret B: `SIDENOTE_GOOGLE_WEB_CLIENT_ID`

1. In Google Cloud Console → APIs & Services → Credentials, locate the OAuth 2.0 Client ID whose application type is **Web application** for this Firebase project.
2. Copy that client ID. It ends in `.apps.googleusercontent.com`.
3. Add it as the value of the GitHub Actions secret `SIDENOTE_GOOGLE_WEB_CLIENT_ID`.

Do **not** use the Chrome Extension OAuth client ID or the Android OAuth client ID here. Credential Manager needs the Web application client ID as its server client ID.

Both secrets are required by the build workflow. The workflow checks that the Web client ID secret is present in the selected Android app client inside `google-services.json`; if the IDs do not match, it stops before building rather than producing an APK with a broken Google button. After enabling Google sign-in or adding SHA fingerprints, always download a fresh `google-services.json` and update its Base64 GitHub secret.

## 3. First build and Android signing fingerprints

1. Push the updated project to the repository or open GitHub → Actions → **Build SideNote Android APK** → Run workflow.
2. When the first build succeeds, open its log and find the SHA-1 and SHA-256 fingerprints printed by `apksigner`.
3. In Firebase Console → Project settings → Your apps → Android app `com.dubtach.sidenote` → **SHA certificate fingerprints**, add both SHA-1 and SHA-256.
4. Save the Firebase settings. If you add fingerprints after downloading `google-services.json`, download a fresh copy and update `SIDENOTE_GOOGLE_SERVICES_JSON_BASE64` using the PowerShell command above.
5. Run the workflow again and install the new APK. Google sign-in should now be able to verify the Android package/signature.

The GitHub Actions workflow caches a debug keystore so subsequent builds keep the same signature. GitHub may eventually evict old caches; if that happens, the next build can have a new fingerprint. For a long-lived release signing identity, set up a dedicated persistent keystore and use it for every release build.

## 4. Enable the Firebase sign-in providers

In Firebase Console → Authentication → Sign-in method, enable:

- **Email/Password** for email registration and login.
- **Google** for Credential Manager sign-in.

Email/password login does not depend on Google OAuth or SHA fingerprints, but it does require a valid `google-services.json` in the build so the native Firebase SDK can initialize.

## 5. How Android authentication works in v1.5.3

- Email/password registration and sign-in use `FirebaseAuth.createUserWithEmailAndPassword` and `signInWithEmailAndPassword`.
- The explicit **Continue with Google** button first uses Credential Manager `GetSignInWithGoogleOption` (Google Identity library 1.2.1). If the direct-button provider returns no credential, SideNote falls back to the standard Credential Manager account picker using `GetGoogleIdOption` with authorized-account filtering disabled. Both paths obtain a Google ID token and exchange it using `FirebaseAuth.signInWithCredential`.
- FirebaseAuth stores the native session and refreshes ID tokens. SideNote no longer stores an Android refresh token inside WebView local storage.
- The WebView asks the Android bridge for an ID token when Firestore needs one. The native session marker is preserved after token refresh.
- If a previously signed-in device is temporarily offline, the app keeps the local account state and notes; cloud sync waits until a token can be refreshed.
- Firestore paths and note schema remain `users/{uid}/notes/{noteId}`, compatible with the Chrome extension.

## 6. Firestore security rules

The app expects the existing SideNote rules, restricting each user to their own `users/{uid}/...` data:

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

Publish these rules only if they match the schema used by the Chrome extension. Never use public/test-mode rules.

## 7. Troubleshooting

### Email/password login

- `Email/password sign-in is disabled`: enable Email/Password under Firebase Authentication → Sign-in method.
- `This Android build isn't authorized for the Firebase project`: check that `google-services.json` belongs to `notebeedubtach` and contains package `com.dubtach.sidenote`; rebuild after updating the secret.
- `Couldn't reach Firebase`: check network, VPN, DNS filtering, and access to Firebase services.
- `Email or password is incorrect`: verify the email and password; the app does not store passwords.

### Google login

- `Google sign-in is not configured`: add `SIDENOTE_GOOGLE_WEB_CLIENT_ID` as a Web application OAuth client ID and rebuild. It must match a Web OAuth client entry inside the current `google-services.json`.
- Google error code `10` / `DEVELOPER_ERROR`: register the exact SHA-1 and SHA-256 from the installed APK in Firebase Android app settings. Download a fresh `google-services.json`, update the Base64 secret, and rebuild with the same stable GitHub Actions signing key.
- `No Google account is available`: add a Google account to the Android device and retry.
- A canceled Google sign-in sheet is not an authentication failure; simply retry and select an account. The button flow uses `GetSignInWithGoogleOption`; the older `GetGoogleIdOption` is intended for the Credential Manager account-picker bottom sheet.
- Ensure the Google provider is enabled in Firebase Authentication.

## 8. Install and test

1. Download the `SideNote-Android-debug-APK` artifact from a successful GitHub Actions run.
2. Install it on the phone. If Android reports a signature conflict, do not uninstall until you have confirmed that local-only notes are synced or exported; uninstalling removes the app's local WebView data.
3. Test email account creation, sign out, email sign-in, Google sign-in, creating a note, and syncing the same account with the Chrome extension.
4. Test offline edits, then reconnect and confirm pending changes sync while SideNote is open or after reopening it.

## Data and privacy notes

- The Firebase Web API key in `firebase-config.js` and the Android `google-services.json` identify the Firebase project; they are not administrative credentials. Firestore Security Rules protect user data.
- Never put a Firebase service-account key, private OAuth secret, or user password in the project or GitHub repository.
- The Android app stores its local notes separately from Chrome extension storage. Sign into the same Firebase account on both devices to sync cloud-saved notes.
- Account sign-out does not delete cloud notes or local notes.

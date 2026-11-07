# Build SideNote Android APK with GitHub Actions

You do not need Android Studio or the Android SDK on your computer. GitHub's runner builds the APK.

## Required GitHub repository secrets

Add these under GitHub repository → Settings → Secrets and variables → Actions:

| Secret | Value |
|---|---|
| `SIDENOTE_GOOGLE_SERVICES_JSON_BASE64` | Base64-encoded `google-services.json` downloaded for Firebase project `notebeedubtach` and Android package `com.dubtach.sidenote`. |
| `SIDENOTE_GOOGLE_WEB_CLIENT_ID` | The Google OAuth client ID whose application type is **Web application**. Do not use the Android or Chrome Extension OAuth client. |

On Windows PowerShell, encode the JSON file with:

```powershell
$encoded = [Convert]::ToBase64String([IO.File]::ReadAllBytes(".\google-services.json"))
$encoded | Set-Clipboard
```

Paste the clipboard value into `SIDENOTE_GOOGLE_SERVICES_JSON_BASE64`.

The workflow validates both secrets and checks that the JSON belongs to Firebase project `notebeedubtach` and Android package `com.dubtach.sidenote`.

## Upload the project

1. Create a private GitHub repository, for example `sidenote-android`.
2. Extract the project ZIP.
3. Install Git for Windows if necessary. Android Studio is not required.
4. Open PowerShell in the extracted project root and run:

```powershell
git init
git add .
git commit -m "Update SideNote Android"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/sidenote-android.git
git push -u origin main
```

Replace `YOUR-USERNAME` with your GitHub username. Keep the hidden `.github` folder; it contains the build workflow.

## Build and download

1. Open your repository → Actions → **Build SideNote Android APK**.
2. A push to `main`/`master` starts the workflow automatically; you can also select Run workflow.
3. Wait for the run to finish with a green check.
4. Download the artifact named `SideNote-Android-debug-APK` from the completed run.
5. Extract `app-debug.apk` and transfer it to the Android phone.

The workflow prints the APK's SHA-1 and SHA-256 signing fingerprints. Register both in Firebase Project settings → Your apps → Android app `com.dubtach.sidenote`. If you add fingerprints after downloading the Firebase JSON, download a fresh `google-services.json`, update the Base64 secret, and rebuild.

The workflow caches its debug keystore so consecutive builds can keep the same signature. GitHub may evict caches over time. For public distribution and dependable upgrades, use a dedicated release keystore stored in GitHub Secrets rather than a debug APK.

## Authentication behavior

SideNote v1.5.0 uses the native Firebase Android Auth SDK. Email/password uses FirebaseAuth directly. Google uses Android Credential Manager and the Web application OAuth client ID. See `ANDROID_SETUP.md` for detailed Firebase setup and error diagnostics.

## Important

- The project does not contain `google-services.json`; the workflow injects it from GitHub Secrets. Do not commit that file.
- Do not commit service-account JSON, private signing keys, OAuth client secrets, or passwords.
- This workflow creates a debug APK for personal testing, not a Play Store release.
- Android local notes are separate from Chrome extension local storage. Sync Chrome notes to Firebase first if you need them on Android.
- The app currently syncs while open and retries when network becomes available or when reopened; it does not run a permanent background sync service after the app is fully closed.

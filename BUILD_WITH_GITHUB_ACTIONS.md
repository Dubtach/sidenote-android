# Build SideNote APK without Android Studio

This project includes a GitHub Actions workflow that builds the APK on GitHub's hosted runner. You do not need to install Android Studio or the Android SDK on your PC.

## First: configure Google sign-in (optional)

The Android app compiles without an OAuth client ID, but Google sign-in cannot work until you configure a Google OAuth client of type **Web application**.

1. In Google Cloud Console / Firebase Authentication, copy the Web application OAuth client ID for the `notebeedubtach` project. Do not use the Chrome Extension client ID.
2. In your GitHub repository, open Settings → Secrets and variables → Actions → New repository secret.
3. Name the secret `SIDENOTE_GOOGLE_WEB_CLIENT_ID` and paste the Web application client ID as its value.
4. Push the project or manually run the workflow again. Gradle reads this secret from the workflow environment and embeds it in the build; it is not hardcoded into `AppConfig.java`.
5. After a successful build, copy the SHA-1 printed in the Actions log into the Android app settings in Firebase (`com.dubtach.sidenote`).

Email/password sign-in does not depend on that OAuth client ID. If email login fails, SideNote now shows a specific message for disabled providers, rejected API keys, and network failures. See `ANDROID_SETUP.md` for troubleshooting and the SHA-1/signing caveat.

## Upload the project to GitHub

1. Sign in at <https://github.com/> and create a new repository, for example `sidenote-android`. A **private** repository is a good default for your app source.
2. Do not add a README, license, or `.gitignore` during repository creation because this project already contains those files.
3. Install the lightweight **Git for Windows** command-line tool if you don't have Git. You do not need Android Studio.
4. Extract this ZIP to a folder. Open PowerShell or Command Prompt inside the extracted `sidenote-android-project` folder.
5. Run the following commands, replacing the URL with the repository URL GitHub shows for your account:

   ```powershell
   git init
   git add .
   git commit -m "Add SideNote Android project and APK workflow"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/sidenote-android.git
   git push -u origin main
   ```

   Important: `git add .` includes the hidden `.github/workflows/build-apk.yml` workflow. Do not omit that folder.

## Download the generated APK

1. Open your repository on GitHub and select the **Actions** tab.
2. Open the run named **Build SideNote Android APK** triggered by your push. Wait until it shows a green check. (The first run needs to download Android build dependencies.)
3. Open the completed run and scroll to **Artifacts**.
4. Download `SideNote-Android-debug-APK` and unzip the artifact. It contains `app-debug.apk`.
5. Transfer `app-debug.apk` to your Android phone and open it. If Android asks, allow your file manager/browser to install unknown apps.

Every push to `main` or `master` starts another build. You can also run it manually using **Actions → Build SideNote Android APK → Run workflow**.

## Important limitations

- This workflow produces a **debug APK for personal testing**, not a production-signed release. Keep the debug signing key private if you generate/share a custom one.
- GitHub Actions builds the app but does not install or test it on your phone. Test login, Firebase syncing, share-to-SideNote, offline edits, and long notes on the device.
- The Android app's local storage is separate from Chrome's local storage. First sync extension-only notes to Firebase, then sign in to the same Firebase account in the Android app.
- Google sign-in needs the correct Web OAuth client ID plus the Android package registration and signing fingerprints. Building the APK alone does not complete those Firebase Console steps.
- Do not add service-account JSON files, private keys, or passwords to the repository. The Firebase web config and OAuth client ID are client configuration, not admin credentials.

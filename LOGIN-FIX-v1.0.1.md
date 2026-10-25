# SideNote Android 1.0.1 — Login troubleshooting and setup

This update improves Firebase Authentication errors and configures Google sign-in through a GitHub Actions secret. It does not grant account access or bypass Firebase security rules.

## Google sign-in: known blocker found in the prior project

`AppConfig.java` used a literal placeholder (`YOUR_GOOGLE_WEB_CLIENT_ID.apps.googleusercontent.com`). Google Credential Manager cannot sign in with that value. The Android app needs an OAuth client of type **Web application** (server client ID), not the Chrome Extension client ID.

1. Open Firebase Console for project `notebeedubtach` → Authentication → Sign-in method → Google. Copy the Web client ID, or locate/create an OAuth 2.0 client of type **Web application** in the same Google Cloud project.
2. In GitHub, open the SideNote Android repository → Settings → Secrets and variables → Actions → New repository secret.
3. Name it exactly `SIDENOTE_GOOGLE_WEB_CLIENT_ID`; set its value to the Web application client ID. Do not paste this value into logs or screenshots.
4. Push this updated project or manually run **Actions → Build SideNote Android APK → Run workflow**. Gradle embeds the secret in that build's generated `BuildConfig`; it is not written into tracked source files.
5. In the successful workflow log, find the `SHA fingerprints for this APK` step. Copy the SHA-1 digest into Firebase Console → Project settings → Your apps → Android app `com.dubtach.sidenote` → SHA certificate fingerprints. Make sure the Android app is registered in the same Firebase project and Google is enabled as a provider.
6. Download the APK artifact from that same workflow run and install it. Do not rebuild before testing with that fingerprint, because the GitHub-hosted runner currently uses a temporary debug signing key per run.

The previously supplied Chrome Extension OAuth client ID is for Chrome's extension identity flow and is not a substitute for the Android Web application client ID.

## Email/password sign-in

Email/password does **not** depend on the Google OAuth client ID or Android SHA fingerprint. In Firebase Console → Authentication → Sign-in method, confirm Email/Password is enabled. Then use **Create account** for a new account or **Sign in** for an existing account.

This update maps common failure responses to more specific messages:

- Wrong email/password: check spelling and whether the account already exists.
- `OPERATION_NOT_ALLOWED` / `CONFIGURATION_NOT_FOUND`: enable Email/Password in Firebase Authentication.
- `API_KEY_INVALID` / `API_KEY_SERVICE_BLOCKED`: confirm the Web app config is from `notebeedubtach`, and review the API key's API restrictions in Google Cloud Console.
- `API_KEY_HTTP_REFERRER_BLOCKED`: the key's application/referrer restrictions are rejecting the Android WebView origin; review the restrictions carefully. Do not make the key unrestricted for unrelated APIs.
- Network/Failed to fetch: verify the device internet connection and that `identitytoolkit.googleapis.com` is reachable. A VPN or DNS/filtering app can block it.

If email/password still fails, copy the exact message shown in SideNote's account panel. It should now point to the relevant setup area rather than just saying login failed. Do not share passwords, ID tokens, or refresh tokens.

## Rebuild and install warning

GitHub-hosted runners create a fresh debug signing key each run. Register the SHA-1 printed for the exact APK you download. A later build may have a different SHA-1, and Android may reject installing it over an earlier APK signed with a different key. For a long-lived install, configure a persistent signing keystore in GitHub Actions and keep it private.

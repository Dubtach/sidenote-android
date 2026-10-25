package com.dubtach.sidenote;

/** Android-specific configuration supplied by Gradle/GitHub Actions. */
public final class AppConfig {
    private AppConfig() {}

    // Must be an OAuth 2.0 client of type Web application (server client ID),
    // not the Chrome Extension or Android client ID.
    public static final String GOOGLE_WEB_CLIENT_ID = BuildConfig.GOOGLE_WEB_CLIENT_ID;

    public static boolean isGoogleSignInConfigured() {
        return GOOGLE_WEB_CLIENT_ID != null
                && !GOOGLE_WEB_CLIENT_ID.startsWith("YOUR_")
                && GOOGLE_WEB_CLIENT_ID.endsWith(".apps.googleusercontent.com");
    }
}

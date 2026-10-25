package com.dubtach.sidenote;

/** Android-specific configuration. Replace the placeholder with a Google OAuth Web client ID. */
public final class AppConfig {
    private AppConfig() {}

    // This must be a Google OAuth client of type "Web application" (server client ID),
    // not the Chrome Extension OAuth client ID used by the browser extension.
    public static final String GOOGLE_WEB_CLIENT_ID =
            "664880574351-0d6jotirqliqms3riio30sgivcj8dkbr.apps.googleusercontent.com";
}

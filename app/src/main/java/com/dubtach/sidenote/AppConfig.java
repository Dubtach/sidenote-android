package com.dubtach.sidenote;

import android.content.Context;

/** Android-specific Firebase and Google sign-in configuration. */
public final class AppConfig {
    private AppConfig() {}

    // Prefer the explicit GitHub Actions secret. The Google Services plugin also
    // generates default_web_client_id from app/google-services.json as a fallback.
    public static String getGoogleWebClientId(Context context) {
        String configured = BuildConfig.GOOGLE_WEB_CLIENT_ID;
        if (isValidGoogleClientId(configured)) return configured.trim();
        if (context != null) {
            int resourceId = context.getResources().getIdentifier(
                    "default_web_client_id", "string", context.getPackageName());
            if (resourceId != 0) {
                try {
                    String generated = context.getString(resourceId);
                    if (isValidGoogleClientId(generated)) return generated.trim();
                } catch (Exception ignored) { }
            }
        }
        return "";
    }

    public static boolean isGoogleSignInConfigured(Context context) {
        return isValidGoogleClientId(getGoogleWebClientId(context));
    }

    private static boolean isValidGoogleClientId(String value) {
        return value != null
                && !value.trim().isEmpty()
                && !value.startsWith("YOUR_")
                && value.trim().endsWith(".apps.googleusercontent.com");
    }
}

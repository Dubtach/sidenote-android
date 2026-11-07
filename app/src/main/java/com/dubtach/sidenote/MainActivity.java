package com.dubtach.sidenote;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.Build;
import android.os.SystemClock;
import android.view.View;
import android.view.HapticFeedbackConstants;
import android.view.Window;
import android.view.WindowManager;
import android.window.OnBackInvokedCallback;
import android.window.OnBackInvokedDispatcher;
import android.webkit.JavascriptInterface;
import android.webkit.JsPromptResult;
import android.webkit.JsResult;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.GetCredentialException;
import androidx.credentials.ClearCredentialStateRequest;
import androidx.credentials.exceptions.ClearCredentialException;
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GetGoogleIdOption;
import androidx.webkit.WebViewAssetLoader;

import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;
import com.google.firebase.auth.AuthResult;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.auth.GoogleAuthProvider;
import com.google.firebase.auth.GetTokenResult;
import com.google.firebase.auth.UserInfo;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.Locale;

public class MainActivity extends Activity {
    private static final String ASSET_HOST = "appassets.androidplatform.net";
    private WebView webView;
    private WebViewAssetLoader assetLoader;
    private CredentialManager credentialManager;
    private FirebaseAuth firebaseAuth;
    private String firebaseInitError = "";
    private OnBackInvokedCallback systemBackCallback;
    private long lastBackPressedAtMs = 0L;
    private boolean backCheckPending = false;
    private static final long EXIT_CONFIRM_WINDOW_MS = 2200L;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        configureWindow();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            systemBackCallback = this::handleSystemBack;
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    OnBackInvokedDispatcher.PRIORITY_DEFAULT, systemBackCallback);
        }
        credentialManager = CredentialManager.create(this);
        assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(245, 244, 251));
        webView.setOverScrollMode(View.OVER_SCROLL_IF_CONTENT_SCROLLS);
        webView.setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY);
        webView.setVerticalScrollBarEnabled(false);
        webView.setHorizontalScrollBarEnabled(false);
        WebSettings webSettings = webView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);
        webSettings.setDatabaseEnabled(true);
        webSettings.setAllowFileAccess(false);
        webSettings.setAllowContentAccess(false);
        webSettings.setJavaScriptCanOpenWindowsAutomatically(false);
        webSettings.setSupportMultipleWindows(false);
        webSettings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        webSettings.setTextZoom(100);
        webView.addJavascriptInterface(new SideNoteBridge(), "SideNoteAndroid");
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public android.webkit.WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (ASSET_HOST.equalsIgnoreCase(uri.getHost())) return false;
                openExternalUrl(uri.toString());
                return true;
            }

        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onJsAlert(WebView view, String url, String message, JsResult result) {
                new AlertDialog.Builder(MainActivity.this)
                        .setMessage(message)
                        .setPositiveButton(android.R.string.ok, (dialog, which) -> result.confirm())
                        .setOnCancelListener(dialog -> result.cancel())
                        .show();
                return true;
            }

            @Override
            public boolean onJsConfirm(WebView view, String url, String message, JsResult result) {
                new AlertDialog.Builder(MainActivity.this)
                        .setTitle("SideNote")
                        .setMessage(message)
                        .setCancelable(true)
                        .setNegativeButton(android.R.string.cancel, (dialog, which) -> result.cancel())
                        .setPositiveButton(android.R.string.ok, (dialog, which) -> result.confirm())
                        .setOnCancelListener(dialog -> result.cancel())
                        .show();
                return true;
            }

            @Override
            public boolean onJsPrompt(WebView view, String url, String message, String defaultValue, JsPromptResult result) {
                result.cancel();
                return true;
            }
        });
        setContentView(webView);
        webView.loadUrl("https://" + ASSET_HOST + "/assets/www/sidepanel.html");
    }

    private void configureWindow() {
        Window window = getWindow();
        window.setStatusBarColor(Color.rgb(245, 244, 251));
        window.setNavigationBarColor(Color.rgb(245, 244, 251));
        window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        WindowCompat.setDecorFitsSystemWindows(window, true);
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
        controller.setAppearanceLightStatusBars(true);
        controller.setAppearanceLightNavigationBars(true);
    }

    private void applySystemTheme(String theme) {
        runOnUiThread(() -> {
            boolean dark = "dark".equalsIgnoreCase(theme);
            int barColor = dark ? Color.rgb(31, 29, 45) : Color.rgb(245, 244, 251);
            Window window = getWindow();
            window.setStatusBarColor(barColor);
            window.setNavigationBarColor(barColor);
            WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
            controller.setAppearanceLightStatusBars(!dark);
            controller.setAppearanceLightNavigationBars(!dark);
        });
    }

    private void openExternalUrl(String url) {
        try {
            Uri uri = Uri.parse(url);
            String scheme = uri.getScheme();
            if (scheme == null || !(scheme.equalsIgnoreCase("http") || scheme.equalsIgnoreCase("https") || scheme.equalsIgnoreCase("mailto"))) {
                showMessage("This setting is managed by Android or Chrome, not the SideNote app.");
                return;
            }
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException | SecurityException error) {
            showMessage("No app is available to open this link.");
        }
    }

    private void showMessage(String message) {
        runOnUiThread(() -> Toast.makeText(this, message, Toast.LENGTH_LONG).show());
    }

    /** Returns a safe, non-null, trimmed string for optional Firebase fields and messages. */
    private static String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private FirebaseAuth requireFirebaseAuth() {
        if (firebaseAuth != null) return firebaseAuth;
        try {
            firebaseAuth = FirebaseAuth.getInstance();
            firebaseInitError = "";
            return firebaseAuth;
        } catch (Exception error) {
            firebaseInitError = "Firebase Android is not configured. Add the Android app's google-services.json for package com.dubtach.sidenote, then rebuild.";
            throw new IllegalStateException(firebaseInitError, error);
        }
    }

    private String firebaseErrorMessage(Exception error) {
        String code = error instanceof FirebaseAuthException
                ? ((FirebaseAuthException) error).getErrorCode() : "";
        String message = error == null ? "" : safe(error.getMessage());
        String normalized = code.toUpperCase(Locale.ROOT);
        if (normalized.contains("INVALID_EMAIL")) return "Enter a valid email address.";
        if (normalized.contains("EMAIL_ALREADY_IN_USE")) return "That email already has a SideNote account. Sign in instead.";
        if (normalized.contains("USER_NOT_FOUND") || normalized.contains("WRONG_PASSWORD") || normalized.contains("INVALID_CREDENTIAL")) return "Email or password is incorrect. Check both and try again.";
        if (normalized.contains("WEAK_PASSWORD")) return "Choose a stronger password (at least 6 characters).";
        if (normalized.contains("OPERATION_NOT_ALLOWED")) return "Email/password sign-in is disabled. Enable it in Firebase Console → Authentication → Sign-in method.";
        if (normalized.contains("TOO_MANY_REQUESTS")) return "Too many attempts. Wait a little and try again.";
        if (normalized.contains("USER_DISABLED")) return "This Firebase account has been disabled.";
        if (normalized.contains("NETWORK_REQUEST_FAILED") || normalized.contains("NETWORK_ERROR")) return "Couldn't reach Firebase. Check your internet connection and try again.";
        if (normalized.contains("API_KEY_NOT_VALID") || normalized.contains("INVALID_API_KEY") || normalized.contains("APP_NOT_AUTHORIZED")) return "This Android build isn't authorized for the Firebase project. Check google-services.json and the Android app registration.";
        if (normalized.contains("ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL")) return "This email already uses another sign-in method. Try that method first.";
        if (normalized.contains("WEB_CONTEXT_CANCELED") || normalized.contains("CANCELED")) return "Sign-in was cancelled.";
        if (error != null && error.getCause() != null && error.getCause().getMessage() != null) {
            String cause = safe(error.getCause().getMessage());
            if (!cause.isEmpty()) message = cause;
        }
        if (message.isEmpty()) message = "Firebase authentication failed. Please try again.";
        return message.replaceFirst("(?i)^firebase:\\s*", "");
    }

    private String currentProviderId(FirebaseUser user) {
        if (user == null || user.getProviderData() == null) return "password";
        for (UserInfo info : user.getProviderData()) {
            if (info != null && info.getProviderId() != null && !"firebase".equals(info.getProviderId())) {
                return info.getProviderId();
            }
        }
        return "password";
    }

    private void sendNativeFirebaseResult(String requestId, JSONObject payload, String error) {
        String payloadArg = payload == null ? "null" : JSONObject.quote(payload.toString());
        String errorArg = error == null ? "null" : JSONObject.quote(error);
        String script = "window.__sideNoteNativeFirebaseResult(" + JSONObject.quote(requestId) + "," + payloadArg + "," + errorArg + ");";
        runOnUiThread(() -> { if (webView != null) webView.evaluateJavascript(script, null); });
    }

    private JSONObject firebaseUserPayload(FirebaseUser user) throws JSONException {
        JSONObject payload = new JSONObject();
        payload.put("localId", user.getUid());
        payload.put("user_id", user.getUid());
        payload.put("email", safe(user.getEmail()));
        payload.put("displayName", safe(user.getDisplayName()));
        payload.put("providerId", currentProviderId(user));
        payload.put("nativeAuth", true);
        payload.put("signedIn", true);
        return payload;
    }

    private void sendFirebaseUser(String requestId, FirebaseUser user) {
        if (user == null) {
            sendNativeFirebaseResult(requestId, null, "Firebase did not return a signed-in user.");
            return;
        }
        user.getIdToken(false)
                .addOnSuccessListener(this, tokenResult -> {
                    try {
                        JSONObject payload = firebaseUserPayload(user);
                        payload.put("idToken", tokenResult.getToken());
                        payload.put("expiresIn", Math.max(60L, tokenResult.getExpirationTimestamp() - (System.currentTimeMillis() / 1000L)));
                        sendNativeFirebaseResult(requestId, payload, null);
                    } catch (Exception error) {
                        sendNativeFirebaseResult(requestId, null, "Couldn't prepare the Firebase session. Please try again.");
                    }
                })
                .addOnFailureListener(this, error -> {
                    // Preserve the authenticated local user when the device is offline
                    // and a token refresh cannot complete. Firestore sync will retry later.
                    try {
                        JSONObject payload = firebaseUserPayload(user);
                        payload.put("idToken", "");
                        payload.put("expiresIn", 0);
                        payload.put("tokenPending", true);
                        sendNativeFirebaseResult(requestId, payload, null);
                    } catch (JSONException jsonError) {
                        sendNativeFirebaseResult(requestId, null,
                                firebaseErrorMessage(error instanceof Exception ? (Exception) error : new Exception(error)));
                    }
                });
    }

    private void sendFirebaseToken(String requestId, FirebaseUser user) {
        if (user == null) {
            sendNativeFirebaseResult(requestId, null, "Your SideNote session has expired. Please sign in again.");
            return;
        }
        user.getIdToken(false)
                .addOnSuccessListener(this, tokenResult -> {
                    try {
                        JSONObject payload = new JSONObject();
                        payload.put("localId", user.getUid());
                        payload.put("idToken", tokenResult.getToken());
                        payload.put("expiresIn", Math.max(60L, tokenResult.getExpirationTimestamp() - (System.currentTimeMillis() / 1000L)));
                        sendNativeFirebaseResult(requestId, payload, null);
                    } catch (Exception error) {
                        sendNativeFirebaseResult(requestId, null, "Couldn't refresh your Firebase session.");
                    }
                })
                .addOnFailureListener(this, error -> sendNativeFirebaseResult(requestId, null,
                        firebaseErrorMessage(error instanceof Exception ? (Exception) error : new Exception(error))));
    }

    private void completeAuthTask(String requestId, com.google.android.gms.tasks.Task<AuthResult> task) {
        task.addOnCompleteListener(this, completed -> {
            if (!completed.isSuccessful()) {
                Exception error = completed.getException();
                sendNativeFirebaseResult(requestId, null, firebaseErrorMessage(error == null ? new Exception("Authentication failed.") : error));
                return;
            }
            AuthResult result = completed.getResult();
            sendFirebaseUser(requestId, result == null ? null : result.getUser());
        });
    }

    private void signInWithGoogleIdToken(String requestId, String idToken) {
        try {
            requireFirebaseAuth().signInWithCredential(GoogleAuthProvider.getCredential(idToken, null))
                    .addOnCompleteListener(this, task -> {
                        if (!task.isSuccessful()) {
                            Exception error = task.getException();
                            sendNativeFirebaseResult(requestId, null, googleFirebaseErrorMessage(error == null ? new Exception("Google sign-in failed.") : error));
                            return;
                        }
                        AuthResult result = task.getResult();
                        sendFirebaseUser(requestId, result == null ? null : result.getUser());
                    });
        } catch (Exception error) {
            sendNativeFirebaseResult(requestId, null, firebaseErrorMessage(error));
        }
    }

    private String googleFirebaseErrorMessage(Exception error) {
        String code = error instanceof FirebaseAuthException
                ? ((FirebaseAuthException) error).getErrorCode().toUpperCase(Locale.ROOT) : "";
        if (code.contains("INVALID_CREDENTIAL") || code.contains("INVALID_IDP_RESPONSE")) {
            return "Firebase rejected Google's sign-in token. Check that SIDENOTE_GOOGLE_WEB_CLIENT_ID matches the Web client in google-services.json, Google is enabled in Firebase Authentication, and this APK's SHA-1/SHA-256 are registered.";
        }
        if (code.contains("OPERATION_NOT_ALLOWED")) {
            return "Google sign-in is disabled in Firebase. Enable Google under Firebase Console → Authentication → Sign-in method.";
        }
        if (code.contains("ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL")) {
            return "This email already has a SideNote account using another sign-in method. Sign in with that method first, then link providers from your account settings.";
        }
        return firebaseErrorMessage(error);
    }

    private void requestGoogleFirebaseSignIn(String requestId) {
        if (!AppConfig.isGoogleSignInConfigured(this)) {
            sendNativeFirebaseResult(requestId, null,
                    "Google sign-in is not configured. Add the Web application OAuth client ID to GitHub Actions, update google-services.json after registering this app's SHA-1/SHA-256 in Firebase, then rebuild.");
            return;
        }
        try {
            // Primary path for the visible "Continue with Google" button.
            GetSignInWithGoogleOption googleButtonOption =
                    new GetSignInWithGoogleOption.Builder(AppConfig.getGoogleWebClientId(this)).build();
            GetCredentialRequest request = new GetCredentialRequest.Builder()
                    .addCredentialOption(googleButtonOption)
                    .build();
            credentialManager.getCredentialAsync(
                    this,
                    request,
                    new CancellationSignal(),
                    getMainExecutor(),
                    new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                        @Override
                        public void onResult(GetCredentialResponse result) {
                            handleGoogleCredentialResult(requestId, result);
                        }

                        @Override
                        public void onError(GetCredentialException error) {
                            String type = error.getClass().getSimpleName();
                            if (type.contains("NoCredential")) {
                                // Some provider/device combinations do not surface the direct-button
                                // credential. Fall back to the standard account picker so users can
                                // select any Google account already present on the device.
                                requestGoogleAccountPickerFallback(requestId);
                                return;
                            }
                            sendNativeFirebaseResult(requestId, null, googleCredentialErrorMessage(error));
                        }
                    });
        } catch (Exception error) {
            String details = safe(error.getMessage());
            sendNativeFirebaseResult(requestId, null,
                    "Google sign-in couldn't start: " + (details.isEmpty() ? error.getClass().getSimpleName() : details)
                    + ". Verify the Web OAuth client ID and this APK's Firebase SHA fingerprints.");
        }
    }

    private void requestGoogleAccountPickerFallback(String requestId) {
        try {
            GetGoogleIdOption googleIdOption = new GetGoogleIdOption.Builder()
                    .setFilterByAuthorizedAccounts(false)
                    .setServerClientId(AppConfig.getGoogleWebClientId(this))
                    .setAutoSelectEnabled(false)
                    .build();
            GetCredentialRequest fallbackRequest = new GetCredentialRequest.Builder()
                    .addCredentialOption(googleIdOption)
                    .build();
            credentialManager.getCredentialAsync(
                    this,
                    fallbackRequest,
                    new CancellationSignal(),
                    getMainExecutor(),
                    new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                        @Override
                        public void onResult(GetCredentialResponse result) {
                            handleGoogleCredentialResult(requestId, result);
                        }

                        @Override
                        public void onError(GetCredentialException error) {
                            sendNativeFirebaseResult(requestId, null, googleCredentialErrorMessage(error));
                        }
                    });
        } catch (Exception error) {
            String details = safe(error.getMessage());
            sendNativeFirebaseResult(requestId, null,
                    "Google account picker couldn't start: " + (details.isEmpty() ? error.getClass().getSimpleName() : details));
        }
    }

    private void handleGoogleCredentialResult(String requestId, GetCredentialResponse result) {
        try {
            Credential credential = result.getCredential();
            if (!(credential instanceof CustomCredential)) {
                sendNativeFirebaseResult(requestId, null,
                        "Google didn't return a sign-in credential. Please try again.");
                return;
            }
            CustomCredential custom = (CustomCredential) credential;
            if (!GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(custom.getType())) {
                sendNativeFirebaseResult(requestId, null,
                        "Google returned an unsupported credential type. Update Google Play services and try again.");
                return;
            }
            GoogleIdTokenCredential google = GoogleIdTokenCredential.createFrom(custom.getData());
            String idToken = google.getIdToken();
            if (idToken == null || idToken.trim().isEmpty()) {
                sendNativeFirebaseResult(requestId, null,
                        "Google didn't return an ID token. Check your Web OAuth client ID and Firebase Android app configuration.");
                return;
            }
            signInWithGoogleIdToken(requestId, idToken);
        } catch (Exception error) {
            sendNativeFirebaseResult(requestId, null,
                    "Couldn't read the Google sign-in response: " + safe(error.getMessage()));
        }
    }

    private String googleCredentialErrorMessage(GetCredentialException error) {
        String type = error.getClass().getSimpleName();
        String details = safe(error.getMessage());
        if (type.contains("Cancellation")) {
            return "Google sign-in was cancelled.";
        }
        if (type.contains("NoCredential")) {
            return "No Google account is available. Add a Google account to this device, then try again.";
        }
        if (type.contains("ProviderConfiguration") || type.contains("Unsupported")) {
            return "Google sign-in isn't available on this device. Update Google Play services and try again.";
        }
        if (details.toUpperCase(Locale.ROOT).contains("DEVELOPER_ERROR") || details.contains("10:")) {
            return "Google rejected this APK's identity. Register this build's SHA-1 and SHA-256 in Firebase for com.dubtach.sidenote, download a fresh google-services.json, and rebuild.";
        }
        return "Google sign-in couldn't start (" + type + "): " + details
                + ". Check the Web OAuth client ID, Android package name, and SHA fingerprints for this APK.";
    }

    private void sendFirebaseResetResult(String requestId, Exception error) {
        if (error == null) {
            JSONObject payload = new JSONObject();
            try { payload.put("ok", true); } catch (JSONException ignored) {}
            sendNativeFirebaseResult(requestId, payload, null);
        } else {
            sendNativeFirebaseResult(requestId, null, firebaseErrorMessage(error));
        }
    }

    private void handleSystemBack() {
        if (webView == null) {
            finish();
            return;
        }
        if (backCheckPending) return;
        backCheckPending = true;
        String backScript = "(() => {"
                + "const overlay = document.querySelector('#confirmDialogBackdrop:not(.hidden), #settingsBackdrop:not(.hidden), #accountPopover:not(.hidden), #topbar.search-open, #noteActionMenu:not(.hidden), #trashPanel:not(.hidden), #noteStylePanel:not(.hidden), #sortMenu:not(.hidden), #viewMenu:not(.hidden)');"
                + "if (overlay) { document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', bubbles:true})); return 'handled'; }"
                + "const bulk = document.querySelector('#bulkActionsBar:not(.hidden)');"
                + "if (bulk) { bulk.querySelector('[data-bulk-action=\"cancel\"]')?.click(); return 'handled'; }"
                + "const closeEditor = document.getElementById('closeEditorButton') || document.getElementById('mobileBackButton');"
                + "if (document.querySelector('#appShell.mobile-editor-active') && closeEditor) { closeEditor.click(); return 'handled'; }"
                + "return 'exit'; })()";
        webView.evaluateJavascript(backScript, value -> {
            backCheckPending = false;
            if (!"\"exit\"".equals(value)) {
                lastBackPressedAtMs = 0L;
                return;
            }
            long now = SystemClock.elapsedRealtime();
            if (lastBackPressedAtMs > 0L && now - lastBackPressedAtMs <= EXIT_CONFIRM_WINDOW_MS) {
                finish();
                return;
            }
            lastBackPressedAtMs = now;
            Toast.makeText(this, "Press back again to exit", Toast.LENGTH_SHORT).show();
        });
    }

    @Override
    public void onBackPressed() {
        handleSystemBack();
    }

    @Override
    protected void onDestroy() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && systemBackCallback != null) {
            getOnBackInvokedDispatcher().unregisterOnBackInvokedCallback(systemBackCallback);
            systemBackCallback = null;
        }
        if (webView != null) {
            webView.removeJavascriptInterface("SideNoteAndroid");
            webView.stopLoading();
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    public final class SideNoteBridge {
        @JavascriptInterface
        public void firebaseSignInEmail(String requestId, String email, String password) {
            runOnUiThread(() -> {
                try { completeAuthTask(requestId, requireFirebaseAuth().signInWithEmailAndPassword(safe(email), password == null ? "" : password)); }
                catch (Exception error) { sendNativeFirebaseResult(requestId, null, firebaseErrorMessage(error)); }
            });
        }

        @JavascriptInterface
        public void firebaseCreateAccount(String requestId, String email, String password) {
            runOnUiThread(() -> {
                try { completeAuthTask(requestId, requireFirebaseAuth().createUserWithEmailAndPassword(safe(email), password == null ? "" : password)); }
                catch (Exception error) { sendNativeFirebaseResult(requestId, null, firebaseErrorMessage(error)); }
            });
        }

        @JavascriptInterface
        public void firebaseGoogleSignIn(String requestId) {
            runOnUiThread(() -> requestGoogleFirebaseSignIn(requestId));
        }

        @JavascriptInterface
        public void firebaseSendPasswordReset(String requestId, String email) {
            runOnUiThread(() -> {
                try {
                    requireFirebaseAuth().sendPasswordResetEmail(safe(email)).addOnCompleteListener(MainActivity.this, task ->
                            sendFirebaseResetResult(requestId, task.isSuccessful() ? null : task.getException()));
                } catch (Exception error) { sendFirebaseResetResult(requestId, error); }
            });
        }

        @JavascriptInterface
        public void firebaseGetCurrentSession(String requestId) {
            runOnUiThread(() -> {
                try {
                    FirebaseUser user = requireFirebaseAuth().getCurrentUser();
                    if (user == null) {
                        JSONObject payload = new JSONObject();
                        try { payload.put("signedIn", false); } catch (JSONException ignored) {}
                        sendNativeFirebaseResult(requestId, payload, null);
                    } else {
                        sendFirebaseUser(requestId, user);
                    }
                } catch (Exception error) { sendNativeFirebaseResult(requestId, null, firebaseErrorMessage(error)); }
            });
        }

        @JavascriptInterface
        public void firebaseGetIdToken(String requestId) {
            runOnUiThread(() -> {
                try { sendFirebaseToken(requestId, requireFirebaseAuth().getCurrentUser()); }
                catch (Exception error) { sendNativeFirebaseResult(requestId, null, firebaseErrorMessage(error)); }
            });
        }

        @JavascriptInterface
        public void firebaseSignOut(String requestId) {
            runOnUiThread(() -> {
                try { requireFirebaseAuth().signOut(); }
                catch (Exception error) { sendNativeFirebaseResult(requestId, null, firebaseErrorMessage(error)); return; }
                try {
                    credentialManager.clearCredentialStateAsync(
                            new ClearCredentialStateRequest(), new CancellationSignal(), getMainExecutor(),
                            new CredentialManagerCallback<Void, ClearCredentialException>() {
                                @Override public void onResult(Void result) {
                                    JSONObject payload = new JSONObject();
                                    try { payload.put("ok", true); } catch (JSONException ignored) {}
                                    sendNativeFirebaseResult(requestId, payload, null);
                                }
                                @Override public void onError(ClearCredentialException error) {
                                    // Firebase is already signed out. Credential-provider cleanup is best effort.
                                    JSONObject payload = new JSONObject();
                                    try { payload.put("ok", true); } catch (JSONException ignored) {}
                                    sendNativeFirebaseResult(requestId, payload, null);
                                }
                            });
                } catch (Exception ignored) {
                    JSONObject payload = new JSONObject();
                    try { payload.put("ok", true); } catch (JSONException ignoredJson) {}
                    sendNativeFirebaseResult(requestId, payload, null);
                }
            });
        }

        @JavascriptInterface
        public boolean isGoogleSignInConfigured() {
            return AppConfig.isGoogleSignInConfigured(MainActivity.this);
        }

        @JavascriptInterface
        public void openExternalUrl(String url) { runOnUiThread(() -> MainActivity.this.openExternalUrl(url)); }

        @JavascriptInterface
        public void showMessage(String message) { MainActivity.this.showMessage(message); }

        @JavascriptInterface
        public void vibrate(int strength) {
            runOnUiThread(() -> {
                if (webView != null) {
                    int feedback = strength >= 14 ? HapticFeedbackConstants.LONG_PRESS : HapticFeedbackConstants.KEYBOARD_TAP;
                    webView.performHapticFeedback(feedback);
                }
            });
        }

        @JavascriptInterface
        public void setSystemTheme(String theme) { MainActivity.this.applySystemTheme(theme); }

        @JavascriptInterface
        public void copyToClipboard(String text) {
            runOnUiThread(() -> {
                ClipboardManager clipboard = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
                if (clipboard != null) clipboard.setPrimaryClip(ClipData.newPlainText("SideNote note", text == null ? "" : text));
            });
        }

    }
}

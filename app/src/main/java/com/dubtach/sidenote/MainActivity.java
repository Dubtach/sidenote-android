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
import android.util.Patterns;
import android.view.View;
import android.view.HapticFeedbackConstants;
import android.view.Window;
import android.view.WindowManager;
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
import java.util.regex.Matcher;

public class MainActivity extends Activity {
    private static final String ASSET_HOST = "appassets.androidplatform.net";
    private WebView webView;
    private WebViewAssetLoader assetLoader;
    private CredentialManager credentialManager;
    private FirebaseAuth firebaseAuth;
    private String firebaseInitError = "";
    private JSONObject sharedPage;
    private boolean pageLoaded = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        configureWindow();
        handleIncomingIntent(getIntent(), false);
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

            @Override
            public void onPageFinished(WebView view, String url) {
                pageLoaded = true;
                if (sharedPage != null) dispatchSharedPageUpdated();
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
                        .setMessage(message)
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

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIncomingIntent(intent, true);
    }

    private void handleIncomingIntent(Intent intent, boolean notifyWeb) {
        if (intent == null) return;
        String action = intent.getAction();
        String title = "";
        String text = "";
        Uri data = intent.getData();

        if (Intent.ACTION_VIEW.equals(action) && data != null) {
            String scheme = data.getScheme();
            if ("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme)) {
                String url = data.toString();
                String subject = intent.getStringExtra(Intent.EXTRA_TITLE);
                title = subject == null || subject.trim().isEmpty() ? safeHost(url) : subject.trim();
                setSharedPage(title, url);
            }
        } else if (Intent.ACTION_SEND.equals(action)) {
            title = safe(intent.getStringExtra(Intent.EXTRA_SUBJECT));
            text = safe(intent.getStringExtra(Intent.EXTRA_TEXT));
            String url = extractUrl(text);
            if (url.isEmpty()) url = extractUrl(title);
            if (!url.isEmpty()) {
                String bodyTitle = text.replace(url, "").replaceAll("(?m)^\\s*$", "").trim();
                if (title.isEmpty()) title = bodyTitle;
                if (title.isEmpty()) title = bodyTitle.isEmpty() ? safeHost(url) : bodyTitle;
                setSharedPage(title, url);
            }
        }
        if (notifyWeb && pageLoaded && sharedPage != null) dispatchSharedPageUpdated();
    }

    private void setSharedPage(String title, String rawUrl) {
        String url = rawUrl.trim().replaceAll("[),.;!?]+$", "");
        if (!url.matches("(?i)^https?://.*")) url = "https://" + url;
        Uri uri = Uri.parse(url);
        String scheme = uri.getScheme();
        if (scheme == null || !(scheme.equalsIgnoreCase("http") || scheme.equalsIgnoreCase("https")) || uri.getHost() == null) return;
        String cleanTitle = safe(title).replace(url, "").trim();
        if (cleanTitle.isEmpty() || cleanTitle.equals(url)) cleanTitle = safeHost(url);
        sharedPage = new JSONObject();
        try {
            sharedPage.put("title", cleanTitle);
            sharedPage.put("url", url);
        } catch (JSONException ignored) {}
    }

    private String extractUrl(String text) {
        if (text == null || text.trim().isEmpty()) return "";
        Matcher matcher = Patterns.WEB_URL.matcher(text);
        while (matcher.find()) {
            String candidate = matcher.group();
            if (candidate == null) continue;
            candidate = candidate.replaceAll("[),.;!?]+$", "");
            if (!candidate.matches("(?i)^https?://.*")) candidate = "https://" + candidate;
            Uri uri = Uri.parse(candidate);
            if (uri.getHost() != null && ("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme()))) return candidate;
        }
        return "";
    }

    private String safeHost(String url) {
        try {
            String host = Uri.parse(url).getHost();
            return host == null ? url : host.replaceFirst("^www\\.", "");
        } catch (Exception ignored) { return url; }
    }

    private String safe(String value) { return value == null ? "" : value.trim(); }

    private void dispatchSharedPageUpdated() {
        if (webView == null || !pageLoaded) return;
        webView.post(() -> webView.evaluateJavascript(
                "window.dispatchEvent(new Event('sidenote-shared-page-updated'));", null));
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
                            sendNativeFirebaseResult(requestId, null, firebaseErrorMessage(error == null ? new Exception("Google sign-in failed.") : error));
                            return;
                        }
                        AuthResult result = task.getResult();
                        sendFirebaseUser(requestId, result == null ? null : result.getUser());
                    });
        } catch (Exception error) {
            sendNativeFirebaseResult(requestId, null, firebaseErrorMessage(error));
        }
    }

    private void requestGoogleFirebaseSignIn(String requestId) {
        if (!AppConfig.isGoogleSignInConfigured(this)) {
            sendNativeFirebaseResult(requestId, null,
                    "Google sign-in is not configured. Add the Firebase Android google-services.json and a Web application OAuth client ID, register this APK's SHA-1 in Firebase, then rebuild.");
            return;
        }
        try {
            GetGoogleIdOption googleIdOption = new GetGoogleIdOption.Builder()
                    .setServerClientId(AppConfig.getGoogleWebClientId(this))
                    .setFilterByAuthorizedAccounts(false)
                    .setAutoSelectEnabled(false)
                    .build();
            GetCredentialRequest request = new GetCredentialRequest.Builder()
                    .addCredentialOption(googleIdOption)
                    .build();
            credentialManager.getCredentialAsync(
                    this,
                    request,
                    new CancellationSignal(),
                    getMainExecutor(),
                    new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                        @Override
                        public void onResult(GetCredentialResponse result) {
                            try {
                                Credential credential = result.getCredential();
                                if (!(credential instanceof CustomCredential)) {
                                    sendNativeFirebaseResult(requestId, null, "Choose a Google account to continue.");
                                    return;
                                }
                                CustomCredential custom = (CustomCredential) credential;
                                if (!GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(custom.getType())) {
                                    sendNativeFirebaseResult(requestId, null, "Google did not return a supported sign-in credential.");
                                    return;
                                }
                                GoogleIdTokenCredential google = GoogleIdTokenCredential.createFrom(custom.getData());
                                signInWithGoogleIdToken(requestId, google.getIdToken());
                            } catch (Exception error) {
                                sendNativeFirebaseResult(requestId, null, "Couldn't read the Google sign-in response: " + safe(error.getMessage()));
                            }
                        }

                        @Override
                        public void onError(GetCredentialException error) {
                            String type = error.getClass().getSimpleName();
                            String message;
                            if (type.contains("NoCredential")) {
                                message = "No Google account is available for SideNote. Add a Google account to this device, then try again.";
                            } else if (type.contains("Cancellation")) {
                                message = "Google sign-in was cancelled.";
                            } else if (type.contains("GetCredentialProviderConfiguration")) {
                                message = "Google sign-in isn't configured correctly. Check that SIDENOTE_GOOGLE_WEB_CLIENT_ID is a Web application OAuth client ID.";
                            } else {
                                message = "Google sign-in couldn't start: " + safe(error.getMessage()) + ". Check the Web OAuth client ID, Android package name, and this APK's SHA-1 in Firebase.";
                            }
                            sendNativeFirebaseResult(requestId, null, message);
                        }
                    });
        } catch (Exception error) {
            sendNativeFirebaseResult(requestId, null, "Google sign-in couldn't start: " + safe(error.getMessage()));
        }
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

    @Override
    public void onBackPressed() {
        if (webView == null) { super.onBackPressed(); return; }
        webView.evaluateJavascript(
                "(() => { const overlay = document.querySelector('#settingsBackdrop:not(.hidden), #accountPopover:not(.hidden), #topbar.search-open, #noteActionMenu:not(.hidden), #trashPanel:not(.hidden), #noteStylePanel:not(.hidden)'); if (overlay) { document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', bubbles:true})); return 'handled'; } const back = document.getElementById('mobileBackButton'); if (document.querySelector('#appShell.mobile-editor-active') && back) { back.click(); return 'handled'; } return 'exit'; })()",
                value -> { if ("\"exit\"".equals(value)) finish(); });
    }

    @Override
    protected void onDestroy() {
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
        public String getCurrentPageJson() { return sharedPage == null ? "{}" : sharedPage.toString(); }

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

        @JavascriptInterface
        public void setWebContentReady() { pageLoaded = true; }
    }
}

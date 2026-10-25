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
import com.google.android.libraries.identity.googleid.GetGoogleIdOption;
import androidx.webkit.WebViewAssetLoader;

import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.Locale;
import java.util.concurrent.Executor;
import java.util.regex.Matcher;

public class MainActivity extends Activity {
    private static final String ASSET_HOST = "appassets.androidplatform.net";
    private WebView webView;
    private WebViewAssetLoader assetLoader;
    private CredentialManager credentialManager;
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
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
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

    private void requestGoogleToken(String requestId) {
        if (!AppConfig.isGoogleSignInConfigured()) {
            sendGoogleResult(requestId, null,
                    "Google sign-in is not configured in this APK. Add the SIDENOTE_GOOGLE_WEB_CLIENT_ID GitHub Actions secret using the Web application OAuth client ID, register com.dubtach.sidenote in Firebase, add this APK's signing SHA-1, then rebuild.");
            return;
        }
        GetGoogleIdOption googleIdOption = new GetGoogleIdOption.Builder()
                .setServerClientId(AppConfig.GOOGLE_WEB_CLIENT_ID)
                .setFilterByAuthorizedAccounts(false)
                .setAutoSelectEnabled(false)
                .build();
        GetCredentialRequest request = new GetCredentialRequest.Builder()
                .addCredentialOption(googleIdOption)
                .build();
        Executor executor = getMainExecutor();
        credentialManager.getCredentialAsync(
                this,
                request,
                new CancellationSignal(),
                executor,
                new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                    @Override
                    public void onResult(GetCredentialResponse result) {
                        try {
                            Credential credential = result.getCredential();
                            if (!(credential instanceof CustomCredential)) {
                                sendGoogleResult(requestId, null, "Choose a Google account to continue.");
                                return;
                            }
                            CustomCredential custom = (CustomCredential) credential;
                            if (!GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(custom.getType())) {
                                sendGoogleResult(requestId, null, "Google did not return a supported sign-in credential.");
                                return;
                            }
                            GoogleIdTokenCredential google = GoogleIdTokenCredential.createFrom(custom.getData());
                            sendGoogleResult(requestId, google.getIdToken(), null);
                        } catch (Exception error) {
                            sendGoogleResult(requestId, null, "Could not read the Google sign-in credential.");
                        }
                    }

                    @Override
                    public void onError(GetCredentialException error) {
                        String message = error.getMessage();
                        if (message == null || message.trim().isEmpty()) {
                            message = "Google sign-in was cancelled or unavailable. Check Google Play services, the Web OAuth client ID, and the Android app SHA-1 in Firebase.";
                        }
                        sendGoogleResult(requestId, null, message);
                    }
                });
    }

    private void sendGoogleResult(String requestId, String idToken, String error) {
        String script = "window.__sideNoteNativeGoogleAuthResult(" + JSONObject.quote(requestId) + "," +
                (idToken == null ? "null" : JSONObject.quote(idToken)) + "," +
                (error == null ? "null" : JSONObject.quote(error)) + ");";
        runOnUiThread(() -> { if (webView != null) webView.evaluateJavascript(script, null); });
    }

    @Override
    public void onBackPressed() {
        if (webView == null) { super.onBackPressed(); return; }
        webView.evaluateJavascript(
                "(() => { const open = document.querySelector('#settingsBackdrop:not(.hidden), #accountPopover:not(.hidden), #topbar.search-open'); if (open) { document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', bubbles:true})); return 'handled'; } return 'exit'; })()",
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
        public void requestGoogleSignIn(String requestId) {
            runOnUiThread(() -> requestGoogleToken(requestId));
        }

        @JavascriptInterface
        public boolean isGoogleSignInConfigured() {
            return AppConfig.isGoogleSignInConfigured();
        }

        @JavascriptInterface
        public void openExternalUrl(String url) { runOnUiThread(() -> MainActivity.this.openExternalUrl(url)); }

        @JavascriptInterface
        public void showMessage(String message) { MainActivity.this.showMessage(message); }

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

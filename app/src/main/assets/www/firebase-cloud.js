/* SideNote Firebase REST adapter. Avoids runtime CDN imports in Manifest V3. */
(() => {
  "use strict";
  const config = window.SIDENOTE_FIREBASE_CONFIG;
  if (!config?.apiKey || !config?.projectId) throw new Error("SideNote Firebase config is missing.");
  const authBase = "https://identitytoolkit.googleapis.com/v1";
  const tokenBase = "https://securetoken.googleapis.com/v1";
  const documentsBase = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(config.projectId)}/databases/(default)/documents`;

  function authErrorMessage(code, message) {
    const raw = `${code || ""} ${message || ""}`;
    if (/EMAIL_EXISTS/.test(raw)) return "That email already has a SideNote account. Try signing in instead.";
    if (/EMAIL_NOT_FOUND|INVALID_PASSWORD|INVALID_LOGIN_CREDENTIALS|INVALID_CREDENTIAL/.test(raw)) return "Email or password is incorrect.";
    if (/WEAK_PASSWORD/.test(raw)) return "Choose a stronger password (at least 6 characters).";
    if (/INVALID_EMAIL/.test(raw)) return "Enter a valid email address.";
    if (/OPERATION_NOT_ALLOWED|ADMIN_ONLY_OPERATION/.test(raw)) return "Email/password sign-in is disabled in Firebase Authentication. Open Firebase Console → Authentication → Sign-in method and enable Email/Password.";
    if (/TOO_MANY_ATTEMPTS_TRY_LATER/.test(raw)) return "Too many attempts. Wait a little and try again.";
    if (/ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL/.test(raw)) return "This email already uses another sign-in method. Sign in with that method first.";
    if (/CONFIGURATION_NOT_FOUND/.test(raw)) return "Firebase Authentication is not configured for this project. Enable Email/Password under Firebase Console → Authentication → Sign-in method.";
    if (/API_KEY_HTTP_REFERRER_BLOCKED/.test(raw)) return "Firebase rejected this app's API key because its referrer is blocked. In Google Cloud Console, review the API key's application restrictions for the Android app.";
    if (/API_KEY_SERVICE_BLOCKED/.test(raw)) return "The Firebase API key is blocked from using an API required for login. Review the API restrictions for the key used in firebase-config.js.";
    if (/API_KEY_INVALID|INVALID_API_KEY|API key not valid/.test(raw)) return "The Firebase Web API key was rejected. Confirm that firebase-config.js uses the Web app config from the notebeedubtach project and that the key is enabled.";
    if (/NETWORK_REQUEST_FAILED|Failed to fetch|NetworkError|Load failed/i.test(raw)) return "SideNote couldn't reach Firebase Authentication. Check your internet connection, then check whether the Firebase API key has browser-referrer restrictions that block the Android WebView.";
    if (/USER_DISABLED/.test(raw)) return "This Firebase account has been disabled. Contact the project administrator.";
    return (message || code || "Firebase authentication failed.").replace(/^Firebase:\s*/i, "");
  }

  async function readJsonResponse(response, label) {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const code = data?.error?.message || data?.error?.status || `${response.status}`;
      const message = data?.error?.message || data?.error?.status || `${label} failed (${response.status})`;
      throw new Error(response.status >= 400 && /accounts:|securetoken/.test(label) ? authErrorMessage(code, message) : `${label}: ${message}`);
    }
    return data;
  }

  async function authPost(endpoint, payload) {
    let response;
    try {
      response = await fetch(`${authBase}/${endpoint}?key=${encodeURIComponent(config.apiKey)}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
      });
    } catch (error) {
      const detail = String(error?.message || "");
      throw new Error(authErrorMessage("NETWORK_REQUEST_FAILED", detail));
    }
    return readJsonResponse(response, endpoint);
  }

  async function createAccount(email, password) {
    return authPost("accounts:signUp", { email: email.trim(), password, returnSecureToken: true });
  }
  async function signInEmail(email, password) {
    return authPost("accounts:signInWithPassword", { email: email.trim(), password, returnSecureToken: true });
  }
  async function sendPasswordReset(email) {
    return authPost("accounts:sendOobCode", { requestType: "PASSWORD_RESET", email: email.trim() });
  }
  async function signInGoogle() {
    // Native Android uses Credential Manager to obtain a Google ID token, then
    // exchanges that token with Firebase Authentication's REST endpoint.
    if (window.SIDENOTE_ANDROID && window.__sideNoteGetNativeGoogleIdToken) {
      const idToken = await window.__sideNoteGetNativeGoogleIdToken();
      const postBody = new URLSearchParams({ id_token: idToken, providerId: "google.com" }).toString();
      return authPost("accounts:signInWithIdp", {
        postBody,
        requestUri: "http://localhost",
        returnIdpCredential: true,
        returnSecureToken: true
      });
    }
    const manifest = chrome.runtime.getManifest();
    const clientId = manifest?.oauth2?.client_id || "";
    if (!clientId || clientId.includes("YOUR_GOOGLE_EXTENSION_OAUTH_CLIENT_ID") || !clientId.endsWith(".apps.googleusercontent.com")) {
      throw new Error("Google sign-in needs your Chrome Extension OAuth client ID. See FIREBASE_SETUP.md in the extension folder.");
    }
    if (!chrome.identity?.getAuthToken) throw new Error("Chrome Identity API is unavailable. Reload SideNote and try again.");
    const result = await chrome.identity.getAuthToken({ interactive: true });
    const accessToken = typeof result === "string" ? result : result?.token;
    if (!accessToken) throw new Error("Google did not return an access token. Check the OAuth client and extension ID.");
    const postBody = new URLSearchParams({ access_token: accessToken, providerId: "google.com" }).toString();
    return authPost("accounts:signInWithIdp", {
      postBody,
      requestUri: "http://localhost",
      returnIdpCredential: true,
      returnSecureToken: true
    });
  }
  async function refreshSession(refreshToken) {
    const response = await fetch(`${tokenBase}/token?key=${encodeURIComponent(config.apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken })
    });
    const data = await readJsonResponse(response, "securetoken refresh");
    return {
      idToken: data.id_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresIn: Number(data.expires_in) || 3600,
      localId: data.user_id
    };
  }

  function encodeValue(value) {
    if (value === null || value === undefined) return { nullValue: null };
    if (typeof value === "string") return { stringValue: value };
    if (typeof value === "boolean") return { booleanValue: value };
    if (typeof value === "number") return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
    if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue) } };
    if (typeof value === "object") return { mapValue: { fields: encodeFields(value) } };
    return { stringValue: String(value) };
  }
  function encodeFields(object) {
    const fields = {};
    for (const [key, value] of Object.entries(object || {})) fields[key] = encodeValue(value);
    return fields;
  }
  function decodeValue(value) {
    if (!value || typeof value !== "object") return null;
    if ("stringValue" in value) return value.stringValue;
    if ("booleanValue" in value) return value.booleanValue;
    if ("integerValue" in value) return Number(value.integerValue);
    if ("doubleValue" in value) return Number(value.doubleValue);
    if ("nullValue" in value) return null;
    if ("timestampValue" in value) return Date.parse(value.timestampValue) || 0;
    if ("arrayValue" in value) return (value.arrayValue?.values || []).map(decodeValue);
    if ("mapValue" in value) return decodeFields(value.mapValue?.fields || {});
    return null;
  }
  function decodeFields(fields) {
    const result = {};
    for (const [key, value] of Object.entries(fields || {})) result[key] = decodeValue(value);
    return result;
  }
  async function firestoreRequest(path, idToken, options = {}) {
    const url = `${documentsBase}${path}${path.includes("?") ? "&" : "?"}key=${encodeURIComponent(config.apiKey)}`;
    const response = await fetch(url, {
      ...options,
      headers: { Authorization: `Bearer ${idToken}`, ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok && response.status !== 404) {
      const detail = data?.error?.message || `HTTP ${response.status}`;
      if (response.status === 401) throw new Error("Your SideNote login expired. Sign in again to resume syncing.");
      if (response.status === 403) throw new Error("Firestore denied access. Check that your Firestore security rules allow each signed-in user to access only users/{uid}/... and that the Firestore API is enabled.");
      throw new Error(`Firestore request failed: ${detail}`);
    }
    return { status: response.status, data };
  }
  async function listNotes(idToken, uid) {
    const out = [];
    let pageToken = "";
    do {
      const query = new URLSearchParams({ pageSize: "1000" });
      if (pageToken) query.set("pageToken", pageToken);
      const result = await firestoreRequest(`/users/${encodeURIComponent(uid)}/notes?${query}`, idToken);
      if (result.status === 404) return out;
      for (const doc of result.data.documents || []) {
        const fields = decodeFields(doc.fields || {});
        fields.id = fields.id || doc.name.split("/").pop();
        out.push(fields);
      }
      pageToken = result.data.nextPageToken || "";
    } while (pageToken);
    return out;
  }
  async function readMeta(idToken, uid) {
    const result = await firestoreRequest(`/users/${encodeURIComponent(uid)}/meta/main`, idToken);
    return result.status === 404 ? null : decodeFields(result.data.fields || {});
  }
  async function commitDocuments(idToken, writes) {
    const chunks = [];
    for (let i = 0; i < writes.length; i += 450) chunks.push(writes.slice(i, i + 450));
    for (const chunk of chunks) {
      const response = await fetch(`${documentsBase}:commit?key=${encodeURIComponent(config.apiKey)}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ writes: chunk })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = data?.error?.message || `HTTP ${response.status}`;
        if (response.status === 401) throw new Error("Your SideNote login expired. Sign in again to resume syncing.");
        if (response.status === 403) throw new Error("Firestore denied access. Check the Firestore rules in FIREBASE_SETUP.md.");
        throw new Error(`Firestore save failed: ${detail}`);
      }
    }
  }
  async function writeNotes(idToken, uid, noteDocs) {
    const writes = noteDocs.map((doc) => ({
      update: {
        name: `projects/${config.projectId}/databases/(default)/documents/users/${encodeURIComponent(uid)}/notes/${encodeURIComponent(doc.id)}`,
        fields: encodeFields(doc)
      }
    }));
    if (writes.length) await commitDocuments(idToken, writes);
  }
  async function writeMeta(idToken, uid, meta) {
    const fields = encodeFields(meta);
    const urlPath = `/users/${encodeURIComponent(uid)}/meta/main`;
    const result = await firestoreRequest(urlPath, idToken, { method: "PATCH", body: JSON.stringify({ fields }) });
    return result.data;
  }

  window.SideNoteFirebase = Object.freeze({ createAccount, signInEmail, sendPasswordReset, signInGoogle, refreshSession, listNotes, readMeta, writeNotes, writeMeta });
})();

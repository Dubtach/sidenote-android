/* Android host adapter for SideNote's existing local-first UI. */
(() => {
  "use strict";
  window.SIDENOTE_ANDROID = true;
  document.documentElement.classList.add("sidenote-android");

  const PREFIX = "sidenote.android.chromeStorage.";
  const read = (key) => {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw === null ? undefined : JSON.parse(raw);
    } catch (_) { return undefined; }
  };
  const write = (key, value) => {
    try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); }
    catch (error) { console.error("SideNote: local storage write failed", error); throw error; }
  };
  const storageGet = async (keys) => {
    if (keys == null) {
      const all = {};
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key && key.startsWith(PREFIX)) all[key.slice(PREFIX.length)] = read(key.slice(PREFIX.length));
      }
      return all;
    }
    if (typeof keys === "string") return { [keys]: read(keys) };
    if (Array.isArray(keys)) return Object.fromEntries(keys.map((key) => [key, read(key)]));
    if (typeof keys === "object") {
      return Object.fromEntries(Object.entries(keys).map(([key, fallback]) => {
        const stored = read(key);
        return [key, stored === undefined ? fallback : stored];
      }));
    }
    return {};
  };
  const storageSet = async (items) => { for (const [key, value] of Object.entries(items || {})) write(key, value); };
  const storageRemove = async (keys) => {
    for (const key of (Array.isArray(keys) ? keys : [keys])) localStorage.removeItem(PREFIX + key);
  };

  const noopEvent = Object.freeze({ addListener() {}, removeListener() {}, hasListener() { return false; } });
  const currentPage = () => {
    try {
      const raw = window.SideNoteAndroid?.getCurrentPageJson?.();
      const page = raw ? JSON.parse(raw) : null;
      if (page && /^https?:\/\//i.test(page.url || "")) return page;
    } catch (error) { console.warn("SideNote: shared page context unavailable", error); }
    return null;
  };
  window.SideNoteAndroidPage = currentPage;

  window.chrome = window.chrome || {};
  window.chrome.storage = {
    local: { get: storageGet, set: storageSet, remove: storageRemove }
  };
  window.chrome.tabs = {
    onActivated: noopEvent,
    onUpdated: noopEvent,
    query: async () => {
      const page = currentPage();
      return page ? [{ id: 1, active: true, url: page.url, title: page.title || page.url }] : [];
    },
    get: async (id) => {
      const page = currentPage();
      if (page && (id === 1 || id == null)) return { id: 1, active: true, url: page.url, title: page.title || page.url };
      throw new Error("No webpage has been shared with SideNote yet.");
    },
    create: async ({ url } = {}) => {
      if (/^https?:\/\//i.test(url || "")) window.SideNoteAndroid?.openExternalUrl?.(url);
      else window.SideNoteAndroid?.showMessage?.("Keyboard shortcuts are managed by Android, not Chrome.");
      return { id: 1, active: true, url: url || "" };
    }
  };
  window.chrome.runtime = {
    getManifest: () => ({ oauth2: { client_id: "" } })
  };
  window.chrome.identity = {
    getAuthToken: async () => { throw new Error("Google Drive file backup is not used by the Android app. Use SideNote account sync instead."); },
    removeCachedAuthToken: async () => {},
    clearAllCachedAuthTokens: async () => {}
  };

  const pendingNativeFirebase = new Map();
  window.__sideNoteNativeFirebaseResult = (requestId, payloadJson, error) => {
    const handlers = pendingNativeFirebase.get(requestId);
    if (!handlers) return;
    pendingNativeFirebase.delete(requestId);
    window.clearTimeout(handlers.timeout);
    if (error) {
      handlers.reject(new Error(String(error)));
      return;
    }
    try {
      handlers.resolve(typeof payloadJson === "string" ? JSON.parse(payloadJson) : payloadJson);
    } catch (parseError) {
      handlers.reject(new Error("SideNote received an invalid response from Android authentication."));
    }
  };

  function callNativeFirebase(method, ...args) {
    return new Promise((resolve, reject) => {
      if (!window.SideNoteAndroid || typeof window.SideNoteAndroid[method] !== "function") {
        reject(new Error("Native Firebase authentication is unavailable. Update SideNote Android."));
        return;
      }
      const requestId = `sn-firebase-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
      const timeout = window.setTimeout(() => {
        pendingNativeFirebase.delete(requestId);
        reject(new Error("Firebase took too long to respond. Check your connection and try again."));
      }, 30000);
      pendingNativeFirebase.set(requestId, { resolve, reject, timeout });
      try { window.SideNoteAndroid[method](requestId, ...args); }
      catch (error) {
        window.clearTimeout(timeout);
        pendingNativeFirebase.delete(requestId);
        reject(error);
      }
    });
  }

  window.SideNoteAndroidAuth = Object.freeze({
    signInEmail: (email, password) => callNativeFirebase("firebaseSignInEmail", email, password),
    createAccount: (email, password) => callNativeFirebase("firebaseCreateAccount", email, password),
    signInGoogle: () => callNativeFirebase("firebaseGoogleSignIn"),
    sendPasswordReset: (email) => callNativeFirebase("firebaseSendPasswordReset", email),
    getCurrentSession: () => callNativeFirebase("firebaseGetCurrentSession"),
    getIdToken: () => callNativeFirebase("firebaseGetIdToken"),
    signOut: () => callNativeFirebase("firebaseSignOut")
  });

  const syncAndroidViewport = () => {
    const viewportHeight = Math.round(window.visualViewport?.height || window.innerHeight || 0);
    if (viewportHeight > 0) document.documentElement.style.setProperty("--sidenote-app-height", `${viewportHeight}px`);
    const active = document.activeElement;
    const editable = Boolean(active && active.matches && active.matches("input:not([type=checkbox]), textarea, [contenteditable=true]"));
    document.documentElement.classList.toggle("sidenote-keyboard-open", editable);
  };
  window.addEventListener("resize", syncAndroidViewport, { passive: true });
  window.visualViewport?.addEventListener("resize", syncAndroidViewport, { passive: true });
  window.visualViewport?.addEventListener("scroll", syncAndroidViewport, { passive: true });
  document.addEventListener("focusin", () => window.setTimeout(syncAndroidViewport, 60));
  document.addEventListener("focusout", () => window.setTimeout(syncAndroidViewport, 180));

  document.addEventListener("DOMContentLoaded", () => {
    document.body.classList.add("sidenote-android-body");
    document.getElementById("appShell")?.classList.add("mobile-list-active");
    document.documentElement.classList.remove("mobile-list-active");
    syncAndroidViewport();
    window.SideNoteAndroid?.setWebContentReady?.();
  }, { once: true });
})();

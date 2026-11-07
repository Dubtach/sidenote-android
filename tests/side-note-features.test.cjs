const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const webDir = path.join(root, 'app/src/main/assets/www');

function loadLifecycle() {
  const sandbox = { window: {}, Date, Math, Number, Object, Array, String };
  vm.runInNewContext(fs.readFileSync(path.join(webDir, 'note-lifecycle.js'), 'utf8'), sandbox);
  return sandbox.window.SideNoteLifecycle;
}

test('moving a note to Trash preserves its content and records the deletion time', () => {
  const lifecycle = loadLifecycle();
  const note = { id: 'one', title: 'Meeting', body: 'Agenda', updatedAt: 10 };
  assert.equal(lifecycle.moveToTrash(note, 1000), true);
  assert.equal(note.title, 'Meeting');
  assert.equal(note.body, 'Agenda');
  assert.equal(note.trashedAt, 1000);
  assert.equal(note.updatedAt, 1000);
  assert.equal(lifecycle.isTrashed(note), true);
});

test('restore succeeds before 30 days and preserves note text', () => {
  const lifecycle = loadLifecycle();
  const note = { id: 'two', title: 'Draft', body: 'Keep this', trashedAt: 5000, updatedAt: 5000 };
  assert.equal(lifecycle.restore(note, 5000 + lifecycle.RETENTION_MS - 1), true);
  assert.equal('trashedAt' in note, false);
  assert.equal(note.title, 'Draft');
  assert.equal(note.body, 'Keep this');
  assert.equal(note.updatedAt, 5000 + lifecycle.RETENTION_MS - 1);
});

test('restore is refused at the exact 30-day expiry boundary', () => {
  const lifecycle = loadLifecycle();
  const note = { id: 'three', body: 'Expired', trashedAt: 10_000 };
  assert.equal(lifecycle.restore(note, 10_000 + lifecycle.RETENTION_MS), false);
  assert.equal(note.trashedAt, 10_000);
});

test('a newer stale edit cannot undo a Trash action from another device', () => {
  const lifecycle = loadLifecycle();
  const trashed = { id: 'shared', title: 'Original', body: 'A', trashedAt: 200, trashStateAt: 200, updatedAt: 200 };
  const staleEdit = { id: 'shared', title: 'Original', body: 'B', updatedAt: 300 };
  const merged = lifecycle.mergeVersions(trashed, staleEdit);
  assert.equal(merged.body, 'B');
  assert.equal(merged.trashedAt, 200);
  assert.equal(merged.trashStateAt, 200);
});

test('a later explicit Restore wins over an older Trash state', () => {
  const lifecycle = loadLifecycle();
  const trashed = { id: 'shared', body: 'A', trashedAt: 200, trashStateAt: 200, updatedAt: 200 };
  const restored = { id: 'shared', body: 'A', trashStateAt: 400, updatedAt: 400 };
  const merged = lifecycle.mergeVersions(trashed, restored);
  assert.equal('trashedAt' in merged, false);
  assert.equal(merged.trashStateAt, 400);
  assert.equal(merged.updatedAt, 400);
});

test('expiry removes a note and preserves a permanent-deletion tombstone', () => {
  const lifecycle = loadLifecycle();
  const now = 20_000_000_000;
  const expired = { id: 'expired', body: 'Old', trashedAt: now - lifecycle.RETENTION_MS };
  const active = { id: 'active', body: 'Keep' };
  const stillRecoverable = { id: 'recent', body: 'Restore me', trashedAt: now - lifecycle.RETENTION_MS + 1 };
  const result = lifecycle.purgeExpired([expired, active, stillRecoverable], { expired: now - 50 }, now);
  assert.deepEqual(Array.from(result.expiredIds), ['expired']);
  assert.deepEqual(Array.from(result.notes, (note) => note.id), ['active', 'recent']);
  assert.equal(result.deletedNotes.expired, now);
});

test('expiry does not purge active notes and retains newer tombstone timestamps', () => {
  const lifecycle = loadLifecycle();
  const now = 30_000_000_000;
  const result = lifecycle.purgeExpired([{ id: 'active' }], { keep: now + 100 }, now);
  assert.equal(result.expiredIds.length, 0);
  assert.equal(result.deletedNotes.keep, now + 100);
});

test('Firestore note serialization carries Trash lifecycle timestamps', async () => {
  let captured = null;
  const sandbox = {
    window: { SIDENOTE_FIREBASE_CONFIG: { apiKey: 'test-key', projectId: 'notebeedubtach' } },
    URLSearchParams,
    encodeURIComponent,
    fetch: async (_url, options) => {
      captured = JSON.parse(options.body);
      return { ok: true, status: 200, json: async () => ({}) };
    },
    console
  };
  vm.runInNewContext(fs.readFileSync(path.join(webDir, 'firebase-cloud.js'), 'utf8'), sandbox);
  await sandbox.window.SideNoteFirebase.writeNotes('id-token', 'uid-123', [
    { id: 'note-1', title: 'In Trash', body: 'Recover me', trashedAt: 123456789, trashStateAt: 123456789, updatedAt: 123456789 }
  ]);
  assert.equal(captured.writes.length, 1);
  assert.match(captured.writes[0].update.name, /^projects\/notebeedubtach\/databases\/\(default\)\/documents\/users\/uid-123\/notes\/note-1$/);
  assert.equal(captured.writes[0].update.fields.trashedAt.integerValue, '123456789');
  assert.equal(captured.writes[0].update.fields.trashStateAt.integerValue, '123456789');
});

test('Firestore reads retain the 30-day Trash timestamp', async () => {
  const sandbox = {
    window: { SIDENOTE_FIREBASE_CONFIG: { apiKey: 'test-key', projectId: 'notebeedubtach' } },
    URLSearchParams,
    encodeURIComponent,
    fetch: async () => ({
      ok: true, status: 200,
      json: async () => ({ documents: [{
        name: 'projects/notebeedubtach/databases/(default)/documents/users/uid-123/notes/trashed-1',
        fields: {
          id: { stringValue: 'trashed-1' },
          title: { stringValue: 'In Trash' },
          trashedAt: { integerValue: '987654321' },
          trashStateAt: { integerValue: '987654321' },
          updatedAt: { integerValue: '987654321' }
        }
      }] })
    }),
    console
  };
  vm.runInNewContext(fs.readFileSync(path.join(webDir, 'firebase-cloud.js'), 'utf8'), sandbox);
  const docs = await sandbox.window.SideNoteFirebase.listNotes('id-token', 'uid-123');
  assert.equal(docs.length, 1);
  assert.equal(docs[0].trashedAt, 987654321);
  assert.equal(docs[0].trashStateAt, 987654321);
});

test('editor exposes undo, redo and the appearance presets', () => {
  const js = fs.readFileSync(path.join(webDir, 'sidepanel.js'), 'utf8');
  const html = fs.readFileSync(path.join(webDir, 'sidepanel.html'), 'utf8');
  assert.match(js, /function undoEditor\s*\(/);
  assert.match(js, /function redoEditor\s*\(/);
  assert.match(js, /event\.metaKey \|\| event\.ctrlKey|event\.ctrlKey \|\| event\.metaKey/);
  assert.match(js, /handleUndoRedoShortcut/);
  assert.match(html, /id="undoButton"/);
  assert.match(html, /id="redoButton"/);
  assert.match(html, /id="noteStyleButton"/);
  for (let tint = 0; tint <= 6; tint += 1) assert.match(html, new RegExp(`data-style-tint="${tint}"`));
  for (let texture = 0; texture <= 4; texture += 1) assert.match(html, new RegExp(`data-style-texture="${texture}"`));
});

test('Android email and Google authentication delegate to the native Firebase SDK bridge', async () => {
  const calls = [];
  const sandbox = {
    window: {
      SIDENOTE_ANDROID: true,
      SIDENOTE_FIREBASE_CONFIG: { apiKey: 'web-key', projectId: 'notebeedubtach' },
      SideNoteAndroidAuth: {
        createAccount: async (...args) => { calls.push(['createAccount', ...args]); return { localId: 'uid-new', nativeAuth: true }; },
        signInEmail: async (...args) => { calls.push(['signInEmail', ...args]); return { localId: 'uid-existing', nativeAuth: true }; },
        signInGoogle: async (...args) => { calls.push(['signInGoogle', ...args]); return { localId: 'uid-google', nativeAuth: true }; },
        sendPasswordReset: async (...args) => { calls.push(['sendPasswordReset', ...args]); return { ok: true }; },
        getIdToken: async (...args) => { calls.push(['getIdToken', ...args]); return { localId: 'uid-existing', idToken: 'fresh-token', expiresIn: 3600 }; }
      }
    },
    URLSearchParams,
    encodeURIComponent,
    fetch: async () => { throw new Error('Android native auth should not use the Web Auth REST endpoint'); },
    console
  };
  vm.runInNewContext(fs.readFileSync(path.join(webDir, 'firebase-cloud.js'), 'utf8'), sandbox);
  const api = sandbox.window.SideNoteFirebase;
  assert.equal((await api.createAccount('new@example.com', 'password123')).localId, 'uid-new');
  assert.equal((await api.signInEmail('person@example.com', 'password123')).localId, 'uid-existing');
  assert.equal((await api.signInGoogle()).localId, 'uid-google');
  assert.deepEqual(calls.map((call) => call[0]), ['createAccount', 'signInEmail', 'signInGoogle']);
  const refreshed = await api.refreshSession('native:uid-existing');
  assert.equal(refreshed.idToken, 'fresh-token');
  assert.equal(calls.at(-1)[0], 'getIdToken');
});

test('Android native session marker is preserved after token refresh', () => {
  const js = fs.readFileSync(path.join(webDir, 'sidepanel.js'), 'utf8');
  assert.match(js, /const nativeRefreshMarker = sessionBeforeRefresh\.nativeAuth \? `native:\$\{sessionBeforeRefresh\.uid\}` : ""/);
  assert.match(js, /refreshToken: sessionBeforeRefresh\.nativeAuth \? nativeRefreshMarker/);
  assert.match(js, /if \(nativeSession\?\.localId\)/);
  assert.match(js, /\(!authResult\.idToken && !nativeAuth\)/);
});

test('native Android Firebase authentication uses FirebaseAuth and Credential Manager', () => {
  const java = fs.readFileSync(path.join(root, 'app/src/main/java/com/dubtach/sidenote/MainActivity.java'), 'utf8');
  const gradle = fs.readFileSync(path.join(root, 'app/build.gradle.kts'), 'utf8');
  assert.match(java, /FirebaseAuth\.getInstance\(\)/);
  assert.match(java, /signInWithEmailAndPassword\(/);
  assert.match(java, /createUserWithEmailAndPassword\(/);
  assert.match(java, /GoogleAuthProvider\.getCredential\(idToken, null\)/);
  assert.match(java, /GetSignInWithGoogleOption\.Builder\(AppConfig\.getGoogleWebClientId\(this\)\)/);
  assert.match(java, /requestGoogleAccountPickerFallback\(requestId\)/);
  assert.match(java, /GetGoogleIdOption\.Builder\(\)/);
  assert.match(java, /setFilterByAuthorizedAccounts\(false\)/);
  assert.match(java, /googleFirebaseErrorMessage\(error/);
  assert.match(java, /Firebase rejected Google's sign-in token/);
  assert.match(java, /credentialManager\.getCredentialAsync\(/);
  assert.match(java, /getIdToken\(false\)/);
  assert.match(gradle, /com\.google\.firebase:firebase-auth/);
  assert.match(gradle, /googleid:1\.2\.1/);
});

test('mobile refinement uses larger touch controls and responsive phone layouts', () => {
  const css = fs.readFileSync(path.join(webDir, 'android-mobile.css'), 'utf8');
  const js = fs.readFileSync(path.join(webDir, 'sidepanel.js'), 'utf8');
  assert.match(css, /--mobile-hit:\s*50px/);
  assert.match(css, /\.toolbar-button,\s*\n\.sidenote-android \.new-note-button \{ width: 50px/);
  assert.match(css, /\.note-body,\s*\n\.sidenote-android \.note-body-mirror-content \{ font-size: 18\.5px/);
  assert.match(css, /@media \(max-width: 520px\)[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(css, /sidenote-sheet-spring/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(js, /window\.SIDENOTE_ANDROID \? 430 : 520/);
});

test('v1.5.3 mobile layout is balanced and selection actions stay on one compact row', () => {
  const css = fs.readFileSync(path.join(webDir, 'android-mobile.css'), 'utf8');
  const lastPolish = css.slice(css.lastIndexOf('v1.5.3 — balanced mobile proportions'));
  assert.match(lastPolish, /--mobile-hit: 44px/);
  assert.match(lastPolish, /flex-wrap: nowrap !important/);
  assert.match(lastPolish, /overflow-x: auto/);
  assert.match(lastPolish, /note-card-title \{ font-size: 14\.5px/);
  assert.match(lastPolish, /font-size: 16px; line-height: 1\.72;/);
  assert.match(lastPolish, /settings-header h2 \{ font-size: 20px/);
});

test('Android Back closes app surfaces before double-back exit', () => {
  const java = fs.readFileSync(path.join(root, 'app/src/main/java/com/dubtach/sidenote/MainActivity.java'), 'utf8');
  const js = fs.readFileSync(path.join(webDir, 'sidepanel.js'), 'utf8');
  assert.match(java, /EXIT_CONFIRM_WINDOW_MS = 2200L/);
  assert.match(java, /Press back again to exit/);
  assert.match(java, /OnBackInvokedDispatcher\.PRIORITY_DEFAULT/);
  assert.match(java, /data-bulk-action=\\\"cancel\\\"/);
  assert.match(js, /event\.key === "Escape" && !els\.bulkActionsBar\.classList\.contains\("hidden"\)/);
});

test('GitHub build validates Firebase Android JSON and the Web OAuth client before producing an APK', () => {
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/build-apk.yml'), 'utf8');
  const docs = fs.readFileSync(path.join(root, 'ANDROID_SETUP.md'), 'utf8');
  assert.match(workflow, /SIDENOTE_GOOGLE_SERVICES_JSON_BASE64/);
  assert.match(workflow, /SIDENOTE_GOOGLE_WEB_CLIENT_ID/);
  assert.match(workflow, /com\.dubtach\.sidenote/);
  assert.match(workflow, /notebeedubtach/);
  assert.match(workflow, /does not match a Web OAuth client inside google-services\.json/);
  assert.match(workflow, /embedded_web_ids/);
  assert.match(docs, /Credential Manager/);
  assert.match(docs, /GetSignInWithGoogleOption/);
  assert.match(docs, /SHA-1 and SHA-256/);

  // GitHub Actions creates this file from the encrypted secret before running
  // tests. It is therefore expected to exist during CI; the security property
  // we need to assert is that Git ignores it so it cannot be committed.
  const gitignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
  assert.match(gitignore, /^app\/google-services\.json\s*$/m);
});


test('Android note layouts offer two columns by default plus single, compact, and list modes', () => {
  const html = fs.readFileSync(path.join(webDir, 'sidepanel.html'), 'utf8');
  const js = fs.readFileSync(path.join(webDir, 'sidepanel.js'), 'utf8');
  const css = fs.readFileSync(path.join(webDir, 'android-mobile.css'), 'utf8');
  assert.match(js, /noteLayout: "two-column"/);
  assert.match(js, /\["two-column", "single-column", "compact", "list"\]/);
  assert.match(html, /id="noteLayoutSelect"/);
  assert.match(html, /value="two-column"/);
  assert.match(html, /value="single-column"/);
  assert.match(html, /value="compact"/);
  assert.match(html, /value="list"/);
  assert.match(css, /notes-list\[data-layout="two-column"\][\s\S]*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /notes-list\[data-layout="compact"\]/);
  assert.match(css, /notes-list\[data-layout="list"\]/);
});

test('Android removes webpage-link controls and share intent filters without dropping note metadata compatibility', () => {
  const html = fs.readFileSync(path.join(webDir, 'sidepanel.html'), 'utf8');
  const js = fs.readFileSync(path.join(webDir, 'sidepanel.js'), 'utf8');
  const css = fs.readFileSync(path.join(webDir, 'android-mobile.css'), 'utf8');
  const manifest = fs.readFileSync(path.join(root, 'app/src/main/AndroidManifest.xml'), 'utf8');
  const java = fs.readFileSync(path.join(root, 'app/src/main/java/com/dubtach/sidenote/MainActivity.java'), 'utf8');
  assert.match(html, /id="insertPageButton"/); // retained for shared HTML/JS compatibility
  assert.match(css, /#insertPageButton[\s\S]*display: none !important/);
  assert.match(css, /label\[for="autoOpenLinkedToggle"\][\s\S]*display: none !important/);
  assert.match(js, /if \(!window\.SIDENOTE_ANDROID && els\.insertPage\) els\.insertPage\.addEventListener/);
  assert.doesNotMatch(manifest, /android\.intent\.action\.(SEND|VIEW)/);
  assert.doesNotMatch(java, /handleIncomingIntent|setSharedPage|extractUrl\(/);
  assert.match(js, /linkedUrl: safeText\(note\.linkedUrl\)/); // preserve cross-client data records
});

test('Android uses consistent dimmed overlays and outside-tap dismissal for editor and account/settings surfaces', () => {
  const html = fs.readFileSync(path.join(webDir, 'sidepanel.html'), 'utf8');
  const js = fs.readFileSync(path.join(webDir, 'sidepanel.js'), 'utf8');
  const css = fs.readFileSync(path.join(webDir, 'android-mobile.css'), 'utf8');
  assert.match(html, /id="mobileOverlayBackdrop"/);
  assert.match(js, /setMobileOverlay\("editor", true\)/);
  assert.match(js, /setMobileOverlay\("account", true\)/);
  assert.match(js, /mobileOverlayOwner === "editor"\) returnToNotesList\(\)/);
  assert.match(js, /event\.target === els\.settingsBackdrop\) closeSettings\(\)/);
  assert.match(css, /#mobileOverlayBackdrop[\s\S]*backdrop-filter: blur/);
  assert.match(css, /mobile-editor-active \.editor-wrap[\s\S]*position: fixed/);
  assert.match(css, /\.account-popover[\s\S]*position: fixed/);
  assert.match(css, /\.settings-backdrop[\s\S]*position: fixed/);
});

test('Android removes redundant footer, simplifies account header, and keeps icon-only Trash action', () => {
  const css = fs.readFileSync(path.join(webDir, 'android-mobile.css'), 'utf8');
  const js = fs.readFileSync(path.join(webDir, 'sidepanel.js'), 'utf8');
  assert.match(css, /\.account-trigger-copy small[\s\S]*display: none !important/);
  assert.match(css, /\.account-avatar[\s\S]*display: none !important/);
  assert.match(css, /\.app-footer[\s\S]*display: none !important/);
  assert.match(css, /\.trash-open-button > span:not\(\.trash-count\)[\s\S]*display: none !important/);
  assert.match(js, /guestBackupReminderShown/);
  assert.match(js, /Saved on this device · Sign in to back up & sync/);
});


test('MainActivity defines the null-safe string helper used by Firebase auth', () => {
  const java = fs.readFileSync(path.join(root, 'app/src/main/java/com/dubtach/sidenote/MainActivity.java'), 'utf8');
  assert.match(java, /private static String safe\(String value\)\s*\{\s*return value == null \? "" : value\.trim\(\);\s*\}/);
  assert.match(java, /safe\(email\)/);
  assert.match(java, /safe\(user\.getEmail\(\)\)/);
});

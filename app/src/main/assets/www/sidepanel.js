(() => {
  "use strict";

  const STORAGE_KEY = "sidenote_notes_v1";
  const LAYOUT_KEY = "sidenote_layout_v1";
  const SETTINGS_KEY = "sidenote_settings_v1";
  const CLOUD_META_KEY = "sidenote_cloud_sync_v1";
  const FIREBASE_SESSION_KEY = "sidenote_firebase_session_v1";
  const FIREBASE_SYNC_PREFS_KEY = "sidenote_firebase_sync_preferences_v1";
  const FIREBASE_OWNER_KEY = "sidenote_firebase_local_owner_v1";
  const FIREBASE_SNAPSHOT_PREFIX = "sidenote_firebase_account_snapshot_v1_";
  const DRIVE_BACKUP_NAME = "sidenote-backup.json";
  const FirebaseAPI = window.SideNoteFirebase;
  const FIREBASE = window.SIDENOTE_FIREBASE_CONFIG;
  const DRIVE_APPDATA_SCOPE = "https://www.googleapis.com/auth/drive.appdata";
  const DEFAULT_SETTINGS = Object.freeze({
    theme: "light",
    editorFontSize: "standard",
    autoOpenLinked: true,
    confirmDelete: true,
    confirmUnlink: false,
    autoHideToolbar: true,
    compactCards: false,
    focusNewNote: true,
    sortMode: "newest",
    profileAvatar: "initial"
  });
  const $ = (id) => document.getElementById(id);

  const els = {
    search: $("searchInput"),
    topbar: $("topbar"),
    searchToggle: $("searchToggle"),
    searchClose: $("searchClose"),
    settingsButton: $("settingsButton"),
    settingsFooter: $("settingsFooter"),
    accountButton: $("accountButton"),
    accountAvatar: $("accountAvatar"),
    profileAvatarChoices: $("profileAvatarChoices"),
    accountButtonLabel: $("accountButtonLabel"),
    accountButtonSubline: $("accountButtonSubline"),
    accountSyncIndicator: $("accountSyncIndicator"),
    accountPopover: $("accountPopover"),
    accountPopoverClose: $("accountPopoverClose"),
    settingsBackdrop: $("settingsBackdrop"),
    settingsPanel: document.querySelector(".settings-panel"),
    settingsClose: $("settingsClose"),
    changeShortcutButton: $("changeShortcutButton"),
    cloudStatusDot: $("cloudStatusDot"),
    cloudStatusTitle: $("cloudStatusTitle"),
    cloudStatusDetail: $("cloudStatusDetail"),
    firebaseStatusDot: $("firebaseStatusDot"),
    firebaseStatusTitle: $("firebaseStatusTitle"),
    firebaseStatusDetail: $("firebaseStatusDetail"),
    firebaseEmail: $("firebaseEmail"),
    firebasePassword: $("firebasePassword"),
    firebaseSignedOut: $("firebaseSignedOut"),
    firebaseSignedIn: $("firebaseSignedIn"),
    firebaseSignInButton: $("firebaseSignInButton"),
    firebaseCreateButton: $("firebaseCreateButton"),
    firebaseForgotPasswordButton: $("firebaseForgotPasswordButton"),
    firebaseGoogleButton: $("firebaseGoogleButton"),
    firebaseSignOutButton: $("firebaseSignOutButton"),
    firebaseSyncNowButton: $("firebaseSyncNowButton"),
    firebaseAutoSyncToggle: $("firebaseAutoSyncToggle"),
    firebaseFootnote: $("firebaseFootnote"),
    connectGoogleButton: $("connectGoogleButton"),
    backupNowButton: $("backupNowButton"),
    restoreBackupButton: $("restoreBackupButton"),
    disconnectGoogleButton: $("disconnectGoogleButton"),
    autoSyncToggle: $("autoSyncToggle"),
    themeSelect: $("themeSelect"),
    editorFontSizeSelect: $("editorFontSizeSelect"),
    autoOpenLinkedToggle: $("autoOpenLinkedToggle"),
    confirmDeleteToggle: $("confirmDeleteToggle"),
    confirmUnlinkToggle: $("confirmUnlinkToggle"),
    autoHideToolbarToggle: $("autoHideToolbarToggle"),
    compactCardsToggle: $("compactCardsToggle"),
    focusNewNoteToggle: $("focusNewNoteToggle"),
    sortSelect: $("sortSelect"),
    editorWrap: $("editorWrap"),
    appShell: $("appShell"),
    notesSection: $("notesSection"),
    splitter: $("listEditorSplitter"),
    appFooter: $("appFooter"),
    editorInfo: $("editorInfoButton"),
    closeEditor: $("closeEditorButton"),
    newButton: $("newNoteButton"),
    emptyNewButton: $("emptyNewNoteButton"),
    notesCount: $("notesCount"),
    notesList: $("notesList"),
    bulkActionsBar: $("bulkActionsBar"),
    bulkSelectedCount: $("bulkSelectedCount"),
    noteActionMenu: $("noteActionMenu"),
    noSearchResults: $("noSearchResults"),
    listHint: $("listHint"),
    emptyState: $("emptyState"),
    noteEditor: $("noteEditor"),
    title: $("noteTitle"),
    body: $("noteBody"),
    bodyWrap: $("noteBodyWrap"),
    bodyMirror: $("noteBodyMirror"),
    bodyMirrorContent: $("noteBodyMirrorContent"),
    checklistLayer: $("noteChecklistLayer"),
    writingToolbarToggle: $("writingToolbarToggle"),
    pin: $("pinButton"),
    delete: $("deleteButton"),
    copy: $("copyButton"),
    insertPage: $("insertPageButton"),
    saveIndicator: $("saveIndicator"),
    saveStatus: $("saveStatus"),
    toast: $("toast"),
    writingToolbar: $("writingToolbar"),
    writingHelp: $("writingHelpButton")
  };

  let notes = [];
  let settings = { ...DEFAULT_SETTINGS };
  let cloudState = {
    connected: false, autoSync: false, fileId: "", lastSyncedAt: 0, lastError: "",
    deviceId: "", deletedNotes: {}, settingsUpdatedAt: 0, layoutUpdatedAt: 0
  };
  let cloudSyncTimer = null;
  let cloudSyncInProgress = false;
  let cloudSyncRequestedAgain = false;
  let applyingCloudData = false;
  let firebaseSession = null;
  let firebaseIdToken = "";
  let firebaseSyncPrefs = { autoSync: true, lastSyncedAt: 0, lastRemoteRevision: 0, lastError: "" };
  let firebaseLocalDirty = false;
  let firebaseLocalRevision = 0;
  let firebaseSyncTimer = null;
  let firebaseSyncInProgress = false;
  let firebaseSyncRequestedAgain = false;
  let applyingFirebaseData = false;
  let activeId = null;
  const selectedNoteIds = new Set();
  let activeNoteMenuId = null;
  let longPressTimer = null;
  let notePressState = null;
  let longPressTriggeredId = null;
  let longPressTriggeredAt = 0;
  let saveTimer = null;
  let toastTimer = null;
  let saveQueue = Promise.resolve();
  let splitterDrag = null;
  let suppressToolbarAutohide = false;

  // Use a light random paper texture on each panel open; note tint/texture is saved per note.
  els.appShell.dataset.appTexture = String(Math.floor(Math.random() * 4));

  function makeId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function safeText(value) {
    return String(value ?? "");
  }

  const PROFILE_AVATARS = Object.freeze([
    { id: "initial", label: "Your initials", glyph: "DS" },
    { id: "sparkle", label: "Sparkle", glyph: "✦" },
    { id: "leaf", label: "Leaf", glyph: "🌿" },
    { id: "music", label: "Music", glyph: "♫" },
    { id: "bee", label: "Bee", glyph: "🐝" },
    { id: "rocket", label: "Rocket", glyph: "🚀" },
    { id: "moon", label: "Moon", glyph: "☾" },
    { id: "book", label: "Books", glyph: "📚" },
    { id: "coffee", label: "Coffee", glyph: "☕" }
  ]);

  function accountInitials() {
    const displayName = safeText(firebaseSession?.displayName).trim();
    if (displayName) {
      const parts = displayName.split(/\s+/).filter(Boolean);
      return parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase().slice(0, 2);
    }
    const emailName = safeText(firebaseSession?.email).split("@")[0].trim();
    return (emailName[0] || "S").toUpperCase();
  }

  function renderProfileAvatar() {
    if (!els.accountAvatar || !els.profileAvatarChoices) return;
    const selectedId = PROFILE_AVATARS.some((item) => item.id === settings.profileAvatar)
      ? settings.profileAvatar : "initial";
    const selected = PROFILE_AVATARS.find((item) => item.id === selectedId) || PROFILE_AVATARS[0];
    const initials = accountInitials();
    els.accountAvatar.dataset.avatar = selected.id;
    els.accountAvatar.textContent = selected.id === "initial" ? initials : selected.glyph;
    els.accountAvatar.title = `${selected.label} profile icon`;

    if (els.profileAvatarChoices.childElementCount === 0) {
      for (const avatar of PROFILE_AVATARS) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "profile-avatar-choice";
        button.dataset.avatarChoice = avatar.id;
        button.title = avatar.label;
        button.setAttribute("aria-label", avatar.label);
        button.setAttribute("aria-pressed", "false");
        els.profileAvatarChoices.append(button);
      }
    }
    for (const button of els.profileAvatarChoices.querySelectorAll("[data-avatar-choice]")) {
      const avatar = PROFILE_AVATARS.find((item) => item.id === button.dataset.avatarChoice) || PROFILE_AVATARS[0];
      button.dataset.avatar = avatar.id;
      button.textContent = avatar.id === "initial" ? initials : avatar.glyph;
      button.setAttribute("aria-label", avatar.id === "initial" ? `Your initials (${initials})` : avatar.label);
      button.title = avatar.id === "initial" ? `Your initials (${initials})` : avatar.label;
      button.setAttribute("aria-pressed", String(avatar.id === selectedId));
    }
  }

  function currentNote() {
    return notes.find((note) => note.id === activeId) || null;
  }

  function setSaveState(state, message) {
    els.saveIndicator.classList.remove("saving", "error");
    if (state === "saving") els.saveIndicator.classList.add("saving");
    if (state === "error") els.saveIndicator.classList.add("error");
    els.saveStatus.textContent = message;
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove("visible"), 1700);
  }

  function metadataText(note) {
    const date = new Date(note.updatedAt || note.createdAt || Date.now());
    const body = safeText(note.body);
    const words = body.trim().split(/\s+/).filter(Boolean).length;
    const characters = body.length;
    const editedDate = date.toLocaleDateString([], { weekday: "short", year: "numeric", month: "short", day: "numeric" });
    const editedTime = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    return `Last edited: ${editedDate} at ${editedTime}\nWords: ${words}\nCharacters: ${characters}`;
  }

  function wordCount(note) {
    return safeText(note.body).trim().split(/\s+/).filter(Boolean).length;
  }

  function sortNotes() {
    const edited = (note) => Number(note.updatedAt || note.createdAt || 0);
    const created = (note) => Number(note.createdAt || 0);
    notes.sort((a, b) => {
      if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
      const byEdited = edited(b) - edited(a);
      switch (settings.sortMode) {
        case "oldest": return edited(a) - edited(b) || created(a) - created(b);
        case "title-asc": return noteTitle(a).localeCompare(noteTitle(b), undefined, { sensitivity: "base" }) || byEdited;
        case "title-desc": return noteTitle(b).localeCompare(noteTitle(a), undefined, { sensitivity: "base" }) || byEdited;
        case "words-desc": return wordCount(b) - wordCount(a) || byEdited;
        case "words-asc": return wordCount(a) - wordCount(b) || byEdited;
        case "newest":
        default: return byEdited || created(b) - created(a);
      }
    });
  }

  function noteTitle(note) {
    return safeText(note.title).trim() || "Untitled note";
  }

  function notePreview(note) {
    const content = safeText(note.body).replace(/\s+/g, " ").trim();
    return content || "No additional text";
  }

  function renderList() {
    sortNotes();
    const query = els.search.value.trim().toLowerCase();
    const filtered = notes.filter((note) => `${note.title || ""}\n${note.body || ""}`.toLowerCase().includes(query));
    els.notesCount.textContent = String(notes.length);
    els.listHint.textContent = query ? `${filtered.length} found` : (notes.length ? "" : "A fresh start");
    els.notesList.replaceChildren();

    for (const note of filtered) {
      const card = document.createElement("article");
      card.className = `note-card${note.id === activeId ? " active" : ""}`;
      card.dataset.tint = String(Number.isInteger(note.tint) ? note.tint : 0);
      card.dataset.texture = String(Number.isInteger(note.texture) ? note.texture : 0);
      card.setAttribute("role", "group");
      card.setAttribute("tabindex", "0");
      card.setAttribute("aria-label", `${noteTitle(note)}${note.pinned ? ", pinned" : ""}`);
      card.dataset.noteId = note.id;

      const head = document.createElement("div");
      head.className = "note-card-head";
      const title = document.createElement("div");
      title.className = "note-card-title";
      title.textContent = noteTitle(note);
      head.append(title);

      const selectionMark = document.createElement("span");
      selectionMark.className = "note-selection-indicator";
      selectionMark.setAttribute("aria-hidden", "true");
      selectionMark.innerHTML = '<svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"></path></svg>';
      head.append(selectionMark);

      if (note.pinned) {
        const pin = document.createElement("span");
        pin.className = "card-pin";
        pin.setAttribute("aria-label", "Pinned");
        pin.title = "Pinned";
        pin.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m16 4 4 4-3 1-3 4v4l-2 2-2-6-5-5 2-2 4 1 4-3Z"/></svg>';
        head.append(pin);
      }

      const menuButton = document.createElement("button");
      menuButton.type = "button";
      menuButton.className = "note-card-menu-button";
      menuButton.dataset.noteMenuTrigger = note.id;
      menuButton.title = "More note actions";
      menuButton.setAttribute("aria-label", `More actions for ${noteTitle(note)}`);
      menuButton.setAttribute("aria-haspopup", "menu");
      menuButton.setAttribute("aria-expanded", String(activeNoteMenuId === note.id));
      menuButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="1.7"></circle><circle cx="12" cy="12" r="1.7"></circle><circle cx="12" cy="19" r="1.7"></circle></svg>';
      head.append(menuButton);

      const preview = document.createElement("div");
      preview.className = "note-card-preview";
      preview.textContent = notePreview(note);
      card.append(head, preview);

      card.addEventListener("click", (event) => {
        if (event.target.closest(".note-card-menu-button")) return;
        if (longPressTriggeredId === note.id && Date.now() - longPressTriggeredAt < 1400) {
          longPressTriggeredId = null;
          longPressTriggeredAt = 0;
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        if (selectedNoteIds.size) toggleNoteSelection(note.id);
        else selectNote(note.id);
      });
      card.addEventListener("keydown", (event) => {
        if (event.target !== card || !["Enter", " "].includes(event.key)) return;
        event.preventDefault();
        if (selectedNoteIds.size) toggleNoteSelection(note.id);
        else selectNote(note.id);
      });
      card.addEventListener("pointerdown", (event) => startNoteLongPress(event, note.id));
      card.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        if (!selectedNoteIds.has(note.id)) selectedNoteIds.add(note.id);
        updateSelectionUI();
      });
      menuButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        openNoteActionMenu(note.id, menuButton);
      });
      els.notesList.append(card);
    }

    const hasQueryAndNoResults = Boolean(query) && filtered.length === 0;
    els.noSearchResults.classList.toggle("hidden", !hasQueryAndNoResults);
    els.notesList.classList.toggle("hidden", hasQueryAndNoResults);
    // Keep selection limited to existing notes; filters only hide, not deselect.
    for (const id of [...selectedNoteIds]) {
      if (!notes.some((note) => note.id === id)) selectedNoteIds.delete(id);
    }
    updateSelectionUI();
    if (activeNoteMenuId && !filtered.some((note) => note.id === activeNoteMenuId)) closeNoteActionMenu();
  }

  function updateSelectionUI() {
    const selectionMode = selectedNoteIds.size > 0;
    els.notesSection.classList.toggle("selection-mode", selectionMode);
    els.bulkActionsBar.classList.toggle("hidden", !selectionMode);
    els.bulkSelectedCount.textContent = `${selectedNoteIds.size} selected`;
    for (const card of els.notesList.querySelectorAll(".note-card")) {
      const id = card.dataset.noteId;
      const selected = selectedNoteIds.has(id);
      card.classList.toggle("selection-mode", selectionMode);
      card.classList.toggle("selected", selected);
      const noteForLabel = notes.find((note) => note.id === id);
      if (noteForLabel) card.setAttribute("aria-label", `${noteTitle(noteForLabel)}${noteForLabel.pinned ? ", pinned" : ""}${selected ? ", selected" : ""}`);
      const marker = card.querySelector(".note-selection-indicator");
      if (marker) marker.classList.toggle("checked", selected);
      const trigger = card.querySelector(".note-card-menu-button");
      if (trigger) trigger.setAttribute("aria-expanded", String(activeNoteMenuId === id));
    }
    const visibleIds = [...els.notesList.querySelectorAll(".note-card")].map((card) => card.dataset.noteId);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedNoteIds.has(id));
    const selectAll = els.bulkActionsBar.querySelector('[data-bulk-action="select-all"]');
    if (selectAll) selectAll.textContent = allVisibleSelected ? "None" : "All";
    const selectedNotes = notes.filter((note) => selectedNoteIds.has(note.id));
    const allPinned = selectedNotes.length > 0 && selectedNotes.every((note) => note.pinned);
    const pinAction = els.bulkActionsBar.querySelector('[data-bulk-action="pin"]');
    if (pinAction) {
      pinAction.textContent = allPinned ? "Unpin" : "Pin";
      pinAction.title = allPinned ? "Unpin selected notes" : "Pin selected notes";
    }
    const mergeAction = els.bulkActionsBar.querySelector('[data-bulk-action="merge"]');
    if (mergeAction) mergeAction.disabled = selectedNoteIds.size < 2;
  }

  function toggleNoteSelection(id) {
    closeNoteActionMenu();
    if (selectedNoteIds.has(id)) selectedNoteIds.delete(id);
    else selectedNoteIds.add(id);
    updateSelectionUI();
  }

  function clearNoteSelection() {
    selectedNoteIds.clear();
    updateSelectionUI();
  }

  function startNoteLongPress(event, id) {
    // A new pointer sequence clears a stale suppression flag in case Chrome did
    // not dispatch click after a touch/long-press sequence.
    longPressTriggeredId = null;
    longPressTriggeredAt = 0;
    if (event.button !== 0 || event.target.closest(".note-card-menu-button")) return;
    clearTimeout(longPressTimer);
    notePressState = { id, pointerId: event.pointerId, x: event.clientX, y: event.clientY, triggered: false };
    longPressTimer = setTimeout(() => {
      if (!notePressState || notePressState.id !== id) return;
      notePressState.triggered = true;
      longPressTriggeredId = id;
      longPressTriggeredAt = Date.now();
      selectedNoteIds.add(id);
      updateSelectionUI();
      showToast("Selection mode · tap more notes");
    }, 520);
  }

  function cancelNoteLongPress(event) {
    if (!notePressState || event.pointerId !== notePressState.pointerId) return;
    clearTimeout(longPressTimer);
    longPressTimer = null;
    if (!notePressState.triggered) notePressState = null;
  }

  function finishNoteLongPress(event) {
    if (!notePressState || event.pointerId !== notePressState.pointerId) return;
    clearTimeout(longPressTimer);
    longPressTimer = null;
    notePressState = null;
  }

  function openNoteActionMenu(id, anchor) {
    const note = notes.find((item) => item.id === id);
    if (!note) return;
    activeNoteMenuId = id;
    const pinAction = els.noteActionMenu.querySelector('[data-note-action="pin"]');
    if (pinAction) pinAction.textContent = note.pinned ? "Unpin note" : "Pin note";
    els.noteActionMenu.classList.remove("hidden");
    const rect = anchor.getBoundingClientRect();
    const menu = els.noteActionMenu;
    const width = menu.offsetWidth || 162;
    const height = menu.offsetHeight || 184;
    const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8));
    let top = rect.bottom + 4;
    if (top + height > window.innerHeight - 8) top = rect.top - height - 4;
    top = Math.max(8, Math.min(top, window.innerHeight - height - 8));
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    updateSelectionUI();
  }

  function closeNoteActionMenu() {
    activeNoteMenuId = null;
    if (els.noteActionMenu) els.noteActionMenu.classList.add("hidden");
    if (els.notesList) {
      for (const trigger of els.notesList.querySelectorAll(".note-card-menu-button")) trigger.setAttribute("aria-expanded", "false");
    }
  }

  function duplicateNotes(ids, { openFirst = false } = {}) {
    const originals = notes.filter((note) => ids.includes(note.id));
    if (!originals.length) return;
    const now = Date.now();
    const copies = originals.map((note) => ({
      ...note,
      id: makeId(),
      title: safeText(note.title).trim() ? `${safeText(note.title).trim()} (copy)` : "",
      pinned: false,
      linkedUrl: "",
      linkedTitle: "",
      linkDisabled: false,
      tint: Math.floor(Math.random() * 7),
      texture: Math.floor(Math.random() * 5),
      createdAt: now,
      updatedAt: now
    }));
    notes.unshift(...copies);
    clearNoteSelection();
    closeNoteActionMenu();
    if (openFirst && copies.length === 1) activeId = copies[0].id;
    renderList();
    if (openFirst && copies.length === 1) renderEditor({ focusTitle: settings.focusNewNote });
    else if (activeId && notes.some((note) => note.id === activeId)) renderEditor();
    scheduleSave();
    showToast(copies.length === 1 ? "Note duplicated" : `${copies.length} notes duplicated`);
  }

  async function deleteNotesByIds(ids) {
    const existingIds = new Set(notes.filter((note) => ids.includes(note.id)).map((note) => note.id));
    if (!existingIds.size) return;
    if (settings.confirmDelete && !window.confirm(`Delete ${existingIds.size} selected note${existingIds.size === 1 ? "" : "s"}? This cannot be undone.`)) return;
    flushSave();
    const deletedAt = Date.now();
    cloudState.deletedNotes = cloudState.deletedNotes || {};
    for (const id of existingIds) cloudState.deletedNotes[id] = deletedAt;
    void persistCloudState();
    notes = notes.filter((note) => !existingIds.has(note.id));
    if (existingIds.has(activeId)) activeId = null;
    clearNoteSelection();
    closeNoteActionMenu();
    renderList();
    renderEditor();
    await saveNow();
    showToast(`${existingIds.size} note${existingIds.size === 1 ? "" : "s"} deleted`);
  }

  async function mergeSelectedNotes() {
    const selected = notes.filter((note) => selectedNoteIds.has(note.id));
    if (selected.length < 2) { showToast("Select at least two notes to merge"); return; }
    const previewTitles = selected.slice(0, 3).map(noteTitle).join(", ");
    const extra = selected.length > 3 ? ` and ${selected.length - 3} more` : "";
    if (!window.confirm(`Merge ${selected.length} notes into one new note and remove the originals?\n\n${previewTitles}${extra}`)) return;
    flushSave();
    const now = Date.now();
    const mergedBody = selected.map((note) => {
      const heading = noteTitle(note);
      return `${heading}\n${"─".repeat(Math.max(4, Math.min(heading.length, 34)))}\n${safeText(note.body).trim()}`.trimEnd();
    }).join("\n\n────────────\n\n");
    const merged = {
      id: makeId(), title: "Merged notes", body: mergedBody, pinned: false,
      tint: Math.floor(Math.random() * 7), texture: Math.floor(Math.random() * 5),
      linkedUrl: "", linkedTitle: "", linkDisabled: false,
      createdAt: now, updatedAt: now
    };
    cloudState.deletedNotes = cloudState.deletedNotes || {};
    for (const note of selected) cloudState.deletedNotes[note.id] = now;
    notes = notes.filter((note) => !selectedNoteIds.has(note.id));
    notes.unshift(merged);
    if (selected.some((note) => note.id === activeId)) activeId = merged.id;
    clearNoteSelection();
    closeNoteActionMenu();
    void persistCloudState();
    renderList();
    activeId = merged.id;
    renderEditor();
    await saveNow();
    showToast(`${selected.length} notes merged`);
  }

  function togglePinForNote(id) {
    const note = notes.find((item) => item.id === id);
    if (!note) return;
    note.pinned = !note.pinned;
    note.updatedAt = Date.now();
    closeNoteActionMenu();
    renderList();
    if (activeId === id) renderEditor();
    scheduleSave();
    showToast(note.pinned ? "Note pinned" : "Note unpinned");
  }

  async function runNoteAction(action) {
    const id = activeNoteMenuId;
    if (!id) return;
    closeNoteActionMenu();
    switch (action) {
      case "open": selectNote(id); break;
      case "select": selectedNoteIds.clear(); selectedNoteIds.add(id); updateSelectionUI(); showToast("Select more notes, then choose an action"); break;
      case "pin": togglePinForNote(id); break;
      case "duplicate": duplicateNotes([id], { openFirst: true }); break;
      case "delete": await deleteNotesByIds([id]); break;
      default: break;
    }
  }

  async function runBulkAction(action) {
    const ids = [...selectedNoteIds];
    if (!ids.length && action !== "cancel") return;
    switch (action) {
      case "select-all": {
        const visibleIds = [...els.notesList.querySelectorAll(".note-card")].map((card) => card.dataset.noteId);
        const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedNoteIds.has(id));
        if (allSelected) visibleIds.forEach((id) => selectedNoteIds.delete(id));
        else visibleIds.forEach((id) => selectedNoteIds.add(id));
        updateSelectionUI();
        break;
      }
      case "duplicate": duplicateNotes(ids); break;
      case "merge": await mergeSelectedNotes(); break;
      case "delete": await deleteNotesByIds(ids); break;
      case "pin": {
        const selected = notes.filter((note) => selectedNoteIds.has(note.id));
        const setPinned = !selected.every((note) => note.pinned);
        const now = Date.now();
        for (const note of selected) { note.pinned = setPinned; note.updatedAt = now; }
        renderList();
        if (activeId && selectedNoteIds.has(activeId)) renderEditor();
        scheduleSave();
        showToast(setPinned ? "Selected notes pinned" : "Selected notes unpinned");
        break;
      }
      case "cancel": clearNoteSelection(); break;
      default: break;
    }
  }

  function renderEditor({ focusTitle = false, preserveFocus = false } = {}) {
    const titleWasFocused = preserveFocus && document.activeElement === els.title;
    const bodyWasFocused = preserveFocus && document.activeElement === els.body;
    const titleSelection = titleWasFocused ? [els.title.selectionStart, els.title.selectionEnd] : null;
    const bodySelection = bodyWasFocused ? [els.body.selectionStart, els.body.selectionEnd] : null;
    const bodyScrollTop = bodyWasFocused ? els.body.scrollTop : 0;
    const note = currentNote();
    const hasNote = Boolean(note);
    els.appShell.classList.toggle("editor-closed", !hasNote);
    els.emptyState.classList.toggle("hidden", hasNote);
    els.noteEditor.classList.toggle("hidden", !hasNote);
    els.noteEditor.classList.remove("toolbar-open");
    els.writingToolbarToggle.setAttribute("aria-expanded", "false");
    els.writingToolbarToggle.title = "Show writing tools";
    els.writingToolbarToggle.setAttribute("aria-label", "Show writing tools");
    if (!note) {
      els.bodyMirrorContent.replaceChildren();
      els.checklistLayer.replaceChildren();
      updatePageLinkButton(null);
      delete els.editorWrap.dataset.tint;
      delete els.editorWrap.dataset.texture;
      const emptyHeading = els.emptyState.querySelector("h2");
      const emptyDescription = els.emptyState.querySelector("p");
      if (emptyHeading) emptyHeading.textContent = notes.length ? "Choose a note." : "A note to self.";
      if (emptyDescription) emptyDescription.textContent = notes.length
        ? "Select a note above, or start a new one."
        : "Catch a thought before it disappears.";
      return;
    }
    els.editorWrap.dataset.tint = String(Number.isInteger(note.tint) ? note.tint : 0);
    els.editorWrap.dataset.texture = String(Number.isInteger(note.texture) ? note.texture : 0);

    els.editorInfo.title = metadataText(note);
    els.editorInfo.setAttribute("aria-label", "Note details. Hover to see last edited time, word count, and character count.");
    updatePageLinkButton(note);
    els.title.value = safeText(note.title);
    els.body.value = safeText(note.body);
    renderBodyMirror();
    els.pin.classList.toggle("pinned", Boolean(note.pinned));
    els.pin.setAttribute("aria-pressed", String(Boolean(note.pinned)));
    els.pin.setAttribute("title", note.pinned ? "Unpin note" : "Pin note");
    if (focusTitle) {
      requestAnimationFrame(() => els.title.focus());
    } else if (titleWasFocused && titleSelection) {
      const start = Math.min(titleSelection[0] ?? 0, els.title.value.length);
      const end = Math.min(titleSelection[1] ?? start, els.title.value.length);
      els.title.setSelectionRange(start, end);
      if (document.activeElement !== els.title) els.title.focus();
    } else if (bodyWasFocused && bodySelection) {
      const start = Math.min(bodySelection[0] ?? 0, els.body.value.length);
      const end = Math.min(bodySelection[1] ?? start, els.body.value.length);
      els.body.setSelectionRange(start, end);
      els.body.scrollTop = bodyScrollTop;
      if (document.activeElement !== els.body) els.body.focus();
      syncBodyMirrorScroll();
    }
  }

  function scheduleSave() {
    // A real edit must invalidate an in-flight cloud merge even while the
    // merge is applying data; otherwise a keystroke can be overwritten.
    firebaseLocalDirty = true;
    firebaseLocalRevision += 1;
    if (firebaseSession?.uid && !firebaseSyncPrefs.autoSync) renderFirebaseUI();
    setSaveState("saving", "Saving…");
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 260);
  }

  async function saveNow({ skipFirebaseSyncSchedule = false } = {}) {
    clearTimeout(saveTimer);
    saveTimer = null;
    try {
      const snapshot = notes.map((note) => ({ ...note }));
      const signature = JSON.stringify(snapshot);
      // Serialize writes so a pending older save cannot overwrite a newer edit/delete.
      const write = () => chrome.storage.local.set({ [STORAGE_KEY]: snapshot });
      saveQueue = saveQueue.catch(() => {}).then(write);
      await saveQueue;
      if (signature === JSON.stringify(notes) && !saveTimer) {
        setSaveState("saved", "All changes saved");
      }
      if (!applyingFirebaseData && !skipFirebaseSyncSchedule) {
        firebaseLocalDirty = true;
        firebaseLocalRevision += 1;
        scheduleFirebaseSync();
      }
    } catch (error) {
      console.error("SideNote: save failed", error);
      setSaveState("error", "Could not save");
      showToast("Could not save your note. Check extension storage.");
    }
  }

  function flushSave() {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
      void saveNow();
    }
  }

  function selectNote(id) {
    flushSave();
    activeId = id;
    renderList();
    renderEditor();
  }

  function createNote() {
    flushSave();
    const now = Date.now();
    const note = {
      id: makeId(), title: "", body: "", pinned: false,
      tint: Math.floor(Math.random() * 7),
      texture: Math.floor(Math.random() * 5),
      createdAt: now, updatedAt: now
    };
    notes.unshift(note);
    activeId = note.id;
    els.search.value = "";
    renderList();
    renderEditor({ focusTitle: settings.focusNewNote });
    scheduleSave();
  }

  function updateCurrentNote(field, value) {
    const note = currentNote();
    if (!note) return;
    note[field] = value;
    note.updatedAt = Date.now();
    renderList();
    els.editorInfo.title = metadataText(note);
    scheduleSave();
  }

  async function deleteCurrentNote() {
    const note = currentNote();
    if (!note) return;
    const title = noteTitle(note);
    if (settings.confirmDelete && !window.confirm(`Delete “${title}”? This cannot be undone.`)) return;
    flushSave();
    cloudState.deletedNotes = cloudState.deletedNotes || {};
    cloudState.deletedNotes[note.id] = Date.now();
    void persistCloudState();
    notes = notes.filter((item) => item.id !== note.id);
    activeId = null;
    renderList();
    renderEditor();
    await saveNow();
    showToast("Note deleted");
  }

  async function copyCurrentNote() {
    const note = currentNote();
    if (!note) return;
    const text = [safeText(note.title).trim(), safeText(note.body).trim()].filter(Boolean).join("\n\n");
    if (!text) {
      showToast("This note is empty");
      return;
    }
    try {
      if (window.SIDENOTE_ANDROID && window.SideNoteAndroid?.copyToClipboard) {
        window.SideNoteAndroid.copyToClipboard(text);
        showToast("Copied to clipboard");
        return;
      }
      await navigator.clipboard.writeText(text);
      showToast("Copied to clipboard");
    } catch (error) {
      console.error("SideNote: clipboard copy failed", error);
      const temporary = document.createElement("textarea");
      temporary.value = text;
      temporary.style.position = "fixed";
      temporary.style.opacity = "0";
      document.body.append(temporary);
      temporary.select();
      const copied = document.execCommand("copy");
      temporary.remove();
      showToast(copied ? "Copied to clipboard" : "Could not copy note");
    }
  }

  // The editor intentionally stores plain text, so smart writing helpers add
  // portable text markers rather than introducing a fragile HTML-only format.
  function parseListLine(line) {
    let match = line.match(/^([ \t]*)([-*+•])([ \t]+)\[([ xX])\]([ \t]+)(.*)$/);
    if (match) {
      return {
        type: "checklist", indent: match[1], marker: match[2], number: 0,
        prefixLength: line.length - match[6].length, content: match[6],
        checked: /x/i.test(match[4]), checkboxKind: "markdown",
        checkboxIndex: match[1].length + match[2].length + match[3].length + 1
      };
    }

    match = line.match(/^([ \t]*)([☐☑☒])([ \t]+)(.*)$/);
    if (match) {
      return {
        type: "checklist", indent: match[1], marker: match[2], number: 0,
        prefixLength: line.length - match[4].length, content: match[4],
        checked: match[2] !== "☐", checkboxKind: "unicode",
        checkboxIndex: match[1].length
      };
    }

    match = line.match(/^([ \t]*)(\d+)([.)])([ \t]+)(.*)$/);
    if (match) {
      return {
        type: "ordered", indent: match[1], number: Number(match[2]), marker: match[3],
        prefixLength: line.length - match[5].length, content: match[5]
      };
    }

    // Alphabetic ordered lists: a. / a) ... z. / z), then aa. / aa).
    match = line.match(/^([ \t]*)([a-zA-Z]{1,2})([.)])([ \t]+)(.*)$/);
    if (match && (match[2].length === 1 || match[2] === match[2].toLowerCase() || match[2] === match[2].toUpperCase())) {
      return {
        type: "alpha-ordered", indent: match[1], alpha: match[2], marker: match[3],
        prefixLength: line.length - match[5].length, content: match[5]
      };
    }

    match = line.match(/^([ \t]*)([-*+•–])([ \t]+)(.*)$/);
    if (match) {
      return {
        type: "unordered", indent: match[1], marker: match[2], number: 0,
        prefixLength: line.length - match[4].length, content: match[4]
      };
    }
    return null;
  }

  function nextAlphabeticLabel(label) {
    const upper = label === label.toUpperCase();
    const chars = label.toLowerCase().split("");
    let carry = 1;
    for (let index = chars.length - 1; index >= 0 && carry; index -= 1) {
      const code = chars[index].charCodeAt(0) - 97 + carry;
      if (code >= 26) {
        chars[index] = "a";
        carry = 1;
      } else {
        chars[index] = String.fromCharCode(97 + code);
        carry = 0;
      }
    }
    if (carry) chars.unshift("a");
    const result = chars.join("");
    return upper ? result.toUpperCase() : result;
  }

  function alphabeticLabelFromNumber(number) {
    let remainder = Math.max(1, Number(number) || 1);
    let label = "";
    while (remainder > 0) {
      remainder -= 1;
      label = String.fromCharCode(97 + (remainder % 26)) + label;
      remainder = Math.floor(remainder / 26);
    }
    return label;
  }

  function measureTextWidth(text) {
    const style = window.getComputedStyle(els.body);
    const canvas = measureTextWidth.canvas || (measureTextWidth.canvas = document.createElement("canvas"));
    const context = canvas.getContext("2d");
    context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    return context.measureText(text).width;
  }

  function renderBodyMirror() {
    if (!els.bodyMirror || !els.bodyMirrorContent || !els.checklistLayer) return;
    const value = els.body.value;
    els.bodyMirrorContent.style.width = `${els.body.clientWidth}px`;
    els.bodyMirrorContent.replaceChildren();
    els.checklistLayer.replaceChildren();

    if (!value) {
      const placeholder = document.createElement("div");
      placeholder.className = "body-placeholder";
      placeholder.textContent = els.body.placeholder;
      els.bodyMirrorContent.append(placeholder);
      syncBodyMirrorScroll();
      return;
    }

    let offset = 0;
    value.split("\n").forEach((line, lineIndex) => {
      const lineEl = document.createElement("div");
      lineEl.className = "mirror-line";
      lineEl.dataset.lineIndex = String(lineIndex);
      const item = parseListLine(line);
      if (item && item.type === "checklist") {
        const indent = document.createElement("span");
        indent.className = "mirror-indent";
        indent.textContent = item.indent;
        lineEl.append(indent);

        const slot = document.createElement("span");
        slot.className = "checklist-slot";
        const markerText = line.slice(item.indent.length, item.prefixLength);
        slot.style.width = `${Math.max(13, measureTextWidth(markerText))}px`;
        slot.dataset.lineIndex = String(lineIndex);
        lineEl.append(slot);

        const task = document.createElement("span");
        task.className = item.checked ? "checklist-task checklist-task-done" : "checklist-task";
        task.textContent = item.content || "\u200b";
        lineEl.append(task);

        const checkbox = document.createElement("button");
        checkbox.type = "button";
        checkbox.className = `overlay-checklist-toggle${item.checked ? " checked" : ""}`;
        checkbox.dataset.checkboxIndex = String(offset + item.checkboxIndex);
        checkbox.dataset.checkboxLineIndex = String(lineIndex);
        checkbox.dataset.checkboxKind = item.checkboxKind;
        checkbox.dataset.checked = String(item.checked);
        checkbox.setAttribute("role", "checkbox");
        checkbox.setAttribute("aria-checked", String(item.checked));
        checkbox.setAttribute("aria-label", `${item.checked ? "Mark incomplete" : "Mark complete"}: ${item.content || "empty task"}`);
        checkbox.title = item.checked ? "Mark incomplete" : "Mark complete";
        checkbox.innerHTML = item.checked
          ? '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3.2 8.1 3.1 3.1 6.5-6.7"></path></svg>'
          : '<span aria-hidden="true"></span>';
        els.checklistLayer.append(checkbox);
      } else {
        lineEl.textContent = line || "\u200b";
      }
      els.bodyMirrorContent.append(lineEl);
      offset += line.length + 1;
    });

    syncBodyMirrorScroll();
    requestAnimationFrame(positionChecklistButtons);
  }

  function syncBodyMirrorScroll() {
    if (!els.bodyMirrorContent) return;
    // Keep the viewport/mask fixed and move only the inner text. Transforming
    // the overflow-hidden viewport itself clips the lower part of long notes.
    els.bodyMirrorContent.style.transform = `translateY(${-els.body.scrollTop}px)`;
    requestAnimationFrame(positionChecklistButtons);
  }

  function positionChecklistButtons() {
    if (!els.bodyWrap || !els.bodyMirrorContent || !els.checklistLayer) return;
    const wrapRect = els.bodyWrap.getBoundingClientRect();
    const slots = Array.from(els.bodyMirrorContent.querySelectorAll(".checklist-slot"));
    const slotByLine = new Map(slots.map((slot) => [Number(slot.dataset.lineIndex), slot]));
    const buttons = els.checklistLayer.querySelectorAll(".overlay-checklist-toggle");
    buttons.forEach((button) => {
      const lineIndex = Number(button.dataset.checkboxLineIndex);
      const slot = slotByLine.get(lineIndex);
      if (!slot) return;
      const rect = slot.getBoundingClientRect();
      const size = 13;
      button.style.left = `${rect.left - wrapRect.left}px`;
      button.style.top = `${rect.top - wrapRect.top + (rect.height - size) / 2}px`;
    });
  }

  function toggleChecklistItem(button) {
    const index = Number(button.dataset.checkboxIndex);
    const kind = button.dataset.checkboxKind;
    const value = els.body.value;
    if (!Number.isInteger(index) || index < 0 || index >= value.length) return;
    const current = value[index];
    let replacement;
    if (kind === "markdown") replacement = /x/i.test(current) ? " " : "x";
    else replacement = current === "☐" ? "☑" : "☐";
    const caretStart = els.body.selectionStart;
    const caretEnd = els.body.selectionEnd;
    const scrollTop = els.body.scrollTop;
    els.body.value = value.slice(0, index) + replacement + value.slice(index + 1);
    els.body.setSelectionRange(Math.min(caretStart, els.body.value.length), Math.min(caretEnd, els.body.value.length));
    suppressToolbarAutohide = true;
    try {
      els.body.dispatchEvent(new Event("input", { bubbles: true }));
    } finally {
      suppressToolbarAutohide = false;
    }
    els.body.focus({ preventScroll: true });
    els.body.scrollTop = scrollTop;
    syncBodyMirrorScroll();
  }

  function lineBlockRange(text, selectionStart, selectionEnd) {
    const start = text.lastIndexOf("\n", selectionStart - 1) + 1;
    let endProbe = selectionEnd;
    if (selectionEnd > selectionStart && text[selectionEnd - 1] === "\n") endProbe = selectionEnd - 1;
    const newline = text.indexOf("\n", endProbe);
    const end = newline === -1 ? text.length : newline;
    return { start, end };
  }

  function replaceBodyRange(from, to, replacement, caretStart, caretEnd = caretStart) {
    const value = els.body.value;
    els.body.value = value.slice(0, from) + replacement + value.slice(to);
    const safeStart = Math.max(0, Math.min(els.body.value.length, caretStart));
    const safeEnd = Math.max(safeStart, Math.min(els.body.value.length, caretEnd));
    els.body.setSelectionRange(safeStart, safeEnd);
    els.body.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function continueListOnEnter(event) {
    if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return false;
    const textarea = els.body;
    const cursor = textarea.selectionStart;
    if (cursor !== textarea.selectionEnd) return false;

    const value = textarea.value;
    const lineStart = value.lastIndexOf("\n", cursor - 1) + 1;
    const newline = value.indexOf("\n", cursor);
    const lineEnd = newline === -1 ? value.length : newline;
    const line = value.slice(lineStart, lineEnd);
    const item = parseListLine(line);
    if (!item) return false;

    event.preventDefault();
    // Enter on an empty list item exits the list instead of creating endless
    // empty bullets. Keep the indentation level so nested lists remain tidy.
    if (!item.content.trim()) {
      replaceBodyRange(lineStart, lineEnd, item.indent, lineStart + item.indent.length);
      return true;
    }

    let nextPrefix;
    if (item.type === "ordered") {
      nextPrefix = `${item.indent}${item.number + 1}${item.marker} `;
    } else if (item.type === "alpha-ordered") {
      nextPrefix = `${item.indent}${nextAlphabeticLabel(item.alpha)}${item.marker} `;
    } else if (item.type === "checklist") {
      nextPrefix = item.checkboxKind === "unicode" ? `${item.indent}☐ ` : `${item.indent}${item.marker} [ ] `;
    } else {
      nextPrefix = `${item.indent}${item.marker} `;
    }
    const insertion = `\n${nextPrefix}`;
    replaceBodyRange(cursor, cursor, insertion, cursor + insertion.length);
    return true;
  }

  function applyListStyle(type) {
    if (!currentNote()) return;
    const textarea = els.body;
    const original = textarea.value;
    const selectionStart = textarea.selectionStart;
    const selectionEnd = textarea.selectionEnd;
    const { start, end } = lineBlockRange(original, selectionStart, selectionEnd);
    const block = original.slice(start, end);
    const lines = block.split("\n");
    const lineStyle = (item) => item?.type === "alpha-ordered" ? "alpha" : item?.type;
    const allSameStyle = lines.length > 0 && lines.every((line) => {
      const item = parseListLine(line);
      return item && lineStyle(item) === type;
    });

    const transformed = lines.map((line, index) => {
      const item = parseListLine(line);
      const unwrapped = item ? `${item.indent}${item.content}` : line;
      if (allSameStyle) return unwrapped;
      const indent = (unwrapped.match(/^[ \t]*/) || [""])[0];
      const content = unwrapped.slice(indent.length);
      if (type === "ordered") return `${indent}${index + 1}. ${content}`;
      if (type === "alpha") return `${indent}${alphabeticLabelFromNumber(index + 1)}. ${content}`;
      if (type === "checklist") return `${indent}- [ ] ${content}`;
      return `${indent}- ${content}`;
    }).join("\n");

    const before = original.slice(0, start);
    const after = original.slice(end);
    textarea.value = before + transformed + after;
    if (selectionStart !== selectionEnd) {
      textarea.setSelectionRange(start, start + transformed.length);
    } else {
      const firstOldLine = lines[0] || "";
      const firstNewLine = transformed.split("\n")[0] || "";
      const oldItem = parseListLine(firstOldLine);
      const newItem = parseListLine(firstNewLine);
      const oldContentStart = oldItem ? oldItem.prefixLength : (firstOldLine.match(/^[ \t]*/) || [""])[0].length;
      const newContentStart = newItem ? newItem.prefixLength : (firstNewLine.match(/^[ \t]*/) || [""])[0].length;
      const contentColumn = Math.max(0, selectionStart - start - oldContentStart);
      const newCaret = start + newContentStart + Math.min(contentColumn, Math.max(0, firstNewLine.length - newContentStart));
      textarea.setSelectionRange(newCaret, newCaret);
    }
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.focus();
  }

  function changeIndent(direction) {
    if (!currentNote()) return;
    const textarea = els.body;
    const original = textarea.value;
    const selectionStart = textarea.selectionStart;
    const selectionEnd = textarea.selectionEnd;
    const { start, end } = lineBlockRange(original, selectionStart, selectionEnd);
    const block = original.slice(start, end);
    const lines = block.split("\n");
    const removed = [];
    const transformed = lines.map((line) => {
      if (direction === "indent") {
        removed.push(-2);
        return `  ${line}`;
      }
      const match = line.match(/^(\t| {1,2})/);
      const prefix = match ? match[0] : "";
      removed.push(prefix.length);
      return line.slice(prefix.length);
    }).join("\n");

    textarea.value = original.slice(0, start) + transformed + original.slice(end);
    if (selectionStart !== selectionEnd) {
      // Keep the selected block selected after adjusting its indentation.
      textarea.setSelectionRange(start, start + transformed.length);
    } else {
      const lineIndex = (block.slice(0, selectionStart - start).match(/\n/g) || []).length;
      const oldLineStart = lineIndex === 0 ? 0 : block.lastIndexOf("\n", selectionStart - start - 1) + 1;
      const removedBeforeCaret = Math.max(0, selectionStart - start - oldLineStart);
      let newCaret;
      if (direction === "indent") newCaret = selectionStart + 2;
      else newCaret = selectionStart - Math.min(removed[lineIndex] || 0, removedBeforeCaret);
      textarea.setSelectionRange(newCaret, newCaret);
    }
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.focus();
  }

  const PAIRS = { "(": ")", "[": "]", "{": "}", "\"": "\"", "'": "'", "`": "`" };

  function handleEditorKeydown(event) {
    const textarea = els.body;
    const value = textarea.value;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    // Keyboard layouts and IME/browser event sequences can report an odd
    // `key` during Space/Tab. Handle those physical keys before bracket logic
    // so they can never be mistaken for a typed closing bracket.
    if (event.isComposing || event.key === "Process" || event.key === "Unidentified") return;
    if (event.code === "Space" || event.key === " " || event.key === "Spacebar") return;
    if (event.key === "Enter" && continueListOnEnter(event)) return;

    if (event.key === "Tab" || event.code === "Tab") {
      event.preventDefault();
      changeIndent(event.shiftKey ? "outdent" : "indent");
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "c") {
      event.preventDefault();
      applyListStyle("checklist");
      return;
    }

    if (event.key === "Backspace" && start === end && start > 0 && start < value.length) {
      const before = value[start - 1];
      const after = value[start];
      if (PAIRS[before] === after) {
        event.preventDefault();
        replaceBodyRange(start - 1, start + 1, "", start - 1);
        return;
      }
    }

    // Skip over an automatically inserted closing character instead of doubling it.
    if (start === end && Object.values(PAIRS).includes(event.key) && value[start] === event.key) {
      event.preventDefault();
      textarea.setSelectionRange(start + 1, start + 1);
      return;
    }

    if (event.ctrlKey || event.metaKey || event.altKey || !Object.hasOwn(PAIRS, event.key)) return;
    // A single quote after a word is probably an apostrophe, not an opening quote.
    if (event.key === "'" && start === end && start > 0 && /[\p{L}\p{N}]$/u.test(value.slice(0, start))) return;

    event.preventDefault();
    const selected = value.slice(start, end);
    const close = PAIRS[event.key];
    const insertion = event.key + selected + close;
    replaceBodyRange(start, end, insertion,
      selected ? start + 1 : start + 1,
      selected ? start + 1 + selected.length : start + 1);
  }

  function showWritingTips() {
    showToast("Enter continues 1. / a. / a) / bullet lists · click checkboxes to complete tasks · Tab indents · brackets auto-close");
  }

  function updatePageLinkButton(note) {
    const label = els.insertPage.querySelector("span");
    const pageUrl = note ? noteLinkedUrl(note) : "";
    const linked = Boolean(pageUrl);
    if (label) label.textContent = linked ? "Unlink page" : "Link page";
    // The association is metadata, not note text. A native hover tooltip exposes
    // the exact linked address without making the editor visually busier.
    els.insertPage.title = linked
      ? `Linked page: ${pageUrl}\nClick to unlink this page`
      : "Link this note to the current webpage";
    els.insertPage.dataset.linked = String(linked);
    if (linked) els.insertPage.dataset.linkedUrl = pageUrl;
    else delete els.insertPage.dataset.linkedUrl;
    els.insertPage.setAttribute("aria-label", linked ? `Unlink page: ${pageUrl}` : "Link note to current page");
  }

  function normalizePageUrl(rawUrl) {
    try {
      const url = new URL(String(rawUrl || ""));
      if (url.protocol !== "http:" && url.protocol !== "https:") return "";
      url.hash = "";
      return url.href;
    } catch (_) {
      return "";
    }
  }

  // Older SideNote versions appended `↗ page title\nURL` to the note body.
  // Treat that exact trailing block as legacy link metadata and migrate it out
  // of the user's writing. Requiring the block to be at the very end avoids
  // stripping links mentioned naturally in the middle of a note.
  function findLegacyPageLinkBlock(rawBody, expectedUrl = "") {
    const body = safeText(rawBody);
    const expected = normalizePageUrl(expectedUrl);
    // Search the whole note, not just its final lines: users may have continued
    // writing after an older version appended the page title and URL.
    const pattern = /(^|(?:\r?\n){2})↗[ \t]*([^\r\n]+)(?:\r?\n)[ \t]*(https?:\/\/[^\s]+)[ \t]*(?=\r?\n|$)/gi;
    let match;
    let fallback = null;
    while ((match = pattern.exec(body))) {
      const url = normalizePageUrl(match[3]);
      if (!url) continue;
      const block = {
        title: safeText(match[2]).trim(),
        url,
        start: match.index,
        end: match.index + match[0].length,
        body: body.slice(0, match.index),
        original: match[0]
      };
      if (expected && url === expected) return block;
      fallback = block;
    }
    return expected ? null : fallback;
  }

  function removeLegacyPageLinkBlock(rawBody, expectedUrl = "", allowAnyUrl = false) {
    const body = safeText(rawBody);
    const expected = normalizePageUrl(expectedUrl);
    const block = findLegacyPageLinkBlock(body, expected);
    if (!block) {
      if (!allowAnyUrl) return { body, removed: false, block: null };
      const anyBlock = findLegacyPageLinkBlock(body);
      if (!anyBlock) return { body, removed: false, block: null };
      return removeLegacyPageLinkBlock(body, anyBlock.url, false);
    }
    if (!expected && !allowAnyUrl) return { body, removed: false, block };
    const before = body.slice(0, block.start);
    const after = body.slice(block.end);
    let cleaned = before + after;
    // If the removed block was at the beginning/end, avoid leaving empty lines;
    // between paragraphs, preserve the existing whitespace around the content.
    if (!before.trim()) cleaned = cleaned.replace(/^(?:[ \t]*\r?\n)+/, "");
    if (!after.trim()) cleaned = cleaned.replace(/(?:\r?\n)+[ \t]*$/, "");
    return { body: cleaned, removed: true, block };
  }

  async function getActiveTab() {
    // The `tabs` permission is required for consistent access to tab URL/title,
    // especially when the panel was opened through a keyboard command.
    let tabs = [];
    try {
      tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    } catch (_) {}
    if (!tabs?.length) {
      try { tabs = await chrome.tabs.query({ active: true, currentWindow: true }); } catch (_) {}
    }
    return tabs?.[0] || null;
  }

  async function insertCurrentPage() {
    const note = currentNote();
    if (!note) {
      showToast("Open a note first");
      return;
    }
    try {
      const tab = await getActiveTab();
      const pageUrl = normalizePageUrl(tab?.url);
      if (!tab || !pageUrl) {
        showToast(window.SIDENOTE_ANDROID ? "Share a webpage to SideNote first, then link it" : "Open a regular webpage to link it");
        return;
      }

      const pageTitle = safeText(tab.title).trim() || pageUrl;
      // Clean any legacy appended page block before replacing the association.
      // New links are stored only in note metadata, never inserted into body text.
      const oldLinkedUrl = noteLinkedUrl(note);
      let cleaned = removeLegacyPageLinkBlock(note.body, oldLinkedUrl, Boolean(oldLinkedUrl));
      if (!cleaned.removed) cleaned = removeLegacyPageLinkBlock(note.body, "", true);
      if (cleaned.removed) {
        note.body = cleaned.body;
        els.body.value = note.body;
        renderBodyMirror();
      }
      note.linkedUrl = pageUrl;
      note.linkedTitle = pageTitle;
      note.linkDisabled = false;
      note.updatedAt = Date.now();
      renderList();
      els.editorInfo.title = metadataText(note);
      updatePageLinkButton(note);
      scheduleSave();
      showToast("Page linked — saved underneath your note");
    } catch (error) {
      console.error("SideNote: could not link current page", error);
      showToast("Couldn't link this page. Check Chrome permissions.");
    }
  }

  function noteLinkedUrl(note) {
    if (note?.linkDisabled) return "";
    const storedUrl = normalizePageUrl(note?.linkedUrl);
    if (storedUrl) return storedUrl;
    // Compatibility fallback for a note not yet passed through load-time migration.
    return findLegacyPageLinkBlock(note?.body)?.url || "";
  }

  function linkedNoteForUrl(rawUrl) {
    const pageUrl = normalizePageUrl(rawUrl);
    if (!pageUrl) return null;
    const candidates = notes.filter((note) => noteLinkedUrl(note) === pageUrl);
    candidates.sort((a, b) => {
      if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
      return (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0);
    });
    return candidates[0] || null;
  }

  function activatePageLinkedNote(rawUrl, { clearMismatchedLink = false } = {}) {
    if (!settings.autoOpenLinked) return;
    const match = linkedNoteForUrl(rawUrl);
    let nextId = match?.id || null;
    if (!match) {
      // A linked note should not linger when its tab navigates elsewhere, but a
      // manually selected, unlinked note stays open while the user browses.
      if (!clearMismatchedLink || !noteLinkedUrl(currentNote() || {})) return;
      nextId = null;
    }
    if (nextId === activeId) return;
    flushSave();
    activeId = nextId;
    renderList();
    renderEditor();
  }

  async function syncWithActivePage() {
    try {
      const tab = await getActiveTab();
      // On panel reopen, select a matching page note or close a stale page-linked
      // note from a different tab. A manually selected, unlinked note is preserved.
      activatePageLinkedNote(tab?.url || "", { clearMismatchedLink: true });
    } catch (error) {
      console.warn("SideNote: could not match notes to active page", error);
    }
  }

  async function syncWithTabId(tabId) {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab?.active) activatePageLinkedNote(tab.url || "", { clearMismatchedLink: true });
    } catch (_) {}
  }

  function togglePin() {
    const note = currentNote();
    if (!note) return;
    note.pinned = !note.pinned;
    note.updatedAt = Date.now();
    renderList();
    renderEditor();
    scheduleSave();
    showToast(note.pinned ? "Note pinned to the top" : "Note unpinned");
  }

  async function loadNotes() {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      const stored = result[STORAGE_KEY];
      const rawNotes = Array.isArray(stored) ? stored.filter((note) => note && typeof note.id === "string") : [];
      let needsMigration = false;
      notes = rawNotes.map((note) => {
        // Keep note objects resilient if an earlier version stored fewer fields.
        const hasStyle = Number.isInteger(note.tint) && note.tint >= 0 && note.tint <= 6 &&
          Number.isInteger(note.texture) && note.texture >= 0 && note.texture <= 4;
        if (!hasStyle) needsMigration = true;
        let hash = 0;
        for (const char of note.id) hash = ((hash * 31) + char.charCodeAt(0)) | 0;
        const tint = Number.isInteger(note.tint) && note.tint >= 0 && note.tint <= 6
          ? note.tint : Math.abs(hash) % 7;
        const texture = Number.isInteger(note.texture) && note.texture >= 0 && note.texture <= 4
          ? note.texture : Math.abs(hash >> 3) % 5;
        const originalBody = safeText(note.body);
        let body = originalBody;
        const linkDisabled = Boolean(note.linkDisabled);
        const storedUrl = linkDisabled ? "" : normalizePageUrl(note.linkedUrl);
        const legacyBlock = findLegacyPageLinkBlock(originalBody, storedUrl);
        let linkedUrl = storedUrl;
        let linkedTitle = linkDisabled ? "" : safeText(note.linkedTitle);

        if (legacyBlock) {
          // Explicitly unlinked old notes may still contain the block appended by
          // pre-v2.5 builds. Remove that UI artifact even though linkDisabled is set.
          if (linkDisabled) {
            body = legacyBlock.body;
          } else if (!storedUrl || storedUrl === legacyBlock.url) {
            linkedUrl = storedUrl || legacyBlock.url;
            linkedTitle = linkedTitle || legacyBlock.title;
            body = legacyBlock.body;
          }
        }
        if (body !== originalBody) needsMigration = true;
        if (linkedUrl && !note.linkedUrl) needsMigration = true;
        return {
          id: note.id,
          title: safeText(note.title),
          body,
          pinned: Boolean(note.pinned),
          tint,
          texture,
          linkedUrl,
          linkedTitle,
          linkDisabled,
          createdAt: Number(note.createdAt) || Date.now(),
          updatedAt: body !== originalBody
            ? Date.now()
            : (Number(note.updatedAt) || Number(note.createdAt) || Date.now())
        };
      });
      if (needsMigration) await chrome.storage.local.set({ [STORAGE_KEY]: notes });
      sortNotes();
      // Do not arbitrarily open the first note. Select one only when the active
      // webpage has a saved association; otherwise leave the editor closed.
      const tab = await getActiveTab();
      const linkedNote = settings.autoOpenLinked ? linkedNoteForUrl(tab?.url || "") : null;
      activeId = linkedNote?.id || null;
      renderList();
      renderEditor();
      setSaveState("saved", "All changes saved");
    } catch (error) {
      console.error("SideNote: load failed", error);
      setSaveState("error", "Could not load notes");
      showToast("Could not load your saved notes");
    }
  }

  function openSearch() {
    closeAccountPopover({ restoreFocus: false });
    els.topbar.classList.add("search-open");
    els.searchToggle.setAttribute("aria-expanded", "true");
    requestAnimationFrame(() => {
      els.search.focus();
      els.search.select();
    });
  }

  function closeSearch({ clear = true } = {}) {
    els.topbar.classList.remove("search-open");
    els.searchToggle.setAttribute("aria-expanded", "false");
    if (clear) {
      els.search.value = "";
      renderList();
    }
    els.searchToggle.focus();
  }

  function openAccountPopover() {
    if (!els.accountPopover.classList.contains("hidden")) {
      closeAccountPopover();
      return;
    }
    if (!els.settingsBackdrop.classList.contains("hidden")) closeSettings({ restoreFocus: false });
    els.accountPopover.classList.remove("hidden");
    els.accountButton.setAttribute("aria-expanded", "true");
    requestAnimationFrame(() => {
      if (!firebaseSession?.uid) els.firebaseEmail.focus();
      else els.accountPopoverClose.focus();
    });
  }

  function closeAccountPopover({ restoreFocus = true } = {}) {
    els.accountPopover.classList.add("hidden");
    els.accountButton.setAttribute("aria-expanded", "false");
    if (restoreFocus) els.accountButton.focus();
  }

  function openSettings() {
    closeAccountPopover({ restoreFocus: false });
    els.settingsBackdrop.classList.remove("hidden");
    els.settingsButton.setAttribute("aria-expanded", "true");
    requestAnimationFrame(() => els.settingsPanel.focus());
  }

  function closeSettings({ restoreFocus = true } = {}) {
    els.settingsBackdrop.classList.add("hidden");
    els.settingsButton.setAttribute("aria-expanded", "false");
    if (restoreFocus) els.settingsButton.focus();
  }

  async function openShortcutSettings() {
    closeSettings({ restoreFocus: false });
    try {
      await chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
    } catch (error) {
      console.error("SideNote: could not open shortcut settings", error);
      showToast("Open chrome://extensions/shortcuts to change the hotkey");
    }
  }

  function applySettingsToUI() {
    document.documentElement.dataset.theme = settings.theme;
    if (window.SIDENOTE_ANDROID && window.SideNoteAndroid?.setSystemTheme) {
      window.SideNoteAndroid.setSystemTheme(settings.theme);
    }
    document.documentElement.dataset.editorFontSize = settings.editorFontSize;
    document.documentElement.dataset.noteDensity = settings.compactCards ? "compact" : "comfortable";
    els.themeSelect.value = settings.theme;
    els.editorFontSizeSelect.value = settings.editorFontSize;
    els.autoOpenLinkedToggle.checked = settings.autoOpenLinked;
    els.confirmDeleteToggle.checked = settings.confirmDelete;
    els.confirmUnlinkToggle.checked = settings.confirmUnlink;
    els.autoHideToolbarToggle.checked = settings.autoHideToolbar;
    els.compactCardsToggle.checked = settings.compactCards;
    els.focusNewNoteToggle.checked = settings.focusNewNote;
    els.sortSelect.value = settings.sortMode;
  }

  async function saveSettings() {
    try {
      cloudState.settingsUpdatedAt = Date.now();
      firebaseLocalDirty = true;
      firebaseLocalRevision += 1;
      if (firebaseSession?.uid && !firebaseSyncPrefs.autoSync) renderFirebaseUI();
      await chrome.storage.local.set({ [SETTINGS_KEY]: { ...settings }, [CLOUD_META_KEY]: { ...cloudState } });
      scheduleFirebaseSync();
    } catch (error) {
      console.error("SideNote: settings could not be saved", error);
      showToast("Could not save settings");
    }
  }

  async function loadSettings() {
    try {
      const result = await chrome.storage.local.get(SETTINGS_KEY);
      const stored = result[SETTINGS_KEY] && typeof result[SETTINGS_KEY] === "object" ? result[SETTINGS_KEY] : {};
      settings = normalizeSettingsData(stored);
    } catch (error) {
      console.warn("SideNote: could not load settings", error);
      settings = { ...DEFAULT_SETTINGS };
    }
    applySettingsToUI();
  }

  // Google Drive backup/sync. Notes stay local-first; cloud writes are debounced
  // and use Drive's private appDataFolder with the narrow drive.appdata scope.
  function oauthClientConfigured() {
    const clientId = chrome.runtime?.getManifest?.()?.oauth2?.client_id || "";
    return Boolean(clientId && !clientId.includes("YOUR_GOOGLE_OAUTH_CLIENT_ID") && clientId.endsWith(".apps.googleusercontent.com"));
  }

  function cloudErrorMessage(error) {
    const message = safeText(error?.message || error || "Unknown error");
    if (message.includes("Google Drive OAuth is not configured")) return "Google sign-in needs a one-time OAuth client setup. See README.md.";
    if (/invalid_client|OAuth2 request failed|bad client/i.test(message)) return "Google sign-in could not validate the OAuth client ID. Check manifest.json and the extension ID.";
    if (/401|invalid credentials|token/i.test(message)) return "Google sign-in expired. Click Connect Google again.";
    if (/403|accessNotConfigured|has not been used|Drive API/i.test(message)) return "Enable the Google Drive API for your Cloud project, then reconnect.";
    return message.length > 145 ? `${message.slice(0, 142)}…` : message;
  }

  function formatSyncedTime(timestamp) {
    if (!Number.isFinite(Number(timestamp)) || Number(timestamp) <= 0) return "";
    try { return new Date(Number(timestamp)).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }); }
    catch (_) { return new Date(Number(timestamp)).toLocaleString(); }
  }

  function renderCloudUI() {
    if (!els.cloudStatusTitle) return;
    const configured = oauthClientConfigured();
    const connected = Boolean(cloudState.connected);
    els.cloudStatusDot.classList.toggle("connected", connected && !cloudState.lastError);
    els.cloudStatusDot.classList.toggle("error", Boolean(cloudState.lastError));
    els.cloudStatusTitle.textContent = cloudState.lastError ? "Sync needs attention" : connected ? "Google Drive connected" : "Not connected";
    if (cloudState.lastError) {
      els.cloudStatusDetail.textContent = cloudState.lastError;
    } else if (connected && cloudState.lastSyncedAt) {
      els.cloudStatusDetail.textContent = `Last synced ${formatSyncedTime(cloudState.lastSyncedAt)}`;
    } else if (connected) {
      els.cloudStatusDetail.textContent = cloudState.autoSync ? "Ready to back up and sync your notes." : "Connected. Automatic sync is off.";
    } else if (!configured) {
      els.cloudStatusDetail.textContent = "One-time OAuth setup is required before connecting. See README.md.";
    } else {
      els.cloudStatusDetail.textContent = "Connect to back up and sync notes with this Google account.";
    }
    els.connectGoogleButton.classList.toggle("hidden", connected && !cloudState.lastError);
    els.backupNowButton.classList.toggle("hidden", !connected);
    els.restoreBackupButton.classList.toggle("hidden", !connected);
    els.disconnectGoogleButton.classList.toggle("hidden", !connected);
    els.autoSyncToggle.checked = Boolean(cloudState.autoSync);
    els.autoSyncToggle.disabled = !connected;
  }

  async function persistCloudState() {
    try { await chrome.storage.local.set({ [CLOUD_META_KEY]: { ...cloudState } }); }
    catch (error) { console.warn("SideNote: could not persist cloud state", error); }
    renderCloudUI();
  }

  async function loadCloudState() {
    try {
      const stored = await chrome.storage.local.get([CLOUD_META_KEY, SETTINGS_KEY, LAYOUT_KEY]);
      const old = stored[CLOUD_META_KEY] && typeof stored[CLOUD_META_KEY] === "object" ? stored[CLOUD_META_KEY] : {};
      cloudState = {
        connected: old.connected === true,
        autoSync: old.autoSync === true,
        fileId: safeText(old.fileId),
        lastSyncedAt: Number(old.lastSyncedAt) || 0,
        lastError: safeText(old.lastError),
        deviceId: safeText(old.deviceId) || makeId(),
        deletedNotes: old.deletedNotes && typeof old.deletedNotes === "object" ? old.deletedNotes : {},
        settingsUpdatedAt: Number.isFinite(Number(old.settingsUpdatedAt)) ? Number(old.settingsUpdatedAt) : (stored[SETTINGS_KEY] ? Date.now() : 0),
        layoutUpdatedAt: Number.isFinite(Number(old.layoutUpdatedAt)) ? Number(old.layoutUpdatedAt) : (stored[LAYOUT_KEY] ? Date.now() : 0)
      };
      await persistCloudState();
    } catch (error) {
      console.warn("SideNote: could not load cloud state", error);
      renderCloudUI();
    }
  }

  async function googleAccessToken(interactive = false) {
    if (!oauthClientConfigured()) {
      throw new Error("Google Drive OAuth is not configured. Replace oauth2.client_id in manifest.json with a Google OAuth client ID made for this extension ID. See README.md.");
    }
    if (!chrome.identity?.getAuthToken) throw new Error("Chrome identity API is unavailable. Reload SideNote in Chrome.");
    const result = await chrome.identity.getAuthToken({ interactive });
    const token = typeof result === "string" ? result : result?.token;
    if (!token) throw new Error("Google sign-in did not return an access token. Click Connect Google to authorize again.");
    return token;
  }

  async function driveRequest(url, token, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) }
    });
    if (response.status === 401) {
      try { await chrome.identity.removeCachedAuthToken({ token }); } catch (_) {}
      throw new Error("Google sign-in token expired (401). Reconnect and try again.");
    }
    if (!response.ok) {
      let detail = "";
      try { detail = (await response.json())?.error?.message || ""; } catch (_) {}
      throw new Error(`Google Drive request failed (${response.status})${detail ? `: ${detail}` : ""}`);
    }
    return response;
  }

  async function findRemoteBackup(token) {
    const params = new URLSearchParams({
      spaces: "appDataFolder",
      q: `name = '${DRIVE_BACKUP_NAME}' and trashed = false`,
      pageSize: "10",
      fields: "files(id,name,modifiedTime)"
    });
    const response = await driveRequest(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, token);
    const data = await response.json();
    const files = Array.isArray(data.files) ? data.files : [];
    if (!files.length) return null;
    files.sort((a, b) => String(b.modifiedTime || "").localeCompare(String(a.modifiedTime || "")));
    return files[0];
  }

  async function readRemoteBackup(token, fileId) {
    const response = await driveRequest(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, token);
    const payload = await response.json();
    if (!payload || payload.schemaVersion !== 1 || !Array.isArray(payload.notes)) {
      throw new Error("The Google Drive backup is not a valid SideNote backup.");
    }
    return payload;
  }

  async function writeRemoteBackup(token, fileId, payload) {
    let targetId = fileId;
    if (!targetId) {
      const createResponse = await driveRequest("https://www.googleapis.com/drive/v3/files?fields=id,name", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: DRIVE_BACKUP_NAME, mimeType: "application/json", parents: ["appDataFolder"] })
      });
      const created = await createResponse.json();
      targetId = created.id;
      if (!targetId) throw new Error("Google Drive created a backup entry without returning its ID.");
    }
    await driveRequest(`https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(targetId)}?uploadType=media`, token, {
      method: "PATCH",
      headers: { "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify(payload)
    });
    return targetId;
  }

  async function makeLocalBackupPayload() {
    const stored = await chrome.storage.local.get([LAYOUT_KEY]);
    const height = stored[LAYOUT_KEY]?.notesHeight;
    return {
      schemaVersion: 1,
      app: "SideNote",
      updatedAt: Date.now(),
      deviceId: cloudState.deviceId || (cloudState.deviceId = makeId()),
      notes: notes.map((note) => ({ ...note })),
      settings: { ...settings },
      layout: { notesHeight: Number.isFinite(height) ? height : Math.round(currentNotesHeight()) },
      deletedNotes: { ...(cloudState.deletedNotes || {}) },
      settingsUpdatedAt: Number(cloudState.settingsUpdatedAt) || 0,
      layoutUpdatedAt: Number(cloudState.layoutUpdatedAt) || 0
    };
  }

  function normalizedBackupNotes(list) {
    return list.filter((note) => note && typeof note.id === "string").map((note) => ({
      id: note.id,
      title: safeText(note.title),
      body: safeText(note.body),
      pinned: Boolean(note.pinned),
      tint: Number.isInteger(note.tint) && note.tint >= 0 && note.tint <= 6 ? note.tint : 0,
      texture: Number.isInteger(note.texture) && note.texture >= 0 && note.texture <= 4 ? note.texture : 0,
      linkedUrl: safeText(note.linkedUrl),
      linkedTitle: safeText(note.linkedTitle),
      linkDisabled: Boolean(note.linkDisabled),
      createdAt: Number(note.createdAt) || Date.now(),
      updatedAt: Number(note.updatedAt) || Number(note.createdAt) || Date.now()
    }));
  }

  function mergeBackupPayloads(local, remote) {
    const deletedNotes = { ...(remote.deletedNotes || {}) };
    for (const [id, time] of Object.entries(local.deletedNotes || {})) {
      deletedNotes[id] = Math.max(Number(deletedNotes[id]) || 0, Number(time) || 0);
    }
    const byId = new Map();
    for (const note of [...normalizedBackupNotes(remote.notes || []), ...normalizedBackupNotes(local.notes || [])]) {
      const old = byId.get(note.id);
      if (!old || Number(note.updatedAt) >= Number(old.updatedAt)) byId.set(note.id, note);
    }
    const mergedNotes = [];
    for (const [id, note] of byId) {
      const deletedAt = Number(deletedNotes[id]) || 0;
      if (deletedAt >= Number(note.updatedAt || 0)) continue;
      // If a note was recreated/edited after a prior deletion, clear the stale
      // tombstone so another device's clock skew cannot delete it again later.
      if (deletedAt > 0) delete deletedNotes[id];
      mergedNotes.push(note);
    }
    const localSettingsAt = Number(local.settingsUpdatedAt) || 0;
    const remoteSettingsAt = Number(remote.settingsUpdatedAt) || 0;
    const useLocalSettings = localSettingsAt >= remoteSettingsAt;
    const localLayoutAt = Number(local.layoutUpdatedAt) || 0;
    const remoteLayoutAt = Number(remote.layoutUpdatedAt) || 0;
    const useLocalLayout = localLayoutAt >= remoteLayoutAt;
    return {
      schemaVersion: 1, app: "SideNote", updatedAt: Date.now(), deviceId: cloudState.deviceId || local.deviceId || makeId(),
      notes: mergedNotes.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0)),
      settings: { ...(useLocalSettings ? local.settings : remote.settings) },
      layout: { ...(useLocalLayout ? local.layout : remote.layout) },
      deletedNotes,
      settingsUpdatedAt: Math.max(localSettingsAt, remoteSettingsAt),
      layoutUpdatedAt: Math.max(localLayoutAt, remoteLayoutAt)
    };
  }

  function normalizeSettingsData(data) {
    const normalized = { ...DEFAULT_SETTINGS, ...(data && typeof data === "object" ? data : {}) };
    if (!["light", "dark", "lavender", "mint", "peach"].includes(normalized.theme)) normalized.theme = "light";
    if (!["small", "standard", "large"].includes(normalized.editorFontSize)) normalized.editorFontSize = "standard";
    if (!["newest", "oldest", "title-asc", "title-desc", "words-desc", "words-asc"].includes(normalized.sortMode)) normalized.sortMode = "newest";
    normalized.autoOpenLinked = normalized.autoOpenLinked !== false;
    normalized.confirmDelete = normalized.confirmDelete !== false;
    normalized.confirmUnlink = normalized.confirmUnlink === true;
    normalized.autoHideToolbar = normalized.autoHideToolbar !== false;
    normalized.compactCards = normalized.compactCards === true;
    normalized.focusNewNote = normalized.focusNewNote !== false;
    if (!PROFILE_AVATARS.some((item) => item.id === normalized.profileAvatar)) normalized.profileAvatar = "initial";
    return normalized;
  }

  async function applyBackupPayload(payload, { preserveEditorFocus = false, expectedLocalRevision = null } = {}) {
    const safePayload = {
      notes: normalizedBackupNotes(Array.isArray(payload.notes) ? payload.notes : []),
      settings: normalizeSettingsData(payload.settings),
      layout: { notesHeight: Number.isFinite(payload.layout?.notesHeight) ? Math.round(payload.layout.notesHeight) : 168 },
      deletedNotes: payload.deletedNotes && typeof payload.deletedNotes === "object" ? payload.deletedNotes : {},
      settingsUpdatedAt: Number(payload.settingsUpdatedAt) || 0,
      layoutUpdatedAt: Number(payload.layoutUpdatedAt) || 0
    };
    const previousActiveId = activeId;
    const previousActive = currentNote();
    const nextActive = previousActiveId ? safePayload.notes.find((note) => note.id === previousActiveId) || null : null;
    const activeContentChanged = Boolean(previousActiveId && (
      !previousActive || !nextActive ||
      previousActive.title !== nextActive.title ||
      previousActive.body !== nextActive.body ||
      Boolean(previousActive.pinned) !== Boolean(nextActive.pinned) ||
      safeText(previousActive.linkedUrl) !== safeText(nextActive.linkedUrl) ||
      safeText(previousActive.linkedTitle) !== safeText(nextActive.linkedTitle) ||
      Boolean(previousActive.linkDisabled) !== Boolean(nextActive.linkDisabled)
    ));

    cloudState.deletedNotes = { ...safePayload.deletedNotes };
    cloudState.settingsUpdatedAt = safePayload.settingsUpdatedAt;
    cloudState.layoutUpdatedAt = safePayload.layoutUpdatedAt;
    applyingCloudData = true;
    try {
      await chrome.storage.local.set({
        [STORAGE_KEY]: safePayload.notes,
        [SETTINGS_KEY]: safePayload.settings,
        [LAYOUT_KEY]: safePayload.layout,
        [CLOUD_META_KEY]: { ...cloudState }
      });
      if (expectedLocalRevision !== null && firebaseLocalRevision !== expectedLocalRevision) {
        // The user typed while storage was being updated. Preserve that newer
        // local working copy and let the next sync merge it instead of replacing it.
        const latestNotes = notes.map((note) => ({ ...note }));
        const latestSettings = { ...settings };
        await chrome.storage.local.set({
          [STORAGE_KEY]: latestNotes,
          [SETTINGS_KEY]: latestSettings,
          [LAYOUT_KEY]: { notesHeight: clampNotesHeight(currentNotesHeight()) },
          [CLOUD_META_KEY]: { ...cloudState }
        });
        firebaseLocalDirty = true;
        firebaseSyncRequestedAgain = true;
        return false;
      }
      notes = safePayload.notes;
      settings = safePayload.settings;
      activeId = nextActive ? previousActiveId : null;
      applySettingsToUI();
      let requestedHeight = Number(safePayload.layout.notesHeight) || 168;
      // Desktop browser panels commonly save a short 168px list. Start Android
      // with a phone-sized list if that desktop default arrives on first sync.
      if (window.SIDENOTE_ANDROID && requestedHeight < 220) {
        requestedHeight = Math.min(380, Math.max(250, Math.round(window.innerHeight * 0.38)));
      }
      const safeHeight = clampNotesHeight(requestedHeight);
      els.appShell.style.setProperty("--notes-area-height", `${safeHeight}px`);
      els.splitter.setAttribute("aria-valuenow", String(safeHeight));
      renderList();
      if (activeContentChanged || (!previousActiveId && activeId)) {
        renderEditor({ preserveFocus: preserveEditorFocus });
      } else if (nextActive) {
        // Do not reset the textarea/caret on ordinary background syncs when
        // the currently edited note itself didn't change.
        els.editorInfo.title = metadataText(nextActive);
        updatePageLinkButton(nextActive);
        els.pin.classList.toggle("pinned", Boolean(nextActive.pinned));
        els.pin.setAttribute("aria-pressed", String(Boolean(nextActive.pinned)));
        els.pin.setAttribute("title", nextActive.pinned ? "Unpin note" : "Pin note");
      } else {
        renderEditor();
      }
    } finally {
      applyingCloudData = false;
    }
    return true;
  }

  async function syncWithGoogleDrive({ interactive = false, mode = "sync", showSuccess = false, token: suppliedToken = "" } = {}) {
    if (cloudSyncInProgress) {
      cloudSyncRequestedAgain = true;
      return;
    }
    cloudSyncInProgress = true;
    clearTimeout(cloudSyncTimer);
    cloudSyncTimer = null;
    try {
      // Flush editor content before constructing the current device snapshot.
      await saveNow();
      const token = suppliedToken || await googleAccessToken(interactive);
      const remoteFile = await findRemoteBackup(token);
      if (!remoteFile) {
        if (mode === "restore") throw new Error("No SideNote backup was found in this Google account yet.");
        const localPayload = await makeLocalBackupPayload();
        cloudState.fileId = await writeRemoteBackup(token, "", localPayload);
      } else if (mode === "restore") {
        if (!window.confirm("Restore the Google Drive backup? This replaces the notes and preferences on this device.")) return;
        const remotePayload = await readRemoteBackup(token, remoteFile.id);
        await applyBackupPayload(remotePayload);
        cloudState.fileId = remoteFile.id;
      } else {
        const localPayload = await makeLocalBackupPayload();
        const remotePayload = await readRemoteBackup(token, remoteFile.id);
        const mergedPayload = mergeBackupPayloads(localPayload, remotePayload);
        await applyBackupPayload(mergedPayload);
        cloudState.fileId = await writeRemoteBackup(token, remoteFile.id, await makeLocalBackupPayload());
      }
      cloudState.connected = true;
      cloudState.lastSyncedAt = Date.now();
      cloudState.lastError = "";
      await persistCloudState();
      if (showSuccess) showToast(mode === "restore" ? "Google Drive backup restored" : "Google Drive backup synced");
    } catch (error) {
      const message = cloudErrorMessage(error);
      cloudState.lastError = message;
      if (/OAuth is not configured/i.test(safeText(error?.message))) cloudState.connected = false;
      await persistCloudState();
      if (interactive || showSuccess) showToast(message);
      console.error("SideNote: Google Drive sync failed", error);
    } finally {
      cloudSyncInProgress = false;
      if (cloudSyncRequestedAgain) {
        cloudSyncRequestedAgain = false;
        scheduleCloudSync(400);
      }
    }
  }

  function scheduleCloudSync(delay = 1400) {
    if (applyingCloudData || !cloudState.connected || !cloudState.autoSync) return;
    if (cloudSyncInProgress) { cloudSyncRequestedAgain = true; return; }
    clearTimeout(cloudSyncTimer);
    cloudSyncTimer = setTimeout(() => {
      void syncWithGoogleDrive({ interactive: false, mode: "sync", showSuccess: false });
    }, delay);
  }

  async function connectGoogleDrive() {
    cloudState.lastError = "";
    renderCloudUI();
    try {
      const token = await googleAccessToken(true);
      cloudState.connected = true;
      cloudState.autoSync = true;
      cloudState.lastError = "";
      await persistCloudState();
      await syncWithGoogleDrive({ interactive: false, mode: "sync", showSuccess: true, token });
    } catch (error) {
      cloudState.lastError = cloudErrorMessage(error);
      cloudState.connected = false;
      await persistCloudState();
      showToast(cloudState.lastError);
      console.error("SideNote: Google Drive connection failed", error);
    }
  }

  async function disconnectGoogleDrive() {
    if (!window.confirm("Disconnect Google Drive? Your remote backup will remain in your Google account, but SideNote will stop syncing on this device.")) return;
    clearTimeout(cloudSyncTimer);
    cloudState.connected = false;
    cloudState.autoSync = false;
    cloudState.lastError = "";
    cloudState.fileId = "";
    try { await chrome.identity.clearAllCachedAuthTokens(); } catch (error) { console.warn("SideNote: token cache could not be cleared", error); }
    await persistCloudState();
    showToast("Google Drive disconnected. Your remote backup was kept.");
  }

  els.connectGoogleButton.addEventListener("click", () => { void connectGoogleDrive(); });
  els.backupNowButton.addEventListener("click", () => { void syncWithGoogleDrive({ interactive: true, mode: "sync", showSuccess: true }); });
  els.restoreBackupButton.addEventListener("click", () => { void syncWithGoogleDrive({ interactive: true, mode: "restore", showSuccess: true }); });
  els.disconnectGoogleButton.addEventListener("click", () => { void disconnectGoogleDrive(); });
  els.autoSyncToggle.addEventListener("change", () => {
    cloudState.autoSync = els.autoSyncToggle.checked;
    cloudState.lastError = "";
    void persistCloudState().then(() => {
      if (cloudState.autoSync) {
        scheduleCloudSync(150);
        showToast("Automatic Google Drive sync enabled");
      } else {
        clearTimeout(cloudSyncTimer);
        cloudSyncTimer = null;
        showToast("Automatic sync paused");
      }
    });
  });

  // Firebase account + Firestore sync. Local chrome.storage is always the editor's
  // source of truth while offline; cloud changes are merged by note ID/timestamp.
  function firebaseAccountSnapshotKey(uid) {
    return `${FIREBASE_SNAPSHOT_PREFIX}${uid}`;
  }

  async function persistFirebaseSession() {
    const value = firebaseSession ? { ...firebaseSession } : null;
    if (value) await chrome.storage.local.set({ [FIREBASE_SESSION_KEY]: value });
    else await chrome.storage.local.remove(FIREBASE_SESSION_KEY);
  }

  async function persistFirebaseSyncPrefs() {
    await chrome.storage.local.set({ [FIREBASE_SYNC_PREFS_KEY]: { ...firebaseSyncPrefs } });
    renderFirebaseUI();
  }

  function renderFirebaseUI() {
    const signedIn = Boolean(firebaseSession?.uid);
    if (!els.firebaseStatusTitle) return;
    const accountLabel = signedIn
      ? (safeText(firebaseSession.displayName) || safeText(firebaseSession.email).split("@")[0] || "My account")
      : "Sign in";
    // Yellow specifically means a manual action is needed: local changes exist
    // but automatic sync is paused. Paused while fully synced remains green.
    const manualSyncNeeded = signedIn && !firebaseSyncPrefs.autoSync && firebaseLocalDirty && !firebaseSyncPrefs.lastError;
    const accountSubline = signedIn
      ? (firebaseSyncPrefs.lastError ? "Sync needs attention" : manualSyncNeeded ? "Changes waiting to sync" : firebaseSyncPrefs.autoSync ? "Sync is on" : "Up to date · sync paused")
      : "Back up & sync";
    els.accountButtonLabel.textContent = accountLabel;
    els.accountButtonSubline.textContent = accountSubline;
    renderProfileAvatar();
    els.accountButton.title = signedIn
      ? (firebaseSyncPrefs.lastError
        ? `Sync needs attention: ${firebaseSyncPrefs.lastError}`
        : manualSyncNeeded
          ? "Local changes are waiting to sync. Click to open the account panel and use Sync now."
          : firebaseSyncPrefs.autoSync
            ? `Account: ${firebaseSession.email || accountLabel}. Automatic sync is on.`
            : `Account: ${firebaseSession.email || accountLabel}. Everything is synced; automatic sync is paused.`)
      : "Sign in to back up and sync notes";
    els.accountButton.setAttribute("aria-label", els.accountButton.title);
    els.accountSyncIndicator.classList.toggle("signed-in", signedIn && !firebaseSyncPrefs.lastError && !manualSyncNeeded);
    els.accountSyncIndicator.classList.toggle("sync-paused", manualSyncNeeded);
    els.accountSyncIndicator.classList.toggle("sync-error", Boolean(firebaseSyncPrefs.lastError));
    els.accountSyncIndicator.title = firebaseSyncPrefs.lastError
      ? "Sync needs attention"
      : manualSyncNeeded
        ? "Local changes waiting — use Sync now"
        : signedIn
          ? (firebaseSyncPrefs.autoSync ? "Synced automatically" : "Up to date — automatic sync paused")
          : "Not signed in";
    els.accountButton.classList.toggle("account-signed-in", signedIn);
    els.firebaseSignedOut.classList.toggle("hidden", signedIn);
    els.firebaseSignedIn.classList.toggle("hidden", !signedIn);
    els.firebaseStatusDot.classList.toggle("connected", signedIn && !firebaseSyncPrefs.lastError && !manualSyncNeeded);
    els.firebaseStatusDot.classList.toggle("paused", manualSyncNeeded);
    els.firebaseStatusDot.classList.toggle("error", Boolean(firebaseSyncPrefs.lastError));
    els.firebaseStatusTitle.textContent = firebaseSyncPrefs.lastError
      ? "Sync needs attention"
      : !signedIn
        ? "Not signed in"
        : manualSyncNeeded
          ? "Changes waiting to sync"
          : `Signed in as ${firebaseSession.email || "SideNote user"}`;
    if (firebaseSyncPrefs.lastError) {
      els.firebaseStatusDetail.textContent = firebaseSyncPrefs.lastError;
    } else if (manualSyncNeeded && firebaseSyncPrefs.lastSyncedAt) {
      els.firebaseStatusDetail.textContent = `Automatic sync is paused. Local changes are waiting to upload. Click Sync now. Last synced ${formatSyncedTime(firebaseSyncPrefs.lastSyncedAt)}.`;
    } else if (manualSyncNeeded) {
      els.firebaseStatusDetail.textContent = "Automatic sync is paused and local changes are waiting to upload. Click Sync now.";
    } else if (signedIn && !firebaseSyncPrefs.autoSync && firebaseSyncPrefs.lastSyncedAt) {
      els.firebaseStatusDetail.textContent = `Everything is synced. Automatic sync is paused. Last synced ${formatSyncedTime(firebaseSyncPrefs.lastSyncedAt)}.`;
    } else if (signedIn && !firebaseSyncPrefs.autoSync) {
      els.firebaseStatusDetail.textContent = firebaseLocalDirty
        ? "Local changes are waiting to sync. Click Sync now."
        : "Nothing needs manual sync right now. Automatic sync is paused.";
    } else if (signedIn && firebaseSyncPrefs.lastSyncedAt) {
      els.firebaseStatusDetail.textContent = `Automatic sync is on. Last synced ${formatSyncedTime(firebaseSyncPrefs.lastSyncedAt)}.`;
    } else if (signedIn) {
      els.firebaseStatusDetail.textContent = "Account connected. Preparing your notes sync…";
    } else {
      els.firebaseStatusDetail.textContent = "Sign in to sync your notes across devices. Your notes stay on this device until you connect.";
    }
    els.firebaseAutoSyncToggle.checked = Boolean(firebaseSyncPrefs.autoSync);
    els.firebaseAutoSyncToggle.disabled = !signedIn;
    els.firebaseSyncNowButton.disabled = !signedIn;
    els.firebaseGoogleButton.disabled = !chrome.identity?.getAuthToken;
    els.firebaseFootnote.textContent = signedIn
      ? "Your notes are saved locally first, then synced to your private account. Signing out keeps this device's notes."
      : "Local-first: sign in to merge local notes with your cloud account. Passwords are never stored by SideNote.";
  }

  function firebaseEmptyPayload() {
    return {
      schemaVersion: 1, app: "SideNote", updatedAt: Date.now(), deviceId: cloudState.deviceId || makeId(),
      notes: [], settings: { ...DEFAULT_SETTINGS }, layout: { notesHeight: 168 }, deletedNotes: {},
      settingsUpdatedAt: 0, layoutUpdatedAt: 0
    };
  }

  async function saveCurrentAccountSnapshot(uid) {
    if (!uid) return;
    try {
      const payload = await makeLocalBackupPayload();
      await chrome.storage.local.set({ [firebaseAccountSnapshotKey(uid)]: payload });
    } catch (error) {
      console.warn("SideNote: account-local cache could not be saved", error);
    }
  }

  async function prepareLocalDataForAccount(uid) {
    const stored = await chrome.storage.local.get(FIREBASE_OWNER_KEY);
    const owner = safeText(stored[FIREBASE_OWNER_KEY]) || "local";
    if (owner === uid || owner === "local") return;

    // Switching accounts on a shared browser must not silently upload one user's
    // private notes to another account. Cache the previous account's local view,
    // then load this account's local cache (or an empty workspace) before merging.
    await saveCurrentAccountSnapshot(owner);
    const cacheKey = firebaseAccountSnapshotKey(uid);
    const cached = await chrome.storage.local.get(cacheKey);
    const payload = cached[cacheKey] && Array.isArray(cached[cacheKey].notes)
      ? cached[cacheKey] : firebaseEmptyPayload();
    applyingFirebaseData = true;
    try { await applyBackupPayload(payload); }
    finally { applyingFirebaseData = false; }
  }

  async function currentFirebaseIdToken() {
    if (!firebaseSession?.refreshToken) throw new Error("Sign in to your SideNote account to sync.");
    if (firebaseIdToken && Number(firebaseSession.expiresAt) > Date.now() + 60_000) return firebaseIdToken;
    try {
      const refreshed = await FirebaseAPI.refreshSession(firebaseSession.refreshToken);
      if (refreshed.localId && firebaseSession.uid && refreshed.localId !== firebaseSession.uid) {
        throw new Error("Firebase returned a different account. Sign in again to protect your notes.");
      }
      firebaseIdToken = refreshed.idToken;
      firebaseSession = {
        ...firebaseSession,
        refreshToken: refreshed.refreshToken,
        expiresAt: Date.now() + refreshed.expiresIn * 1000
      };
      await persistFirebaseSession();
      return firebaseIdToken;
    } catch (error) {
      if (/INVALID_REFRESH_TOKEN|TOKEN_EXPIRED|USER_DISABLED|USER_NOT_FOUND/i.test(safeText(error.message))) {
        firebaseSession = null;
        firebaseIdToken = "";
        await persistFirebaseSession();
        renderFirebaseUI();
        throw new Error("Your SideNote session expired. Please sign in again. Your local notes are safe.");
      }
      throw error;
    }
  }

  async function finishFirebaseSignIn(authResult, providerId) {
    await saveNow({ skipFirebaseSyncSchedule: true });
    const uid = safeText(authResult.localId || authResult.user_id);
    if (!uid || !authResult.idToken || !authResult.refreshToken) throw new Error("Firebase signed in but did not return a complete session.");
    clearTimeout(firebaseSyncTimer);
    await prepareLocalDataForAccount(uid);
    firebaseSession = {
      uid,
      email: safeText(authResult.email),
      displayName: safeText(authResult.displayName || authResult.email?.split("@")[0] || "SideNote user"),
      providerId,
      refreshToken: authResult.refreshToken,
      expiresAt: Date.now() + (Number(authResult.expiresIn) || 3600) * 1000
    };
    firebaseIdToken = authResult.idToken;
    firebaseSyncPrefs.lastError = "";
    firebaseSyncPrefs.autoSync = true;
    firebaseLocalDirty = true;
    firebaseLocalRevision += 1;
    await chrome.storage.local.set({ [FIREBASE_OWNER_KEY]: uid });
    await persistFirebaseSession();
    await persistFirebaseSyncPrefs();
    renderFirebaseUI();
    return await syncFirebaseNow({ manual: true, initialMerge: true });
  }

  async function runFirebaseAuth(action) {
    const email = els.firebaseEmail.value.trim();
    const password = els.firebasePassword.value;
    if (!email || !email.includes("@")) { showToast("Enter a valid email address"); els.firebaseEmail.focus(); return; }
    if (!password || password.length < 6) { showToast("Enter a password with at least 6 characters"); els.firebasePassword.focus(); return; }
    els.firebaseSignInButton.disabled = true;
    els.firebaseCreateButton.disabled = true;
    try {
      const response = action === "create"
        ? await FirebaseAPI.createAccount(email, password)
        : await FirebaseAPI.signInEmail(email, password);
      els.firebasePassword.value = "";
      const synced = await finishFirebaseSignIn(response, "password");
      showToast(synced
        ? (action === "create" ? "Account created and notes synced" : "Signed in and notes synced")
        : "Signed in. Sync needs attention; check the account status and Firebase setup.");
    } catch (error) {
      firebaseSyncPrefs.lastError = safeText(error.message || "Authentication failed");
      renderFirebaseUI();
      showToast(firebaseSyncPrefs.lastError);
      console.error("SideNote: Firebase email auth failed", error);
    } finally {
      els.firebaseSignInButton.disabled = false;
      els.firebaseCreateButton.disabled = false;
    }
  }

  async function runGoogleFirebaseAuth() {
    els.firebaseGoogleButton.disabled = true;
    try {
      const response = await FirebaseAPI.signInGoogle();
      els.firebasePassword.value = "";
      const synced = await finishFirebaseSignIn(response, "google.com");
      showToast(synced ? "Signed in with Google and synced notes" : "Signed in. Sync needs attention; check Firebase setup.");
    } catch (error) {
      firebaseSyncPrefs.lastError = safeText(error.message || "Google sign-in failed");
      renderFirebaseUI();
      showToast(firebaseSyncPrefs.lastError);
      console.error("SideNote: Firebase Google auth failed", error);
    } finally {
      els.firebaseGoogleButton.disabled = false;
    }
  }

  async function signOutFirebase() {
    if (!firebaseSession) return;
    if (!window.confirm("Sign out of SideNote? Your notes will stay on this device and in your cloud account.")) return;
    clearTimeout(firebaseSyncTimer);
    await saveNow({ skipFirebaseSyncSchedule: true });
    await saveCurrentAccountSnapshot(firebaseSession.uid);
    firebaseSession = null;
    firebaseIdToken = "";
    firebaseSyncPrefs.lastError = "";
    await persistFirebaseSession();
    await persistFirebaseSyncPrefs();
    renderFirebaseUI();
    showToast("Signed out. Your local notes are kept.");
  }

  function firestoreDocToNote(doc) {
    return {
      id: safeText(doc.id), title: safeText(doc.title), body: safeText(doc.body), pinned: Boolean(doc.pinned),
      tint: Number.isInteger(doc.tint) && doc.tint >= 0 && doc.tint <= 6 ? doc.tint : 0,
      texture: Number.isInteger(doc.texture) && doc.texture >= 0 && doc.texture <= 4 ? doc.texture : 0,
      linkedUrl: safeText(doc.linkedUrl), linkedTitle: safeText(doc.linkedTitle), linkDisabled: Boolean(doc.linkDisabled),
      createdAt: Number(doc.createdAt) || Date.now(), updatedAt: Number(doc.updatedAt) || Number(doc.createdAt) || Date.now()
    };
  }

  function stableJson(value) {
    if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
    if (value && typeof value === "object") {
      return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
    }
    return JSON.stringify(value);
  }

  function sameFirebaseDocument(remote, desired) {
    if (!remote) return false;
    const keys = desired.deleted
      ? ["id", "deleted", "deletedAt", "updatedAt"]
      : ["id", "title", "body", "pinned", "tint", "texture", "linkedUrl", "linkedTitle", "linkDisabled", "createdAt", "updatedAt", "deleted"];
    return keys.every((key) => {
      if (key === "deleted" || key === "pinned" || key === "linkDisabled") return Boolean(remote[key]) === Boolean(desired[key]);
      if (["deletedAt", "createdAt", "updatedAt", "tint", "texture"].includes(key)) return Number(remote[key] || 0) === Number(desired[key] || 0);
      return safeText(remote[key]) === safeText(desired[key]);
    });
  }

  async function syncFirebaseNow({ manual = false, initialMerge = false, pollOnly = false } = {}) {
    if (!firebaseSession?.uid) {
      if (manual) showToast("Sign in to your SideNote account first");
      return;
    }
    if (!manual && !firebaseSyncPrefs.autoSync) return;
    if (firebaseSyncInProgress) { firebaseSyncRequestedAgain = true; return; }
    firebaseSyncInProgress = true;
    const localRevisionAtStart = firebaseLocalRevision;
    clearTimeout(firebaseSyncTimer);
    firebaseSyncTimer = null;
    renderFirebaseUI();
    try {
      if (!pollOnly || firebaseLocalDirty || manual) await saveNow({ skipFirebaseSyncSchedule: true });
      const token = await currentFirebaseIdToken();
      const uid = firebaseSession.uid;
      const remoteMeta = await FirebaseAPI.readMeta(token, uid);
      const remoteRevision = Number(remoteMeta?.updatedAt) || 0;
      // Low-cost polling checks just the single metadata document. Read the note
      // collection only if another device published a newer revision or local data changed.
      if (pollOnly && !firebaseLocalDirty && remoteRevision <= (Number(firebaseSyncPrefs.lastRemoteRevision) || 0)) {
        return true;
      }
      const remoteDocs = await FirebaseAPI.listNotes(token, uid);
      const remoteNotes = [];
      const remoteDeleted = {};
      const remoteById = new Map();
      for (const doc of remoteDocs) {
        const id = safeText(doc.id);
        if (!id) continue;
        remoteById.set(id, doc);
        if (doc.deleted === true) remoteDeleted[id] = Math.max(Number(remoteDeleted[id]) || 0, Number(doc.deletedAt || doc.updatedAt) || 0);
        else remoteNotes.push(firestoreDocToNote({ ...doc, id }));
      }
      const localPayload = await makeLocalBackupPayload();
      const remotePayload = {
        schemaVersion: 1,
        app: "SideNote",
        updatedAt: remoteRevision,
        deviceId: safeText(remoteMeta?.deviceId),
        notes: remoteNotes,
        settings: remoteMeta?.settings && typeof remoteMeta.settings === "object" ? remoteMeta.settings : {},
        layout: remoteMeta?.layout && typeof remoteMeta.layout === "object" ? remoteMeta.layout : {},
        deletedNotes: remoteDeleted,
        settingsUpdatedAt: Number(remoteMeta?.settingsUpdatedAt) || 0,
        layoutUpdatedAt: Number(remoteMeta?.layoutUpdatedAt) || 0
      };
      const merged = mergeBackupPayloads(localPayload, remotePayload);
      // If the user typed while the network read was in flight, let the new local
      // revision win this round rather than replacing the live editor with stale data.
      if (firebaseLocalRevision !== localRevisionAtStart) {
        firebaseLocalDirty = true;
        firebaseSyncRequestedAgain = true;
        return false;
      }
      applyingFirebaseData = true;
      let applied = false;
      try {
        applied = await applyBackupPayload(merged, {
          preserveEditorFocus: true,
          expectedLocalRevision: localRevisionAtStart
        });
      } finally {
        applyingFirebaseData = false;
      }
      if (!applied) return false;
      await chrome.storage.local.set({ [FIREBASE_OWNER_KEY]: uid });

      const desiredDocs = [
        ...merged.notes.map((note) => ({ ...note, deleted: false })),
        ...Object.entries(merged.deletedNotes || {}).map(([id, deletedAt]) => ({
          id, deleted: true, deletedAt: Number(deletedAt) || Date.now(), updatedAt: Number(deletedAt) || Date.now()
        }))
      ];
      const noteWrites = desiredDocs.filter((doc) => !sameFirebaseDocument(remoteById.get(doc.id), doc));
      const storedLayout = await chrome.storage.local.get(LAYOUT_KEY);
      const desiredMeta = {
        schemaVersion: 1,
        app: "SideNote",
        deviceId: cloudState.deviceId || makeId(),
        settings: { ...settings },
        layout: { notesHeight: Number(storedLayout[LAYOUT_KEY]?.notesHeight) || Number(merged.layout?.notesHeight) || 168 },
        settingsUpdatedAt: Number(cloudState.settingsUpdatedAt) || Number(merged.settingsUpdatedAt) || 0,
        layoutUpdatedAt: Number(cloudState.layoutUpdatedAt) || Number(merged.layoutUpdatedAt) || 0
      };
      const metaChanged = !remoteMeta ||
        stableJson(remoteMeta.settings || {}) !== stableJson(desiredMeta.settings) ||
        stableJson(remoteMeta.layout || {}) !== stableJson(desiredMeta.layout) ||
        Number(remoteMeta.settingsUpdatedAt || 0) !== desiredMeta.settingsUpdatedAt ||
        Number(remoteMeta.layoutUpdatedAt || 0) !== desiredMeta.layoutUpdatedAt;
      let finalRemoteRevision = remoteRevision;
      if (noteWrites.length || metaChanged) {
        finalRemoteRevision = Date.now();
        // Metadata revision is written after the changed note batch. A polling
        // device will then know to fetch the full note collection.
        await FirebaseAPI.writeNotes(token, uid, noteWrites);
        await FirebaseAPI.writeMeta(token, uid, { ...desiredMeta, updatedAt: finalRemoteRevision });
      }
      firebaseSyncPrefs.lastSyncedAt = Date.now();
      firebaseSyncPrefs.lastRemoteRevision = finalRemoteRevision;
      firebaseSyncPrefs.lastError = "";
      if (firebaseLocalRevision === localRevisionAtStart) firebaseLocalDirty = false;
      else { firebaseLocalDirty = true; firebaseSyncRequestedAgain = true; }
      await persistFirebaseSyncPrefs();
      if (manual) showToast(initialMerge ? "Local and cloud notes merged and synced" : "SideNote synced");
      return true;
    } catch (error) {
      firebaseSyncPrefs.lastError = safeText(error.message || "Cloud sync failed");
      await persistFirebaseSyncPrefs();
      if (manual) showToast(`Sync failed: ${firebaseSyncPrefs.lastError}`);
      console.error("SideNote: Firebase sync failed", error);
      return false;
    } finally {
      firebaseSyncInProgress = false;
      renderFirebaseUI();
      if (firebaseSyncRequestedAgain) {
        firebaseSyncRequestedAgain = false;
        scheduleFirebaseSync(700);
      }
    }
  }

  function scheduleFirebaseSync(delay = 1500) {
    if (applyingFirebaseData || !firebaseSession?.uid || !firebaseSyncPrefs.autoSync) return;
    if (firebaseSyncInProgress) { firebaseSyncRequestedAgain = true; return; }
    clearTimeout(firebaseSyncTimer);
    firebaseSyncTimer = setTimeout(() => { void syncFirebaseNow({ manual: false }); }, delay);
  }

  async function initializeFirebaseAccount() {
    try {
      const stored = await chrome.storage.local.get([FIREBASE_SESSION_KEY, FIREBASE_SYNC_PREFS_KEY]);
      const pref = stored[FIREBASE_SYNC_PREFS_KEY];
      if (pref && typeof pref === "object") {
        firebaseSyncPrefs = {
          autoSync: pref.autoSync !== false,
          lastSyncedAt: Number(pref.lastSyncedAt) || 0,
          lastRemoteRevision: Number(pref.lastRemoteRevision) || 0,
          lastError: safeText(pref.lastError)
        };
      }
      const session = stored[FIREBASE_SESSION_KEY];
      const localEdits = notes.some((note) => Number(note.updatedAt) > (Number(firebaseSyncPrefs.lastSyncedAt) || 0));
      if (!firebaseSyncPrefs.lastRemoteRevision || !firebaseSyncPrefs.lastSyncedAt || localEdits ||
          Number(cloudState.settingsUpdatedAt) > (Number(firebaseSyncPrefs.lastSyncedAt) || 0) ||
          Number(cloudState.layoutUpdatedAt) > (Number(firebaseSyncPrefs.lastSyncedAt) || 0)) {
        firebaseLocalDirty = true;
      }
      if (session?.uid && session?.refreshToken) {
        firebaseSession = { ...session };
        renderFirebaseUI();
        firebaseIdToken = "";
        try {
          await currentFirebaseIdToken();
          renderFirebaseUI();
          if (firebaseSyncPrefs.autoSync) void syncFirebaseNow({ manual: false });
        } catch (error) {
          firebaseSyncPrefs.lastError = safeText(error.message || "Please sign in again.");
          firebaseSession = null;
          firebaseIdToken = "";
          await persistFirebaseSession();
        }
      }
    } catch (error) {
      firebaseSyncPrefs.lastError = safeText(error.message || "Could not initialize Firebase.");
      console.error("SideNote: Firebase initialization failed", error);
    }
    renderFirebaseUI();
  }

  els.profileAvatarChoices.addEventListener("click", (event) => {
    const button = event.target.closest("[data-avatar-choice]");
    if (!button) return;
    const avatar = button.dataset.avatarChoice;
    if (!PROFILE_AVATARS.some((item) => item.id === avatar) || settings.profileAvatar === avatar) return;
    settings.profileAvatar = avatar;
    applySettingsToUI();
    renderFirebaseUI();
    void saveSettings();
    showToast("Profile icon updated");
  });

  els.firebasePassword.addEventListener("keydown", (event) => {
    if (event.key === "Enter") { event.preventDefault(); void runFirebaseAuth("signin"); }
  });
  els.firebaseEmail.addEventListener("keydown", (event) => {
    if (event.key === "Enter") { event.preventDefault(); els.firebasePassword.focus(); }
  });
  els.firebaseSignInButton.addEventListener("click", () => { void runFirebaseAuth("signin"); });
  els.firebaseCreateButton.addEventListener("click", () => { void runFirebaseAuth("create"); });
  els.firebaseForgotPasswordButton.addEventListener("click", async () => {
    const email = els.firebaseEmail.value.trim();
    if (!email || !email.includes("@")) { showToast("Enter your email address first"); els.firebaseEmail.focus(); return; }
    els.firebaseForgotPasswordButton.disabled = true;
    try {
      await FirebaseAPI.sendPasswordReset(email);
      showToast("If that account exists, Firebase will send a password reset email.");
    } catch (error) {
      showToast(safeText(error.message || "Could not request a password reset"));
    } finally { els.firebaseForgotPasswordButton.disabled = false; }
  });
  els.firebaseGoogleButton.addEventListener("click", () => { void runGoogleFirebaseAuth(); });
  els.firebaseSignOutButton.addEventListener("click", () => { void signOutFirebase(); });
  els.firebaseSyncNowButton.addEventListener("click", () => { void syncFirebaseNow({ manual: true }); });
  els.firebaseAutoSyncToggle.addEventListener("change", () => {
    firebaseSyncPrefs.autoSync = els.firebaseAutoSyncToggle.checked;
    firebaseSyncPrefs.lastError = "";
    void persistFirebaseSyncPrefs().then(() => {
      if (firebaseSyncPrefs.autoSync) {
        firebaseLocalDirty = true;
        firebaseLocalRevision += 1;
        scheduleFirebaseSync(100);
      }
      else { clearTimeout(firebaseSyncTimer); firebaseSyncTimer = null; }
      showToast(firebaseSyncPrefs.autoSync ? "Automatic account sync enabled" : "Automatic account sync paused");
    });
  });
  window.addEventListener("online", () => {
    if (firebaseSession?.uid) { firebaseLocalDirty = true; firebaseLocalRevision += 1; }
    scheduleFirebaseSync(300);
  });
  window.setInterval(() => { if (!document.hidden) void syncFirebaseNow({ manual: false, pollOnly: true }); }, 30_000);

  function currentNotesHeight() {
    const fromVariable = parseFloat(getComputedStyle(els.appShell).getPropertyValue("--notes-area-height"));
    return Number.isFinite(fromVariable) && fromVariable > 0 ? fromVariable : els.notesSection.getBoundingClientRect().height;
  }

  function clampNotesHeight(height) {
    const sectionTop = els.notesSection.getBoundingClientRect().top;
    const splitterHeight = els.splitter.getBoundingClientRect().height || 8;
    const footerHeight = els.appFooter.getBoundingClientRect().height || 31;
    const editorMargin = 14;
    const minEditorHeight = 184;
    const maxHeight = Math.max(86, window.innerHeight - sectionTop - splitterHeight - footerHeight - editorMargin - minEditorHeight);
    els.splitter.setAttribute("aria-valuemax", String(Math.round(maxHeight)));
    return Math.round(Math.min(maxHeight, Math.max(86, height)));
  }

  function applyNotesHeight(height) {
    const clamped = clampNotesHeight(height);
    els.appShell.style.setProperty("--notes-area-height", `${clamped}px`);
    els.splitter.setAttribute("aria-valuenow", String(clamped));
    return clamped;
  }

  async function saveLayout() {
    try {
      cloudState.layoutUpdatedAt = Date.now();
      firebaseLocalDirty = true;
      firebaseLocalRevision += 1;
      if (firebaseSession?.uid && !firebaseSyncPrefs.autoSync) renderFirebaseUI();
      await chrome.storage.local.set({
        [LAYOUT_KEY]: { notesHeight: Math.round(currentNotesHeight()) },
        [CLOUD_META_KEY]: { ...cloudState }
      });
      scheduleFirebaseSync();
    } catch (error) {
      console.warn("SideNote: could not save panel layout", error);
    }
  }

  async function loadLayout() {
    try {
      const result = await chrome.storage.local.get(LAYOUT_KEY);
      const storedHeight = result[LAYOUT_KEY]?.notesHeight;
      if (Number.isFinite(storedHeight)) applyNotesHeight(storedHeight);
    } catch (error) {
      console.warn("SideNote: could not load panel layout", error);
    }
  }

  function finishSplitterDrag(event) {
    if (!splitterDrag) return;
    try {
      if (els.splitter.hasPointerCapture(event.pointerId)) els.splitter.releasePointerCapture(event.pointerId);
    } catch (_) {}
    splitterDrag = null;
    document.body.classList.remove("resizing-split");
    void saveLayout();
  }

  els.splitter.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    event.preventDefault();
    splitterDrag = {
      pointerId: event.pointerId,
      top: els.notesSection.getBoundingClientRect().top,
      halfHandle: (els.splitter.getBoundingClientRect().height || 8) / 2
    };
    document.body.classList.add("resizing-split");
    try { els.splitter.setPointerCapture(event.pointerId); } catch (_) {}
  });

  els.splitter.addEventListener("pointermove", (event) => {
    if (!splitterDrag || event.pointerId !== splitterDrag.pointerId) return;
    applyNotesHeight(event.clientY - splitterDrag.top - splitterDrag.halfHandle);
  });

  els.splitter.addEventListener("pointerup", finishSplitterDrag);
  els.splitter.addEventListener("pointercancel", finishSplitterDrag);
  els.splitter.addEventListener("keydown", (event) => {
    if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    let next = currentNotesHeight();
    if (event.key === "ArrowUp") next -= 12;
    if (event.key === "ArrowDown") next += 12;
    if (event.key === "Home") next = 86;
    if (event.key === "End") next = Number(els.splitter.getAttribute("aria-valuemax")) || 420;
    applyNotesHeight(next);
    void saveLayout();
  });
  window.addEventListener("resize", () => applyNotesHeight(currentNotesHeight()));

  els.bulkActionsBar.addEventListener("click", (event) => {
    const button = event.target.closest("[data-bulk-action]");
    if (!button) return;
    void runBulkAction(button.dataset.bulkAction);
  });
  els.noteActionMenu.addEventListener("click", (event) => {
    const button = event.target.closest("[data-note-action]");
    if (!button) return;
    void runNoteAction(button.dataset.noteAction);
  });
  document.addEventListener("pointermove", (event) => {
    if (!notePressState || event.pointerId !== notePressState.pointerId || notePressState.triggered) return;
    if (Math.hypot(event.clientX - notePressState.x, event.clientY - notePressState.y) > 9) cancelNoteLongPress(event);
  }, true);
  document.addEventListener("pointerup", finishNoteLongPress, true);
  document.addEventListener("pointercancel", finishNoteLongPress, true);
  document.addEventListener("pointerdown", (event) => {
    if (!els.noteActionMenu.classList.contains("hidden") && !els.noteActionMenu.contains(event.target) && !event.target.closest(".note-card-menu-button")) {
      closeNoteActionMenu();
    }
  }, true);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !els.noteActionMenu.classList.contains("hidden")) {
      event.preventDefault();
      closeNoteActionMenu();
    }
  });
  window.addEventListener("scroll", closeNoteActionMenu, true);

  els.newButton.addEventListener("click", createNote);
  els.emptyNewButton.addEventListener("click", createNote);
  els.searchToggle.addEventListener("click", () => {
    if (els.topbar.classList.contains("search-open")) closeSearch({ clear: false });
    else openSearch();
  });
  els.searchClose.addEventListener("click", () => closeSearch({ clear: true }));
  els.accountButton.addEventListener("click", openAccountPopover);
  els.accountPopoverClose.addEventListener("click", () => closeAccountPopover());
  document.addEventListener("pointerdown", (event) => {
    if (els.accountPopover.classList.contains("hidden")) return;
    if (!els.accountPopover.contains(event.target) && !els.accountButton.contains(event.target)) {
      closeAccountPopover({ restoreFocus: false });
    }
  });
  els.settingsButton.addEventListener("click", openSettings);
  els.settingsFooter.addEventListener("click", openSettings);
  els.settingsClose.addEventListener("click", () => closeSettings());
  els.settingsBackdrop.addEventListener("click", (event) => {
    if (event.target === els.settingsBackdrop) closeSettings();
  });
  els.changeShortcutButton.addEventListener("click", openShortcutSettings);
  els.themeSelect.addEventListener("change", () => {
    settings.theme = els.themeSelect.value;
    applySettingsToUI();
    void saveSettings();
  });
  els.editorFontSizeSelect.addEventListener("change", () => {
    settings.editorFontSize = els.editorFontSizeSelect.value;
    applySettingsToUI();
    void saveSettings();
  });
  els.autoOpenLinkedToggle.addEventListener("change", () => {
    settings.autoOpenLinked = els.autoOpenLinkedToggle.checked;
    void saveSettings();
    if (!settings.autoOpenLinked && noteLinkedUrl(currentNote() || {})) {
      activeId = null;
      renderList();
      renderEditor();
    }
  });
  els.confirmDeleteToggle.addEventListener("change", () => {
    settings.confirmDelete = els.confirmDeleteToggle.checked;
    void saveSettings();
  });
  els.confirmUnlinkToggle.addEventListener("change", () => {
    settings.confirmUnlink = els.confirmUnlinkToggle.checked;
    void saveSettings();
  });
  els.autoHideToolbarToggle.addEventListener("change", () => {
    settings.autoHideToolbar = els.autoHideToolbarToggle.checked;
    if (settings.autoHideToolbar) hideWritingToolbar();
    void saveSettings();
  });
  els.compactCardsToggle.addEventListener("change", () => {
    settings.compactCards = els.compactCardsToggle.checked;
    applySettingsToUI();
    void saveSettings();
  });
  els.focusNewNoteToggle.addEventListener("change", () => {
    settings.focusNewNote = els.focusNewNoteToggle.checked;
    void saveSettings();
  });
  els.sortSelect.addEventListener("change", () => {
    settings.sortMode = els.sortSelect.value;
    renderList();
    void saveSettings();
  });
  els.search.addEventListener("input", renderList);
  els.title.addEventListener("input", () => {
    updateCurrentNote("title", els.title.value);
    if (!suppressToolbarAutohide) hideWritingToolbar();
  });
  els.body.addEventListener("input", () => {
    updateCurrentNote("body", els.body.value);
    renderBodyMirror();
    if (!suppressToolbarAutohide) hideWritingToolbar();
  });
  els.body.addEventListener("scroll", syncBodyMirrorScroll, { passive: true });
  els.body.addEventListener("keydown", handleEditorKeydown);
  els.checklistLayer.addEventListener("click", (event) => {
    const button = event.target.closest(".overlay-checklist-toggle");
    if (button) toggleChecklistItem(button);
  });
  els.writingToolbarToggle.addEventListener("click", () => {
    const willOpen = !els.noteEditor.classList.contains("toolbar-open");
    els.noteEditor.classList.toggle("toolbar-open", willOpen);
    els.writingToolbarToggle.setAttribute("aria-expanded", String(willOpen));
    els.writingToolbarToggle.title = willOpen ? "Hide writing tools" : "Show writing tools";
    els.writingToolbarToggle.setAttribute("aria-label", willOpen ? "Hide writing tools" : "Show writing tools");
  });
  window.addEventListener("resize", () => renderBodyMirror());

  function hideWritingToolbar() {
    if (!settings.autoHideToolbar) return;
    els.noteEditor.classList.remove("toolbar-open");
    els.writingToolbarToggle.setAttribute("aria-expanded", "false");
    els.writingToolbarToggle.title = "Show writing tools";
    els.writingToolbarToggle.setAttribute("aria-label", "Show writing tools");
  }

  els.writingToolbar.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    const listStyle = button.dataset.listStyle;
    const indent = button.dataset.indent;
    suppressToolbarAutohide = true;
    try {
      if (listStyle) applyListStyle(listStyle);
      else if (indent) changeIndent(indent);
      else if (button === els.writingHelp) showWritingTips();
    } finally {
      suppressToolbarAutohide = false;
      renderBodyMirror();
    }
  });
  els.pin.addEventListener("click", togglePin);
  els.closeEditor.addEventListener("click", () => {
    flushSave();
    activeId = null;
    renderList();
    renderEditor();
  });
  els.delete.addEventListener("click", deleteCurrentNote);
  els.copy.addEventListener("click", copyCurrentNote);
  els.insertPage.addEventListener("click", () => {
    const note = currentNote();
    if (!note) return;
    if (noteLinkedUrl(note)) {
      if (settings.confirmUnlink && !window.confirm(`Unlink “${noteTitle(note)}” from this webpage?`)) return;
      const linkedUrl = noteLinkedUrl(note);
      const cleaned = removeLegacyPageLinkBlock(note.body, linkedUrl);
      if (cleaned.removed) note.body = cleaned.body;
      note.linkedUrl = "";
      note.linkedTitle = "";
      note.linkDisabled = true;
      note.updatedAt = Date.now();
      renderList();
      renderEditor({ preserveFocus: true });
      scheduleSave();
      showToast(cleaned.removed ? "Page unlinked and old link text removed" : "Page unlinked from this note");
      return;
    }
    void insertCurrentPage();
  });

  // Ctrl/Cmd+K focuses search while the panel is open.
  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      if (!els.topbar.classList.contains("search-open")) openSearch();
      else {
        els.search.focus();
        els.search.select();
      }
    }
    if (event.key === "Escape" && !els.settingsBackdrop.classList.contains("hidden")) {
      event.preventDefault();
      closeSettings();
      return;
    }
    if (event.key === "Escape" && !els.accountPopover.classList.contains("hidden")) {
      event.preventDefault();
      closeAccountPopover();
      return;
    }
    if (event.key === "Escape" && els.topbar.classList.contains("search-open")) {
      event.preventDefault();
      closeSearch({ clear: true });
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "n") {
      event.preventDefault();
      createNote();
    }
  });

  // Auto-open a note linked to the page currently being viewed, including when
  // navigating in the same tab or switching back to a linked tab.
  if (chrome.tabs?.onActivated) {
    chrome.tabs.onActivated.addListener(({ tabId }) => { void syncWithTabId(tabId); });
  }
  if (chrome.tabs?.onUpdated) {
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (!tab?.active || (!changeInfo.url && changeInfo.status !== "complete")) return;
      activatePageLinkedNote(tab.url || "", { clearMismatchedLink: true });
    });
  }
  if (window.SIDENOTE_ANDROID) {
    window.addEventListener("sidenote-shared-page-updated", () => {
      window.setTimeout(() => { void syncWithActivePage(); }, 250);
    });
    window.addEventListener("online", () => {
      if (firebaseSession?.uid && firebaseSyncPrefs.autoSync) window.setTimeout(() => { void syncFirebaseNow({ manual: false }); }, 350);
    });
  }
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) void syncWithActivePage();
  });

  // If the panel is closed while a save is pending, commit on pagehide too.
  window.addEventListener("pagehide", flushSave);
  void loadLayout();
  void loadSettings().then(async () => {
    await loadCloudState();
    await loadNotes();
    await initializeFirebaseAccount();
  });
})();

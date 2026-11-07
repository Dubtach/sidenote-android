/* Pure note lifecycle helpers shared by Android and Chrome builds. */
(() => {
  "use strict";
  const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

  function isTrashed(note) {
    return Number(note && note.trashedAt) > 0;
  }

  function moveToTrash(note, timestamp = Date.now()) {
    if (!note || typeof note !== "object") return false;
    const at = Math.max(1, Number(timestamp) || Date.now());
    note.trashedAt = at;
    // This records the latest explicit Trash/Restore action. It prevents a
    // stale edit from another device from silently resurrecting a deleted note.
    note.trashStateAt = at;
    note.updatedAt = at;
    return true;
  }

  function restore(note, timestamp = Date.now()) {
    if (!isTrashed(note)) return false;
    const trashedAt = Number(note.trashedAt) || 0;
    const now = Number(timestamp) || Date.now();
    if (now - trashedAt >= RETENTION_MS) return false;
    delete note.trashedAt;
    note.trashStateAt = now;
    note.updatedAt = now;
    return true;
  }

  function mergeVersions(existing, incoming) {
    const oldTime = Number(existing?.updatedAt) || 0;
    const newTime = Number(incoming?.updatedAt) || 0;
    const contentSource = newTime >= oldTime ? incoming : existing;
    const oldStateAt = Number(existing?.trashStateAt) || Number(existing?.trashedAt) || 0;
    const newStateAt = Number(incoming?.trashStateAt) || Number(incoming?.trashedAt) || 0;
    let stateSource = newStateAt > oldStateAt ? incoming : existing;
    if (newStateAt === oldStateAt && isTrashed(incoming) && !isTrashed(existing)) stateSource = incoming;
    const merged = { ...contentSource, trashStateAt: Math.max(oldStateAt, newStateAt) };
    if (isTrashed(stateSource)) merged.trashedAt = Number(stateSource.trashedAt) || 0;
    else delete merged.trashedAt;
    merged.updatedAt = Math.max(oldTime, newTime, oldStateAt, newStateAt);
    return merged;
  }

  function purgeExpired(notes, deletedNotes = {}, timestamp = Date.now()) {
    const now = Number(timestamp) || Date.now();
    const tombstones = { ...(deletedNotes || {}) };
    const expiredIds = [];
    const kept = [];
    for (const note of Array.isArray(notes) ? notes : []) {
      if (isTrashed(note) && now - Number(note.trashedAt) >= RETENTION_MS) {
        expiredIds.push(note.id);
        tombstones[note.id] = Math.max(Number(tombstones[note.id]) || 0, now);
      } else {
        kept.push(note);
      }
    }
    return { notes: kept, deletedNotes: tombstones, expiredIds };
  }

  window.SideNoteLifecycle = Object.freeze({ RETENTION_MS, isTrashed, moveToTrash, restore, mergeVersions, purgeExpired });
})();

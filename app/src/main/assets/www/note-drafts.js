(() => {
  "use strict";
  function isUntouchedEmptyDraft(note) {
    if (!note || note._emptyDraft !== true) return false;
    return !String(note.title || "").trim() && !String(note.body || "").trim();
  }
  function markWritten(note, value) {
    if (!note || note._emptyDraft !== true || !String(value || "").trim()) return false;
    delete note._emptyDraft;
    return true;
  }
  function persistedNotes(notes) {
    return (Array.isArray(notes) ? notes : []).filter((note) => !isUntouchedEmptyDraft(note));
  }
  window.SideNoteDrafts = Object.freeze({ isUntouchedEmptyDraft, markWritten, persistedNotes });
})();

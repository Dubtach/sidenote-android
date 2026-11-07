# SideNote Android v1.5.7 — overlay, editor actions, and toolbar fix

- Trash now opens as a dimmed, blurred bottom-sheet overlay like Account and Settings, and closes on outside tap, X/close, or Android Back.
- Restored and stabilized the writing toolbar with an explicit visible state, a horizontal scroll row, and reliable touch/click behavior while preserving the editor focus.
- Moved Delete from the editor title row to the bottom action row beside Pin. Android uses the top-right X close control instead of the back-arrow control.
- Added matching entry and exit motion for Editor, Account, Settings, and Trash. Exit animations are allowed to finish before panels are hidden. Reduced-motion settings are respected.
- Android Back handling closes the editor using its X close action.
- Preserved Firebase, OAuth, Trash lifecycle, drafts, Undo/Redo, appearance presets, note layouts, and existing data format.

Version: 1.5.7 (versionCode 157).

## Final verification
- 31 automated feature and regression tests pass.
- Node syntax checks pass for the app JavaScript modules.
- Android manifest/resources XML parse successfully.
- GitHub Actions workflow and required build secrets remain unchanged.

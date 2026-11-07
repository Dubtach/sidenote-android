# SideNote Android v1.5.9 — Reliable confirmations and final layout cleanup

- Routes destructive and account confirmation prompts through a dedicated native Android `AlertDialog` bridge with explicit Cancel/confirm callbacks.
- Keeps `window.confirm` as a fallback for non-Android browser contexts and for the WebChromeClient fallback.
- Removes the obsolete footer Settings button while retaining hidden save-status DOM required by autosave code.
- Aligns Trash, editor, account, and Settings overlay dismissal timers with the restrained 130–150ms motion system.
- Preserves the header Trash/Sort/View controls, the bottom floating Create button, X close controls, existing note layouts, Firebase authentication and sync, and note data format.

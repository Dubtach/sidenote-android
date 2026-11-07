# SideNote Android v1.5.8

- Moved Trash, Sort, and View controls into the main header as compact icons.
- Moved Create to a floating action button in the lower corner.
- Removed the redundant YOUR NOTES heading.
- Removed note-layout and compact-card controls from Settings; the View menu remains in the header.
- Changed Trash close affordance to an X.
- Routed destructive confirmations through `window.confirm`, displayed by the native Android WebChromeClient AlertDialog.
- Replaced elaborate overshoot sheet animations with brief fade/translate transitions. Rubber-band scrolling remains enabled.
- Preserved Firebase authentication, synchronization, Trash lifecycle, undo/redo, and existing note storage.

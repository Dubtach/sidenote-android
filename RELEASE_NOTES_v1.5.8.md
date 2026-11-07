# SideNote Android v1.5.8 — Interface cleanup

- Replaced the unreliable custom in-WebView confirmation flow on Android with the native AlertDialog handled by WebChromeClient. Delete and permanent-delete actions now receive a reliable true/false result.
- Removed the Note card layout and Compact note cards controls from Settings. Existing layout choices remain available from the header View menu; default remains Two columns. Legacy compact density is normalized to comfortable.
- Moved Trash, Sort, and View icons into the top header beside Search and Settings.
- Removed the visible “Your Notes” section heading.
- Moved Create to a bottom-corner floating action button.
- Changed Trash navigation to an X close icon.
- Replaced oversized spring/blur panel transitions with a short, restrained fade-and-slide entrance/exit.
- Existing notes, Firebase, OAuth, Trash retention, editor, and sync formats are preserved.

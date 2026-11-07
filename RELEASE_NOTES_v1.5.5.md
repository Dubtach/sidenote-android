# SideNote Android 1.5.5

## Fixes

- Fixed Android compilation failure caused by calls to a missing `safe(String)` helper in `MainActivity`.
- Added a null-safe, trimming string helper used for optional Firebase user fields, auth input email addresses, and diagnostic messages. Password values remain unchanged.
- Added a regression test that checks the helper declaration and its Firebase authentication call sites.

No Firebase project settings, OAuth client IDs, package identifiers, or note-storage formats were changed.

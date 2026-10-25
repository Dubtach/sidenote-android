# SideNote uses JavaScript interfaces by explicit class name. Keep the bridge methods intact.
-keepclassmembers class com.dubtach.sidenote.MainActivity$SideNoteBridge {
    @android.webkit.JavascriptInterface <methods>;
}

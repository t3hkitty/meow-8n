# ProGuard Rules for n8n Local Android App
-keepattributes JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep Capacitor Bridge Classes
-keep public class com.getcapacitor.** { *; }
-keep public class * extends com.getcapacitor.Plugin { *; }

# OkHttp & Network Security
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn javax.annotation.**

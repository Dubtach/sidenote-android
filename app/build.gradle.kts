plugins {
    id("com.android.application")
}

// Set SIDENOTE_GOOGLE_WEB_CLIENT_ID in GitHub Actions secrets or pass it as a Gradle
// project property. Keep the placeholder for builds where Google sign-in is not configured.
val googleWebClientId = (
    System.getenv("SIDENOTE_GOOGLE_WEB_CLIENT_ID")
        ?: (findProperty("SIDENOTE_GOOGLE_WEB_CLIENT_ID") as String?)
        ?: ""
).trim().ifBlank { "YOUR_GOOGLE_WEB_CLIENT_ID.apps.googleusercontent.com" }
val escapedGoogleWebClientId = googleWebClientId.replace("\\", "\\\\").replace("\"", "\\\"")

android {
    namespace = "com.dubtach.sidenote"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.dubtach.sidenote"
        minSdk = 24
        targetSdk = 36
        versionCode = 103
        versionName = "1.1.1"
        buildConfigField("String", "GOOGLE_WEB_CLIENT_ID", "\"$escapedGoogleWebClientId\"")
    }

    buildFeatures {
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
}

dependencies {
    implementation("androidx.core:core:1.17.0")
    implementation("androidx.webkit:webkit:1.13.0")
    implementation("androidx.credentials:credentials:1.5.0")
    implementation("androidx.credentials:credentials-play-services-auth:1.5.0")
    implementation("com.google.android.libraries.identity.googleid:googleid:1.1.1")
}

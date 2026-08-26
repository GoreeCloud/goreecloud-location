plugins {
    id("com.android.application")
}

android {
    namespace = "com.goreecloud.location"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.goreecloud.location"
        minSdk = 28
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0-dev"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }
}

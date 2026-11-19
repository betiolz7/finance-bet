// App Android que só abre o site publicado em tela cheia (Trusted Web Activity).
// O APK é gerado pelo GitHub Actions: .github/workflows/android-apk.yml
plugins {
    id("com.android.application")
}

// Número da execução no GitHub: cada APK novo instala por cima do anterior.
val build = (System.getenv("GITHUB_RUN_NUMBER") ?: "1").toInt()

android {
    namespace = "com.betiol.financebet"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.betiol.financebet"
        minSdk = 21
        targetSdk = 35
        versionCode = build
        versionName = "1.0.$build"
    }

    signingConfigs {
        create("release") {
            storeFile = file(System.getenv("ANDROID_KEYSTORE_PATH") ?: "chave-ausente.p12")
            storePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD")
            keyAlias = "finance-bet"
            keyPassword = System.getenv("ANDROID_KEYSTORE_PASSWORD")
            storeType = "pkcs12"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation("com.google.androidbrowserhelper:androidbrowserhelper:2.5.0")
}

import java.util.Properties

plugins { id("com.android.application") }

val signing =
    Properties().apply {
        val f =
            file(
                System.getenv("SUNCALC_SIGNING_CONFIG")
                    ?: "${System.getProperty("user.home")}/.config/suncalc/upload.properties",
            )
        if (f.isFile) f.inputStream().use { load(it) }
    }

android {
    namespace = "app.suncalc.planner"
    compileSdk = 36
    defaultConfig {
        applicationId = "app.suncalc.planner"
        minSdk = 29
        targetSdk = 36
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        versionCode = providers.gradleProperty("sunCalcVersionCode").orNull?.toInt() ?: 2
        versionName = "1.0"
    }
    signingConfigs {
        if (signing.isNotEmpty())
            create("upload") {
                storeFile = file(signing.getProperty("storeFile"))
                storePassword = signing.getProperty("storePassword")
                keyAlias = signing.getProperty("keyAlias")
                keyPassword = signing.getProperty("keyPassword")
            }
    }
    buildTypes {
        debug { applicationIdSuffix = ".debug" }
        release { signingConfig = signingConfigs.findByName("upload") }
    }
    sourceSets["main"].assets.srcDir(rootProject.file("../.cache/android-web"))
}

val web =
    tasks.register<Exec>("bundlePlanner") {
        workingDir(rootProject.file(".."))
        commandLine("npm", "run", "build:android-web")
        inputs.files(
            fileTree(rootProject.file("../src")),
            fileTree(rootProject.file("../public")),
            fileTree(rootProject.file("../scripts")),
            *listOf(
                    "android.html",
                    "tsconfig.json",
                    "vite.config.ts",
                    "package.json",
                    "package-lock.json",
                )
                .map { rootProject.file("../$it") }
                .toTypedArray(),
        )
        outputs.dir(rootProject.file("../.cache/android-web"))
    }

tasks.named("preBuild").configure { dependsOn(web) }

dependencies {
    implementation("androidx.webkit:webkit:1.14.0")
    implementation("com.android.billingclient:billing:9.1.0")
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test:runner:1.6.2")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
}

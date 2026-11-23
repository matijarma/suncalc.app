package app.suncalc.planner

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.*
import android.view.Gravity
import android.view.ViewGroup
import android.webkit.*
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.webkit.*
import org.json.JSONObject

class PlannerActivity : Activity() {
    private lateinit var web: WebView
    private lateinit var access: Entitlements
    private var play: PlayStore? = null
    private lateinit var compass: Compass
    private val handler = Handler(Looper.getMainLooper())
    private var alive = true
    private var displayLost = false
    private var foreground = false
    private var tracking = false
    private var geoCallback: ((JSONObject) -> Unit)? = null
    private val geoTimeout = Runnable {
        geoCallback?.invoke(
            JSONObject().put("error", "Location was unavailable. Try searching instead."),
        )
        geoCallback = null
        if (!tracking) compass.stop()
    }

    private fun online(): Boolean {
        val cm = getSystemService(ConnectivityManager::class.java)
        return cm.getNetworkCapabilities(cm.activeNetwork)
            ?.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED) == true
    }

    // The planner, trial and free dial never need a Play service on an offline launch.
    private fun store(): PlayStore =
        play
            ?: PlayStore(
                    this,
                    access,
                    { status() },
                    { event("notice", JSONObject().put("message", it)) },
                )
                .also { play = it }

    private var lastSync = 0L
    private val tick =
        object : Runnable {
            override fun run() {
                if (!foreground) return
                if (!online()) {
                    play?.close()
                    play = null
                    lastSync = 0L
                } else if (lastSync == 0L || SystemClock.elapsedRealtime() - lastSync >= 120000) {
                    if (lastSync == 0L) store().refresh()
                    lastSync = SystemClock.elapsedRealtime()
                    access.sync()
                }
                status()
                handler.postDelayed(this, 15000)
            }
        }

    override fun onCreate(saved: Bundle?) {
        super.onCreate(saved)
        if (WebView.getCurrentWebViewPackage() == null) {
            showDisplayRecovery("Install or enable Android System WebView to open SunCalc.")
            return
        }
        web = WebView(this)
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            web.destroy()
            showDisplayRecovery("Update Android System WebView or Chrome to open SunCalc.")
            return
        }
        access = Entitlements(this) { runOnUiThread { status() } }
        compass =
            Compass(this) { v ->
                if (tracking) event("sensor", v)
                if (v.has("lat") && geoCallback != null) {
                    val cb = geoCallback
                    geoCallback = null
                    handler.removeCallbacks(geoTimeout)
                    cb?.invoke(v)
                    if (!tracking) compass.stop()
                }
            }
        val assets = WebViewAssetLoader.Builder().addPathHandler("/", LocalAssets(this)).build()
        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            setGeolocationEnabled(false)
        }
        CookieManager.getInstance().setAcceptCookie(false)
        web.webViewClient =
            object : WebViewClient() {
                override fun onRenderProcessGone(
                    view: WebView,
                    detail: RenderProcessGoneDetail,
                ): Boolean {
                    // Android will terminate the host process unless every affected view handles
                    // this.
                    displayLost = true
                    tracking = false
                    geoCallback = null
                    handler.removeCallbacksAndMessages(null)
                    compass.stop()
                    play?.close()
                    play = null
                    (view.parent as? ViewGroup)?.removeView(view)
                    view.destroy()
                    showDisplayRecovery(
                        "Android stopped the planner display. Your saved places are still on this device.",
                    )
                    return true
                }

                override fun shouldInterceptRequest(
                    view: WebView,
                    r: WebResourceRequest,
                ): WebResourceResponse? =
                    if (r.url.scheme == "https" && r.url.authority == HOST && r.method == "GET")
                        assets.shouldInterceptRequest(r.url) ?: LocalAssets.error(404)
                    else LocalAssets.error(404)

                override fun shouldOverrideUrlLoading(
                    view: WebView,
                    r: WebResourceRequest,
                ): Boolean {
                    if (!r.isForMainFrame) return true
                    val u = r.url
                    if (
                        u.scheme == "https" &&
                            u.authority == HOST &&
                            (u.path == "/" || u.path == "/index.html")
                    )
                        return false
                    if (r.hasGesture() && u.scheme == "https") {
                        val target =
                            if (u.authority == HOST) u.buildUpon().authority("suncalc.app").build()
                            else u
                        if (
                            target.host in
                                listOf(
                                    "suncalc.app",
                                    "www.openstreetmap.org",
                                    "www.geonames.org",
                                    "github.com",
                                    "play.google.com",
                                )
                        )
                            external(target)
                    }
                    return true
                }
            }
        WebViewCompat.addWebMessageListener(web, "SunCalcNative", setOf(ORIGIN)) {
            _,
            msg,
            origin,
            main,
            reply ->
            if (
                !main ||
                    origin.scheme != "https" ||
                    origin.host != HOST ||
                    origin.port !in listOf(-1, 443)
            )
                return@addWebMessageListener
            val m =
                runCatching { JSONObject(msg.data ?: "") }.getOrNull()
                    ?: return@addWebMessageListener
            val id = m.optInt("id")
            val args = m.optJSONObject("args") ?: JSONObject()
            val answer: (JSONObject) -> Unit = { v ->
                runOnUiThread {
                    if (alive && !displayLost)
                        reply.postMessage(JSONObject().put("id", id).put("value", v).toString())
                }
            }
            when (m.optString("method")) {
                "state" -> answer(snapshot())
                "restore" -> {
                    if (online()) {
                        access.sync()
                        store().refresh(true)
                        answer(JSONObject())
                    } else
                        answer(
                            JSONObject()
                                .put("error", "Connect to Google Play to restore your purchase."),
                        )
                }
                "buy" -> {
                    if (online()) {
                        store().buy(args.optString("product"))
                        answer(JSONObject())
                    } else
                        answer(
                            JSONObject().put("error", "Connect to Google Play to make a purchase."),
                        )
                }
                "manage" -> {
                    external(
                        Uri.parse(
                            "https://play.google.com/store/account/subscriptions?package=app.suncalc.planner&sku=suncalc_monthly",
                        ),
                    )
                    answer(JSONObject())
                }
                "privacy" -> {
                    external(Uri.parse("https://suncalc.app/android/privacy/"))
                    answer(JSONObject())
                }
                "support" -> {
                    external(Uri.parse("https://github.com/matijarma/suncalc.app/issues"))
                    answer(JSONObject())
                }
                "sensorStart" -> {
                    tracking = true
                    startLocation()
                    answer(JSONObject())
                }
                "sensorStop" -> {
                    tracking = false
                    if (geoCallback == null) compass.stop()
                    answer(JSONObject())
                }
                "location" -> {
                    geoCallback?.invoke(JSONObject().put("error", "Location request replaced."))
                    geoCallback = answer
                    handler.removeCallbacks(geoTimeout)
                    handler.postDelayed(geoTimeout, 15000)
                    startLocation()
                }
                "config" ->
                    if (online()) access.config { answer(JSONObject().put("addressLookup", it)) }
                    else answer(JSONObject().put("addressLookup", false))
                "address" ->
                    if (online() && access.state().getString("kind") != "locked")
                        access.lookup(args.optString("q").take(180)) {
                            answer(it ?: JSONObject().put("error", "Address lookup unavailable."))
                        }
                    else answer(JSONObject().put("error", "Address lookup is unavailable."))
                "share" -> {
                    val u = Uri.parse(args.optString("url"))
                    if (validLink(u) && access.state().getString("kind") != "locked")
                        startActivity(
                            Intent.createChooser(
                                Intent(Intent.ACTION_SEND)
                                    .setType("text/plain")
                                    .putExtra(Intent.EXTRA_TEXT, u.toString()),
                                "Share this moment",
                            ),
                        )
                    answer(JSONObject())
                }
                else -> answer(JSONObject().put("error", "Unknown action"))
            }
        }
        setContentView(web, ViewGroup.LayoutParams(-1, -1))
        window.decorView.setOnApplyWindowInsetsListener { v, i ->
            @Suppress("DEPRECATION")
            v.setPadding(
                i.systemWindowInsetLeft,
                i.systemWindowInsetTop,
                i.systemWindowInsetRight,
                i.systemWindowInsetBottom,
            )
            i
        }
        web.setBackgroundColor(Color.rgb(248, 246, 236))
        if (Build.VERSION.SDK_INT >= 33)
            onBackInvokedDispatcher.registerOnBackInvokedCallback(
                android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT,
            ) {
                back()
            }
        web.loadUrl(ORIGIN + "/" + fragment(intent))
    }

    private fun validLink(u: Uri?) =
        u?.scheme == "https" &&
            u.authority == "suncalc.app" &&
            (u.path == "/" || u.path.isNullOrEmpty()) &&
            (u.encodedFragment?.length ?: 0) <= 4096

    private fun fragment(i: Intent?): String {
        val u = i?.data
        return if (validLink(u) && u?.encodedFragment != null) "#" + u.encodedFragment else ""
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        val hash = fragment(intent)
        if (hash.isNotEmpty() && ::access.isInitialized && !displayLost)
            web.evaluateJavascript("location.hash=" + JSONObject.quote(hash), null)
    }

    private fun showDisplayRecovery(message: String) {
        displayLost = true
        val pad = (24 * resources.displayMetrics.density).toInt()
        setContentView(
            LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                gravity = Gravity.CENTER_VERTICAL
                setPadding(pad, pad, pad, pad)
                setBackgroundColor(Color.rgb(248, 246, 236))
                addView(
                    TextView(context).apply {
                        text = "SunCalc"
                        textSize = 30f
                        setTextColor(Color.rgb(32, 35, 28))
                        isAccessibilityHeading = true
                    },
                )
                addView(
                    TextView(context).apply {
                        text = message
                        textSize = 17f
                        setTextColor(Color.rgb(32, 35, 28))
                        setPadding(0, pad / 2, 0, pad)
                    },
                )
                addView(
                    Button(context).apply {
                        text = "Reopen planner"
                        setOnClickListener { recreate() }
                    },
                )
                addView(
                    Button(context).apply {
                        text = "Update WebView"
                        setOnClickListener {
                            val provider =
                                WebView.getCurrentWebViewPackage()?.packageName
                                    ?: "com.google.android.webview"
                            external(
                                Uri.parse("https://play.google.com/store/apps/details")
                                    .buildUpon()
                                    .appendQueryParameter("id", provider)
                                    .build(),
                            )
                        }
                    },
                )
            },
        )
    }

    private fun external(uri: Uri) {
        runCatching { startActivity(Intent(Intent.ACTION_VIEW, uri)) }
    }

    private fun snapshot() =
        access.state().put("prices", if (online()) play?.prices() ?: JSONObject() else JSONObject())

    private fun status() {
        if (alive && !displayLost && ::access.isInitialized) event("state", snapshot())
    }

    private fun event(kind: String, v: JSONObject) {
        if (alive && !displayLost)
            web.evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('sc:" +
                    kind +
                    "',{detail:" +
                    v.toString() +
                    "}))",
                null,
            )
    }

    private fun startLocation() {
        if (!foreground) return
        if (compass.allowed()) compass.start()
        else
            requestPermissions(
                arrayOf(
                    Manifest.permission.ACCESS_COARSE_LOCATION,
                    Manifest.permission.ACCESS_FINE_LOCATION,
                ),
                21,
            )
    }

    override fun onRequestPermissionsResult(
        code: Int,
        permissions: Array<String>,
        results: IntArray,
    ) {
        super.onRequestPermissionsResult(code, permissions, results)
        if (code != 21) return
        if (compass.allowed() && (tracking || geoCallback != null)) {
            compass.start()
        } else {
            val v =
                JSONObject()
                    .put("status", "Location permission is off. Enable it to see your shadow.")
            event("sensor", v)
            geoCallback?.invoke(JSONObject().put("error", "Location permission is off."))
            geoCallback = null
        }
    }

    private fun back() {
        if (displayLost || !::access.isInitialized) {
            finish()
            return
        }
        web.evaluateJavascript(
            "(()=>{const d=document.querySelector('dialog[open]');if(d){d.querySelector('[aria-label=\"Close dialog\"]')?.click();return true}return false})()",
        ) {
            if (it != "true") finish()
        }
    }

    // API 33+ registers the platform OnBackInvokedDispatcher in onCreate.
    @android.annotation.SuppressLint("GestureBackNavigation")
    @Deprecated("For Android 12 and earlier")
    override fun onBackPressed() {
        back()
    }

    override fun onResume() {
        super.onResume()
        foreground = true
        if (!displayLost && ::access.isInitialized) {
            web.onResume()
            if (tracking && compass.allowed()) compass.start()
            lastSync = 0L
            handler.post(tick)
        }
    }

    override fun onPause() {
        foreground = false
        handler.removeCallbacks(tick)
        if (::compass.isInitialized) {
            compass.stop()
            if (!displayLost) web.onPause()
        }
        super.onPause()
    }

    override fun onDestroy() {
        alive = false
        handler.removeCallbacksAndMessages(null)
        if (::access.isInitialized) {
            play?.close()
            compass.stop()
            access.close()
        }
        if (::web.isInitialized && !displayLost) {
            (web.parent as? ViewGroup)?.removeView(web)
            web.destroy()
        }
        super.onDestroy()
    }
}

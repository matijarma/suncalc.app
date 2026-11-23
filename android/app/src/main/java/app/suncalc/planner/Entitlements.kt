package app.suncalc.planner

import android.content.Context
import android.os.SystemClock
import android.provider.Settings
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.concurrent.Executors
import org.json.JSONObject

internal const val WEEK = 7L * 24 * 60 * 60 * 1000
internal const val MONTH = "suncalc_monthly"
internal const val LIFE = "suncalc_lifetime"

internal fun effectiveTime(wall: Long, last: Long, elapsed: Long, previous: Long) =
    maxOf(wall, last + if (previous > 0 && elapsed >= previous) elapsed - previous else 0)

internal fun accessKind(now: Long, trial: Long, monthly: Long, lifetime: Boolean) =
    when {
        lifetime -> "lifetime"
        monthly > now -> "monthly"
        trial > now -> "trial"
        else -> "locked"
    }

internal class Entitlements(val context: Context, val changed: () -> Unit) {
    private val prefs = context.getSharedPreferences("access-v1", Context.MODE_PRIVATE)
    private val net = Executors.newSingleThreadExecutor()
    private val install =
        prefs.getString("install", null)
            ?: (java.util.UUID.randomUUID().toString() + java.util.UUID.randomUUID().toString())
                .replace("-", "")
                .also { prefs.edit().putString("install", it).commit() }
    private val device =
        MessageDigest.getInstance("SHA-256")
            .digest(
                ("suncalc/android/v1:" +
                        (Settings.Secure.getString(
                            context.contentResolver,
                            Settings.Secure.ANDROID_ID,
                        ) ?: install))
                    .toByteArray(),
            )
            .joinToString("") { "%02x".format(it) }
    val started =
        prefs.getLong("started", 0).takeIf { it > 0 }
            ?: System.currentTimeMillis().also { prefs.edit().putLong("started", it).commit() }

    @Synchronized
    fun now(): Long {
        val tick = SystemClock.elapsedRealtime()
        val clock =
            effectiveTime(
                System.currentTimeMillis(),
                prefs.getLong("clock", 0),
                tick,
                prefs.getLong("tick", 0),
            )
        prefs.edit().putLong("clock", clock).putLong("tick", tick).apply()
        return clock
    }

    fun state(): JSONObject {
        val t = now()
        val until = prefs.getLong("trial", started + WEEK)
        val month = prefs.getLong("monthly", 0)
        return JSONObject()
            .put("kind", accessKind(t, until, month, prefs.getBoolean("life", false)))
            .put("trialUntil", until)
            .put("monthlyUntil", month)
            .put("now", t)
            .put("commerceReady", prefs.getBoolean("commerce", false))
    }

    fun sync(product: String? = null, token: String? = null, done: ((Boolean) -> Unit)? = null) {
        net.execute {
            val result = runCatching {
                val data =
                    JSONObject()
                        .put("device", device)
                        .put("install", install)
                        .put("started", started)
                if (product != null) data.put("product", product).put("token", token)
                val ans = request(if (product == null) "android/state" else "android/verify", data)
                val until = ans.getLong("trialUntil")
                val server = ans.getLong("serverTime")
                val month = ans.getLong("monthlyUntil")
                val life = ans.getBoolean("lifetime")
                synchronized(this) {
                    prefs
                        .edit()
                        .putLong("trial", minOf(until, prefs.getLong("trial", started + WEEK)))
                        .putLong("clock", maxOf(now(), server))
                        .putLong("tick", SystemClock.elapsedRealtime())
                        .putBoolean("life", life)
                        .putLong("monthly", month)
                        .putBoolean("commerce", ans.optBoolean("commerceReady"))
                        .apply()
                }
                changed()
                product == null || (product == LIFE && life) || (product == MONTH && month > server)
            }
                .getOrDefault(false)
            done?.invoke(result)
        }
    }

    fun lookup(query: String, done: (JSONObject?) -> Unit) {
        net.execute {
            done(runCatching { request("address", JSONObject().put("q", query)) }.getOrNull())
        }
    }

    fun config(done: (Boolean) -> Unit) {
        net.execute {
            done(
                runCatching { request("config", null).getBoolean("addressLookup") }
                    .getOrDefault(false),
            )
        }
    }

    fun close() {
        net.shutdown()
    }

    private fun request(route: String, data: JSONObject?): JSONObject {
        val c = URL("https://suncalc.app/api/" + route).openConnection() as HttpURLConnection
        try {
            c.instanceFollowRedirects = false
            c.connectTimeout = 6000
            c.readTimeout = 8000
            c.useCaches = false
            if (data != null) {
                c.requestMethod = "POST"
                c.doOutput = true
                c.setRequestProperty("Content-Type", "application/json")
                c.outputStream.use { it.write(data.toString().toByteArray()) }
            }
            check(c.responseCode == 200)
            return JSONObject(c.inputStream.bufferedReader().use { it.readText() })
        } finally {
            c.disconnect()
        }
    }
}

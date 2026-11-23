package app.suncalc.planner

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.SystemClock
import android.webkit.WebView
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import org.junit.After
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Run on the isolated debug package. Airplane mode before install exercises an offline first open.
 */
@RunWith(AndroidJUnit4::class)
class PlannerSmoke {
    private val harness = InstrumentationRegistry.getInstrumentation()
    private val context = harness.targetContext
    private var activity: Activity? = null

    private fun launch(expired: Boolean = false) {
        check(context.packageName.endsWith(".debug"))
        harness.runOnMainSync { WebView.setWebContentsDebuggingEnabled(true) }
        val prefs = context.getSharedPreferences("access-v1", 0)
        prefs
            .edit()
            .clear()
            .also { if (expired) it.putLong("started", System.currentTimeMillis() - 8L * 86400000) }
            .commit()
        val i =
            Intent(
                Intent.ACTION_VIEW,
                Uri.parse(
                    "https://suncalc.app/#lat=43.5083&lon=16.4383&at=2026-06-21T12%3A00%3A00Z&place=Offline%20pin",
                ),
                context,
                PlannerActivity::class.java,
            )
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        activity = harness.startActivitySync(i)
    }

    private fun js(s: String): String {
        val done = CountDownLatch(1)
        var result = ""
        harness.runOnMainSync {
            val root = activity!!.findViewById<android.view.ViewGroup>(android.R.id.content)
            val web = root.getChildAt(0) as? WebView
            if (web == null) {
                done.countDown()
            } else
                web.evaluateJavascript(s) {
                    result = it
                    done.countDown()
                }
        }
        // The renderer may still be starting on a cold, software-emulated device.
        // until() retries; the final assertion still requires the actual DOM result.
        if (!done.await(10, TimeUnit.SECONDS)) return ""
        return result
    }

    private fun until(s: String) {
        val end = SystemClock.elapsedRealtime() + 180000
        do {
            if (js(s) == "true") return
            SystemClock.sleep(350)
        } while (SystemClock.elapsedRealtime() < end)
        fail(
            "Condition not reached: " +
                s +
                "; screen: " +
                js("document.body.innerText.slice(0,350)"),
        )
    }

    @After
    fun finish() {
        harness.runOnMainSync { activity?.finish() }
    }

    @Test
    fun bundledFirstOpenLoadsSharedPinAndTownData() {
        launch()
        until(
            "document.querySelector('#planner-content')?.innerText.includes('Offline pin')===true",
        )
        js(
            "fetch('/towns/sp.json').then(r=>r.json()).then(rows=>document.body.dataset.town=String(rows.some(r=>r[0]==='Split')))",
        )
        until("document.body.dataset.town==='true'")
        until(
            "Array.from(document.querySelectorAll('button')).some(b=>b.textContent.includes('Live Shadow'))",
        )
    }

    @Test
    fun expiredDeepLinkLoadsOnlyTheGateAndFreeCompass() {
        launch(true)
        until("document.body.innerText.includes('Your seven days are up')")
        assertEquals("false", js("!!document.querySelector('#planner-content')"))
        assertEquals(
            "false",
            js("performance.getEntriesByType('resource').some(r=>r.name.includes('/tiles/'))"),
        )
        // Do not prompt for device permission in this unattended test.
        assertEquals(
            "true",
            js(
                "Array.from(document.querySelectorAll('button')).some(b=>b.textContent.includes('Live Shadow'))",
            ),
        )
    }
}

package app.suncalc.planner

import android.content.Context
import android.webkit.WebResourceResponse
import androidx.webkit.WebViewAssetLoader
import java.io.ByteArrayInputStream
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

internal const val HOST = "appassets.androidplatform.net"
internal const val ORIGIN = "https://" + HOST

internal class LocalAssets(val context: Context) : WebViewAssetLoader.PathHandler {
    private val tiles = File(context.cacheDir, "atlas-v1").apply { mkdirs() }
    private val mime =
        mapOf(
            "html" to "text/html",
            "js" to "text/javascript",
            "mjs" to "text/javascript",
            "css" to "text/css",
            "svg" to "image/svg+xml",
            "png" to "image/png",
            "webp" to "image/webp",
            "json" to "application/json",
            "woff2" to "font/woff2",
            "pbf" to "application/octet-stream",
            "mvt" to "application/vnd.mapbox-vector-tile",
        )

    override fun handle(path: String): WebResourceResponse {
        val name = path.ifEmpty { "index.html" }
        if (name.split('/').any { it == ".." || it == "." } || '\\' in name) return error(404)
        val type = mime[name.substringAfterLast('.')] ?: return error(404)
        val stream = runCatching { context.assets.open(name) }.getOrNull()
        if (stream != null)
            return WebResourceResponse(
                type,
                if (type.startsWith("text/")) "utf-8" else null,
                stream,
            )
        if (!Regex("tiles/v1/[0-9]{1,2}/[0-9]{1,5}/[0-9]{1,5}\\.mvt").matches(name))
            return error(404)
        val file = File(tiles, name.substringAfter("v1/").replace('/', '_'))
        runCatching {
            if (file.isFile) {
                file.setLastModified(System.currentTimeMillis())
                return WebResourceResponse(type, null, file.inputStream())
            }
        }
        val c = URL("https://suncalc.app/" + name).openConnection() as HttpURLConnection
        return try {
            c.connectTimeout = 4500
            c.readTimeout = 5500
            c.instanceFollowRedirects = false
            if (c.responseCode == 204)
                return WebResourceResponse(type, null, 204, "No content", emptyMap(), null)
            if (c.responseCode != 200) return error(503)
            val bytes = c.inputStream.use { it.readBytes() }
            if (bytes.size > 4_000_000) return error(503)
            synchronized(tiles) {
                val tmp = File.createTempFile("map", ".tmp", tiles)
                try {
                    tmp.writeBytes(bytes)
                    tmp.renameTo(file)
                } finally {
                    tmp.delete()
                }
                val stored = tiles.listFiles().orEmpty().sortedByDescending { it.lastModified() }
                var size = 0L
                stored.forEachIndexed { i, f ->
                    size += f.length()
                    if (i >= 360 || size > 32L * 1024 * 1024) f.delete()
                }
            }
            WebResourceResponse(type, null, ByteArrayInputStream(bytes))
        } catch (e: Exception) {
            error(503)
        } finally {
            c.disconnect()
        }
    }

    companion object {
        fun error(code: Int) =
            WebResourceResponse(
                "text/plain",
                "utf-8",
                code,
                if (code == 404) "Not found" else "Unavailable",
                emptyMap(),
                ByteArrayInputStream(ByteArray(0)),
            )
    }
}

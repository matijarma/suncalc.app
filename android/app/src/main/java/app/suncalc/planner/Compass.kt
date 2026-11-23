package app.suncalc.planner

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.pm.PackageManager
import android.hardware.*
import android.location.*
import android.os.Bundle
import android.os.SystemClock
import android.view.Surface
import kotlin.math.abs
import org.json.JSONObject

internal class Compass(private val a: Activity, private val send: (JSONObject) -> Unit) :
    SensorEventListener, LocationListener {
    private val location = a.getSystemService(Context.LOCATION_SERVICE) as LocationManager
    private val sensors = a.getSystemService(Context.SENSOR_SERVICE) as SensorManager
    private var running = false
    private var fix: Location? = null
    private var heading: Float? = null
    private var lastSent = 0L
    private var reliability = SensorManager.SENSOR_STATUS_ACCURACY_MEDIUM
    private var accel: FloatArray? = null
    private var magnet: FloatArray? = null

    fun allowed() =
        a.checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED ||
            a.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) ==
                PackageManager.PERMISSION_GRANTED

    fun start() {
        stop()
        running = true
        if (!allowed()) {
            send(JSONObject().put("status", "Location permission is needed for your live shadow."))
            return
        }
        val providers = listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)
        val permitted = providers.filter {
            runCatching {
                    location.isProviderEnabled(it) &&
                        (it != LocationManager.GPS_PROVIDER ||
                            a.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) ==
                                PackageManager.PERMISSION_GRANTED)
                }
                .getOrDefault(false)
        }
        if (permitted.isEmpty()) {
            send(JSONObject().put("status", "Turn on device location to see a live shadow."))
            return
        }
        fix =
            permitted
                .mapNotNull { runCatching { location.getLastKnownLocation(it) }.getOrNull() }
                .filter {
                    SystemClock.elapsedRealtimeNanos() - it.elapsedRealtimeNanos in
                        0..600_000_000_000L
                }
                .maxByOrNull { it.elapsedRealtimeNanos }
        permitted.forEach { runCatching { location.requestLocationUpdates(it, 3000L, 3f, this) } }
        val rot = sensors.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR)
        if (rot != null) sensors.registerListener(this, rot, SensorManager.SENSOR_DELAY_UI)
        else
            listOf(Sensor.TYPE_ACCELEROMETER, Sensor.TYPE_MAGNETIC_FIELD).forEach { k ->
                sensors.getDefaultSensor(k)?.let {
                    sensors.registerListener(this, it, SensorManager.SENSOR_DELAY_UI)
                }
            }
        publish()
    }

    fun stop() {
        running = false
        sensors.unregisterListener(this)
        runCatching { location.removeUpdates(this) }
        fix = null
        heading = null
        accel = null
        magnet = null
        lastSent = 0
        reliability = SensorManager.SENSOR_STATUS_ACCURACY_MEDIUM
    }

    override fun onLocationChanged(v: Location) {
        if (running) {
            fix = v
            publish()
        }
    }

    override fun onProviderEnabled(p: String) {}

    override fun onProviderDisabled(p: String) {
        if (running) start()
    }

    @Deprecated("Legacy callback") override fun onStatusChanged(p: String?, s: Int, b: Bundle?) {}

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {
        if (sensor?.type != Sensor.TYPE_ACCELEROMETER) reliability = accuracy
    }

    override fun onSensorChanged(e: SensorEvent) {
        if (!running || fix == null) return
        val m = FloatArray(9)
        when (e.sensor.type) {
            Sensor.TYPE_ROTATION_VECTOR -> SensorManager.getRotationMatrixFromVector(m, e.values)
            else -> {
                if (e.sensor.type == Sensor.TYPE_ACCELEROMETER) accel = e.values.clone()
                else magnet = e.values.clone()
                if (
                    accel == null ||
                        magnet == null ||
                        !SensorManager.getRotationMatrix(m, null, accel, magnet)
                )
                    return
            }
        }
        @Suppress("DEPRECATION") val rotation = a.windowManager.defaultDisplay.rotation
        val axes =
            when (rotation) {
                Surface.ROTATION_90 -> SensorManager.AXIS_Y to SensorManager.AXIS_MINUS_X
                Surface.ROTATION_180 -> SensorManager.AXIS_MINUS_X to SensorManager.AXIS_MINUS_Y
                Surface.ROTATION_270 -> SensorManager.AXIS_MINUS_Y to SensorManager.AXIS_X
                else -> SensorManager.AXIS_X to SensorManager.AXIS_Y
            }
        val remapped = FloatArray(9)
        SensorManager.remapCoordinateSystem(m, axes.first, axes.second, remapped)
        val orientation = SensorManager.getOrientation(remapped, FloatArray(3))
        val loc = fix ?: return
        val reliable =
            reliability >= SensorManager.SENSOR_STATUS_ACCURACY_MEDIUM &&
                abs(orientation[1]) < 0.8 &&
                abs(orientation[2]) < 0.8
        heading =
            if (reliable)
                ((Math.toDegrees(orientation[0].toDouble()).toFloat() +
                    GeomagneticField(
                            loc.latitude.toFloat(),
                            loc.longitude.toFloat(),
                            loc.altitude.toFloat(),
                            System.currentTimeMillis(),
                        )
                        .declination +
                    360) % 360)
            else null
        val tick = SystemClock.elapsedRealtime()
        if (tick - lastSent >= 100) {
            lastSent = tick
            publish()
        }
    }

    private fun publish() {
        val v = fix
        send(
            if (v == null) JSONObject().put("status", "Finding your location…")
            else
                JSONObject()
                    .put("lat", v.latitude)
                    .put("lon", v.longitude)
                    .put("heading", heading ?: JSONObject.NULL),
        )
    }
}

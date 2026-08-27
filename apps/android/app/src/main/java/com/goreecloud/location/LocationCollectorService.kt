package com.goreecloud.location

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.BatteryManager
import android.os.Build
import android.os.IBinder
import java.time.Instant
import java.util.UUID
import java.util.concurrent.Executors

class LocationCollectorService : Service(), LocationListener {
    private lateinit var locationManager: LocationManager
    private lateinit var queue: EncryptedSampleQueue
    private lateinit var api: LocationApiClient
    private val syncExecutor = Executors.newSingleThreadExecutor()
    private val syncGate = SingleFlightSyncGate()
    private var retryAttempt = 0

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        locationManager = getSystemService(LocationManager::class.java)
        queue = EncryptedSampleQueue(this)
        api = LocationApiClient(this)
    }

    override fun onStartCommand(intent: android.content.Intent?, flags: Int, startId: Int): Int {
        if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            stopSelf()
            return START_NOT_STICKY
        }
        if (ProtectedCredentialStore.load(this) == null) {
            RetryJobService.cancel(this)
            stopSelf()
            return START_NOT_STICKY
        }

        startForeground(NOTIFICATION_ID, buildNotification())
        isRunning = true
        pendingSampleCount = queue.pendingCount()
        requestUpdates()
        requestSync()
        return START_STICKY
    }

    private fun requestUpdates() {
        val providers = listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)
        for (provider in providers) {
            if (locationManager.isProviderEnabled(provider)) {
                locationManager.requestLocationUpdates(provider, 15_000L, 10f, this)
            }
        }
    }

    override fun onLocationChanged(location: Location) {
        latestObservedAtMillis = System.currentTimeMillis()
        latestAccuracyMeters = if (location.hasAccuracy()) location.accuracy else null
        latestLatitude = location.latitude
        latestLongitude = location.longitude

        val battery = getSystemService(BatteryManager::class.java)
            .getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
            .takeIf { it in 0..100 }
        val sample = PendingLocationSample(
            clientSampleId = UUID.randomUUID().toString(),
            capturedAt = Instant.ofEpochMilli(location.time).toString(),
            latitude = location.latitude,
            longitude = location.longitude,
            accuracyM = if (location.hasAccuracy()) location.accuracy.toDouble() else null,
            altitudeM = if (location.hasAltitude()) location.altitude else null,
            speedMps = if (location.hasSpeed()) location.speed.toDouble() else null,
            bearingDeg = if (location.hasBearing()) location.bearing.toDouble() else null,
            batteryPercent = battery,
        )

        try {
            queue.enqueue(sample)
            pendingSampleCount = queue.pendingCount()
            syncState = "queued"
            requestSync()
        } catch (_: Exception) {
            syncState = "queue_error"
        }
    }

    private fun requestSync() {
        syncExecutor.execute {
            syncGate.runIfAvailable {
                val result = try {
                    api.syncPending(queue)
                } catch (_: Exception) {
                    pendingSampleCount = queue.pendingCount()
                    syncState = "sync_error"
                    RetryJobService.schedule(this, SyncOutcome.TRANSIENT_SERVER_FAILURE, retryAttempt)
                    retryAttempt = (retryAttempt + 1).coerceAtMost(31)
                    return@runIfAvailable
                }

                pendingSampleCount = result.remaining
                syncState = result.state
                val outcome = when {
                    result.state == "ok" -> SyncOutcome.SUCCESS
                    result.state == "offline" -> SyncOutcome.OFFLINE
                    result.state == "device_auth_required" || result.state == "not_enrolled" ->
                        SyncOutcome.AUTHENTICATION_REVOKED
                    result.state.startsWith("server_5") -> SyncOutcome.TRANSIENT_SERVER_FAILURE
                    else -> SyncOutcome.MALFORMED_LOCAL_RECORD
                }

                if (outcome == SyncOutcome.SUCCESS) retryAttempt = 0
                RetryJobService.schedule(this, outcome, retryAttempt)
                if (outcome == SyncOutcome.OFFLINE || outcome == SyncOutcome.TRANSIENT_SERVER_FAILURE) {
                    retryAttempt = (retryAttempt + 1).coerceAtMost(31)
                }
                if (outcome == SyncOutcome.AUTHENTICATION_REVOKED) stopSelf()
            }
        }
    }

    override fun onDestroy() {
        locationManager.removeUpdates(this)
        syncExecutor.shutdown()
        latestLatitude = null
        latestLongitude = null
        latestAccuracyMeters = null
        latestObservedAtMillis = null
        isRunning = false
        super.onDestroy()
    }

    override fun onBind(intent: android.content.Intent?): IBinder? = null

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(
            NotificationChannel(
                CHANNEL_ID,
                getString(R.string.tracking_channel_name),
                NotificationManager.IMPORTANCE_LOW,
            ),
        )
    }

    private fun buildNotification(): android.app.Notification {
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            android.app.Notification.Builder(this, CHANNEL_ID)
        } else {
            android.app.Notification.Builder(this)
        }
        return builder
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentTitle(getString(R.string.tracking_notification_title))
            .setContentText(getString(R.string.tracking_notification_text))
            .setOngoing(true)
            .build()
    }

    companion object {
        private const val CHANNEL_ID = "goreecloud_location_tracking"
        private const val NOTIFICATION_ID = 4101

        @Volatile var isRunning: Boolean = false
            private set
        @Volatile var latestObservedAtMillis: Long? = null
            private set
        @Volatile var latestLatitude: Double? = null
            private set
        @Volatile var latestLongitude: Double? = null
            private set
        @Volatile var latestAccuracyMeters: Float? = null
            private set
        @Volatile var pendingSampleCount: Int = 0
            private set
        @Volatile var syncState: String = "idle"
            private set
    }
}

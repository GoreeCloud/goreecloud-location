package com.goreecloud.location

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.IBinder

class LocationCollectorService : Service(), LocationListener {
    private lateinit var locationManager: LocationManager

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        locationManager = getSystemService(LocationManager::class.java)
    }

    override fun onStartCommand(intent: android.content.Intent?, flags: Int, startId: Int): Int {
        if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            stopSelf()
            return START_NOT_STICKY
        }

        startForeground(NOTIFICATION_ID, buildNotification())
        isRunning = true
        requestUpdates()
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
        // Coordinates are intentionally retained only in process memory for this foundation slice.
        latestLatitude = location.latitude
        latestLongitude = location.longitude
    }

    override fun onDestroy() {
        locationManager.removeUpdates(this)
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
    }
}

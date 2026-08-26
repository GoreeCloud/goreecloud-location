package com.goreecloud.location

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Typeface
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

class MainActivity : Activity() {
    private lateinit var statusText: TextView
    private lateinit var detailText: TextView
    private lateinit var toggleButton: Button

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(buildContent())
        renderState()
    }

    override fun onResume() {
        super.onResume()
        renderState()
    }

    private fun buildContent(): View {
        val density = resources.displayMetrics.density
        fun dp(value: Int) = (value * density).toInt()

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(dp(24), dp(56), dp(24), dp(32))
            setBackgroundColor(0xFFF5F7FA.toInt())
        }

        root.addView(TextView(this).apply {
            text = "GoreeCloud Location"
            textSize = 14f
            setTypeface(typeface, Typeface.BOLD)
            setTextColor(0xFF52606D.toInt())
        })

        root.addView(TextView(this).apply {
            text = "Private location collection, visible and under your control."
            textSize = 28f
            setTypeface(typeface, Typeface.BOLD)
            setTextColor(0xFF18202A.toInt())
            setPadding(0, dp(14), 0, dp(12))
        })

        root.addView(TextView(this).apply {
            text = "This development client uses Android's native location APIs and a required foreground service. It does not hide tracking indicators, persist precise coordinates, or upload location until the protected device-authenticated sync path is implemented."
            textSize = 16f
            setTextColor(0xFF52606D.toInt())
        })

        statusText = TextView(this).apply {
            textSize = 18f
            setTypeface(typeface, Typeface.BOLD)
            setPadding(0, dp(28), 0, dp(6))
            setTextColor(0xFF18202A.toInt())
        }
        root.addView(statusText)

        detailText = TextView(this).apply {
            textSize = 15f
            setTextColor(0xFF667788.toInt())
            setPadding(0, 0, 0, dp(24))
        }
        root.addView(detailText)

        toggleButton = Button(this).apply {
            setOnClickListener { toggleTracking() }
        }
        root.addView(toggleButton, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT,
        ))

        root.addView(TextView(this).apply {
            text = "Development boundary: location samples currently remain memory-only in the collector process. Durable offline queueing and server synchronization stay disabled until encrypted storage and device-credential handling are implemented and reviewed."
            textSize = 13f
            setTextColor(0xFF788694.toInt())
            setPadding(0, dp(24), 0, 0)
        })

        return root
    }

    private fun toggleTracking() {
        if (LocationCollectorService.isRunning) {
            stopService(Intent(this, LocationCollectorService::class.java))
            renderState()
            return
        }

        val missing = requiredRuntimePermissions().filter {
            checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED
        }
        if (missing.isNotEmpty()) {
            requestPermissions(missing.toTypedArray(), REQUEST_LOCATION_PERMISSIONS)
            return
        }
        startCollector()
    }

    private fun startCollector() {
        val intent = Intent(this, LocationCollectorService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
        renderState()
    }

    private fun requiredRuntimePermissions(): List<String> = buildList {
        add(Manifest.permission.ACCESS_FINE_LOCATION)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            add(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQUEST_LOCATION_PERMISSIONS &&
            grantResults.isNotEmpty() &&
            grantResults.all { it == PackageManager.PERMISSION_GRANTED }
        ) {
            startCollector()
        } else {
            renderState("Location permission is required before collection can start.")
        }
    }

    private fun renderState(message: String? = null) {
        val running = LocationCollectorService.isRunning
        statusText.text = if (running) "Tracking is active" else "Tracking is stopped"
        val sampleAge = LocationCollectorService.latestObservedAtMillis
        detailText.text = message ?: if (running) {
            if (sampleAge == null) {
                "Foreground collector active. Waiting for a location observation."
            } else {
                val seconds = ((System.currentTimeMillis() - sampleAge).coerceAtLeast(0L) / 1000L)
                "Latest in-memory observation received ${seconds}s ago."
            }
        } else {
            "No location collection is running."
        }
        toggleButton.text = if (running) "Stop tracking" else "Start tracking"
    }

    companion object {
        private const val REQUEST_LOCATION_PERMISSIONS = 1001
    }
}

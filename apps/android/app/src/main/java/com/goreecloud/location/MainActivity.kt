package com.goreecloud.location

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Typeface
import android.os.Build
import android.os.Bundle
import android.text.InputType
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import java.util.concurrent.Executors

class MainActivity : Activity() {
    private lateinit var statusText: TextView
    private lateinit var detailText: TextView
    private lateinit var enrollmentText: TextView
    private lateinit var apiUrlInput: EditText
    private lateinit var userCredentialInput: EditText
    private lateinit var enrollButton: Button
    private lateinit var toggleButton: Button
    private lateinit var syncButton: Button
    private lateinit var forgetButton: Button
    private val networkExecutor = Executors.newSingleThreadExecutor()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(buildContent())
        renderState()
    }

    override fun onResume() {
        super.onResume()
        renderState()
    }

    override fun onDestroy() {
        networkExecutor.shutdown()
        super.onDestroy()
    }

    private fun buildContent(): View {
        val density = resources.displayMetrics.density
        fun dp(value: Int) = (value * density).toInt()

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(dp(24), dp(44), dp(24), dp(32))
            setBackgroundColor(0xFFF5F7FA.toInt())
        }

        root.addView(TextView(this).apply {
            text = "GoreeCloud Location"
            textSize = 14f
            setTypeface(typeface, Typeface.BOLD)
            setTextColor(0xFF52606D.toInt())
        })
        root.addView(TextView(this).apply {
            text = "Protected native tracking."
            textSize = 28f
            setTypeface(typeface, Typeface.BOLD)
            setTextColor(0xFF18202A.toInt())
            setPadding(0, dp(14), 0, dp(10))
        })
        root.addView(TextView(this).apply {
            text = "Enroll this device once, then GoreeCloud Location protects the device credential with Android Keystore and stores pending precise samples only as AES-GCM encrypted queue records."
            textSize = 15f
            setTextColor(0xFF52606D.toInt())
            setPadding(0, 0, 0, dp(18))
        })

        enrollmentText = TextView(this).apply {
            textSize = 16f
            setTypeface(typeface, Typeface.BOLD)
            setTextColor(0xFF18202A.toInt())
        }
        root.addView(enrollmentText)

        apiUrlInput = EditText(this).apply {
            hint = "https://location.example.test"
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI
            setSingleLine(true)
            setText(LocationApiClient(this@MainActivity).loadBaseUrl())
        }
        root.addView(apiUrlInput, fullWidth())

        userCredentialInput = EditText(this).apply {
            hint = "One-time user credential (loc_usr_…)"
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
            setSingleLine(true)
        }
        root.addView(userCredentialInput, fullWidth())

        enrollButton = Button(this).apply {
            text = "Enroll this device"
            setOnClickListener { enrollDevice() }
        }
        root.addView(enrollButton, fullWidth())

        statusText = TextView(this).apply {
            textSize = 18f
            setTypeface(typeface, Typeface.BOLD)
            setPadding(0, dp(22), 0, dp(6))
            setTextColor(0xFF18202A.toInt())
        }
        root.addView(statusText)

        detailText = TextView(this).apply {
            textSize = 14f
            setTextColor(0xFF667788.toInt())
            setPadding(0, 0, 0, dp(16))
        }
        root.addView(detailText)

        toggleButton = Button(this).apply { setOnClickListener { toggleTracking() } }
        root.addView(toggleButton, fullWidth())

        syncButton = Button(this).apply {
            text = "Sync encrypted queue"
            setOnClickListener { syncQueue() }
        }
        root.addView(syncButton, fullWidth())

        forgetButton = Button(this).apply {
            text = "Forget device credential"
            setOnClickListener {
                stopService(Intent(this@MainActivity, LocationCollectorService::class.java))
                ProtectedCredentialStore.clear(this@MainActivity)
                renderState("Protected device credential removed from this installation.")
            }
        }
        root.addView(forgetButton, fullWidth())

        root.addView(TextView(this).apply {
            text = "Security boundary: the user credential is never persisted by this screen. Local HTTP is accepted only for emulator/localhost development; other endpoints require HTTPS. Pending coordinates remain encrypted at rest until acknowledged by the server."
            textSize = 12f
            setTextColor(0xFF788694.toInt())
            setPadding(0, dp(20), 0, 0)
        })
        return root
    }

    private fun fullWidth() = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        LinearLayout.LayoutParams.WRAP_CONTENT,
    )

    private fun enrollDevice() {
        val baseUrl = apiUrlInput.text.toString()
        val userToken = userCredentialInput.text.toString().trim()
        userCredentialInput.text.clear()
        if (userToken.isBlank()) {
            renderState("A one-time user credential is required for enrollment.")
            return
        }
        enrollButton.isEnabled = false
        networkExecutor.execute {
            try {
                val api = LocationApiClient(this)
                api.saveBaseUrl(baseUrl)
                val result = api.enrollDevice(userToken, Build.MODEL.ifBlank { "Android device" })
                ProtectedCredentialStore.save(this, DeviceCredential(result.deviceId, result.credential))
                runOnUiThread { renderState("Device enrollment completed and the device credential is protected by Android Keystore.") }
            } catch (error: Exception) {
                runOnUiThread { renderState("Enrollment failed: ${safeError(error)}") }
            } finally {
                runOnUiThread { enrollButton.isEnabled = true }
            }
        }
    }

    private fun syncQueue() {
        syncButton.isEnabled = false
        networkExecutor.execute {
            try {
                val api = LocationApiClient(this)
                api.saveBaseUrl(apiUrlInput.text.toString())
                val result = api.syncPending(EncryptedSampleQueue(this))
                runOnUiThread { renderState("Sync state: ${result.state}; uploaded ${result.uploaded}; ${result.remaining} remain encrypted.") }
            } catch (error: Exception) {
                runOnUiThread { renderState("Sync failed: ${safeError(error)}") }
            } finally {
                runOnUiThread { syncButton.isEnabled = true }
            }
        }
    }

    private fun toggleTracking() {
        if (LocationCollectorService.isRunning) {
            stopService(Intent(this, LocationCollectorService::class.java))
            renderState()
            return
        }
        if (ProtectedCredentialStore.load(this) == null) {
            renderState("Enroll this device before starting tracking.")
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
        try {
            LocationApiClient(this).saveBaseUrl(apiUrlInput.text.toString())
        } catch (error: Exception) {
            renderState(safeError(error))
            return
        }
        val intent = Intent(this, LocationCollectorService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(intent) else startService(intent)
        renderState()
    }

    private fun requiredRuntimePermissions(): List<String> = buildList {
        add(Manifest.permission.ACCESS_FINE_LOCATION)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) add(Manifest.permission.POST_NOTIFICATIONS)
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQUEST_LOCATION_PERMISSIONS && grantResults.isNotEmpty() &&
            grantResults.all { it == PackageManager.PERMISSION_GRANTED }
        ) {
            startCollector()
        } else {
            renderState("Location permission is required before collection can start.")
        }
    }

    private fun renderState(message: String? = null) {
        val enrolled = ProtectedCredentialStore.load(this) != null
        val queueCount = EncryptedSampleQueue(this).pendingCount()
        enrollmentText.text = if (enrolled) "Device enrolled • credential protected" else "Device not enrolled"
        val running = LocationCollectorService.isRunning
        statusText.text = if (running) "Tracking is active" else "Tracking is stopped"
        val sampleAge = LocationCollectorService.latestObservedAtMillis
        detailText.text = message ?: if (running) {
            val observation = if (sampleAge == null) "waiting for a location observation" else {
                val seconds = ((System.currentTimeMillis() - sampleAge).coerceAtLeast(0L) / 1000L)
                "latest observation ${seconds}s ago"
            }
            "$observation • ${LocationCollectorService.pendingSampleCount} encrypted pending • sync ${LocationCollectorService.syncState}"
        } else {
            "$queueCount encrypted sample(s) pending."
        }
        toggleButton.text = if (running) "Stop tracking" else "Start tracking"
        toggleButton.isEnabled = enrolled
        syncButton.isEnabled = enrolled
        forgetButton.isEnabled = enrolled
    }

    private fun safeError(error: Exception): String = when (error) {
        is ApiException -> error.apiError ?: "server returned ${error.statusCode}"
        is IllegalArgumentException -> error.message ?: "invalid configuration"
        else -> "request could not be completed"
    }

    companion object {
        private const val REQUEST_LOCATION_PERMISSIONS = 1001
    }
}

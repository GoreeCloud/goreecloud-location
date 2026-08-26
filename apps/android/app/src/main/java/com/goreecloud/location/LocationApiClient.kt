package com.goreecloud.location

import android.content.Context
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL

data class EnrollmentResult(val deviceId: String, val credential: String)
data class SyncResult(val uploaded: Int, val remaining: Int, val state: String)

class LocationApiClient(private val context: Context) {
    fun saveBaseUrl(value: String) {
        val normalized = normalizeBaseUrl(value)
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(BASE_URL, normalized).apply()
    }

    fun loadBaseUrl(): String = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        .getString(BASE_URL, "") ?: ""

    fun enrollDevice(userToken: String, displayName: String): EnrollmentResult {
        require(userToken.startsWith("loc_usr_")) { "invalid user credential" }
        val body = JSONObject()
            .put("display_name", displayName.trim().take(100))
            .put("device_class", "phone")
        val response = request("POST", "/api/v1/devices", userToken, body)
        if (response.code != 201) throw ApiException(response.code, response.errorCode())
        val json = JSONObject(response.body)
        val device = json.getJSONObject("device")
        return EnrollmentResult(device.getString("id"), json.getString("credential"))
    }

    fun syncPending(queue: EncryptedSampleQueue): SyncResult {
        val credential = ProtectedCredentialStore.load(context)
            ?: return SyncResult(0, queue.pendingCount(), "not_enrolled")
        var uploaded = 0
        for (queued in queue.pending()) {
            val response = try {
                request("POST", "/api/v1/locations", credential.token, sampleJson(queued.sample))
            } catch (_: IOException) {
                return SyncResult(uploaded, queue.pendingCount(), "offline")
            }
            when (response.code) {
                200, 201 -> {
                    queue.acknowledge(queued)
                    uploaded += 1
                }
                401 -> {
                    ProtectedCredentialStore.clear(context)
                    return SyncResult(uploaded, queue.pendingCount(), "device_auth_required")
                }
                409 -> {
                    return SyncResult(uploaded, queue.pendingCount(), response.errorCode() ?: "conflict")
                }
                else -> return SyncResult(uploaded, queue.pendingCount(), "server_${response.code}")
            }
        }
        return SyncResult(uploaded, queue.pendingCount(), "ok")
    }

    private fun request(method: String, path: String, token: String, body: JSONObject): ApiResponse {
        val baseUrl = loadBaseUrl()
        require(baseUrl.isNotBlank()) { "API base URL is not configured" }
        val connection = (URL(baseUrl + path).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 10_000
            readTimeout = 15_000
            doOutput = true
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Content-Type", "application/json")
            setRequestProperty("Authorization", "Bearer $token")
        }
        connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
        val code = connection.responseCode
        val stream = if (code in 200..299) connection.inputStream else connection.errorStream
        val responseBody = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() } ?: ""
        connection.disconnect()
        return ApiResponse(code, responseBody)
    }

    private fun sampleJson(sample: PendingLocationSample): JSONObject = JSONObject()
        .put("client_sample_id", sample.clientSampleId)
        .put("captured_at", sample.capturedAt)
        .put("latitude", sample.latitude)
        .put("longitude", sample.longitude)
        .apply {
            sample.accuracyM?.let { put("accuracy_m", it) }
            sample.altitudeM?.let { put("altitude_m", it) }
            sample.speedMps?.let { put("speed_mps", it) }
            sample.bearingDeg?.let { put("bearing_deg", it) }
            sample.batteryPercent?.let { put("battery_percent", it) }
        }

    companion object {
        private const val PREFS = "goreecloud_location_api"
        private const val BASE_URL = "base_url"

        fun normalizeBaseUrl(value: String): String {
            val trimmed = value.trim().removeSuffix("/")
            require(trimmed.isNotBlank()) { "API URL is required" }
            val uri = URI(trimmed)
            val scheme = uri.scheme?.lowercase()
            require(scheme == "https" || isDevelopmentHttp(uri)) {
                "HTTPS is required except for local emulator development"
            }
            require(!uri.host.isNullOrBlank()) { "API URL must include a host" }
            require(uri.rawQuery == null && uri.rawFragment == null) { "API URL cannot include query or fragment" }
            return trimmed
        }

        private fun isDevelopmentHttp(uri: URI): Boolean {
            if (!uri.scheme.equals("http", ignoreCase = true)) return false
            return uri.host == "10.0.2.2" || uri.host == "127.0.0.1" || uri.host == "localhost"
        }
    }
}

private data class ApiResponse(val code: Int, val body: String) {
    fun errorCode(): String? = try {
        if (body.isBlank()) null else JSONObject(body).optString("error").ifBlank { null }
    } catch (_: Exception) {
        null
    }
}

class ApiException(val statusCode: Int, val apiError: String?) : Exception(apiError ?: "HTTP $statusCode")

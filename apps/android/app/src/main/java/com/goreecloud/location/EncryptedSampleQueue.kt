package com.goreecloud.location

import android.content.Context
import org.json.JSONObject
import java.io.File

data class PendingLocationSample(
    val clientSampleId: String,
    val capturedAt: String,
    val latitude: Double,
    val longitude: Double,
    val accuracyM: Double?,
    val altitudeM: Double?,
    val speedMps: Double?,
    val bearingDeg: Double?,
    val batteryPercent: Int?,
)

data class QueuedSample(val file: File, val sample: PendingLocationSample)

class EncryptedSampleQueue(private val context: Context) {
    private val directory = File(context.filesDir, "location-sample-queue")

    fun enqueue(sample: PendingLocationSample) {
        if (!directory.exists() && !directory.mkdirs()) {
            throw IllegalStateException("unable to create protected sample queue")
        }
        val plaintext = toJson(sample).toString().toByteArray(Charsets.UTF_8)
        val encoded = KeystoreAesGcm.encrypt(KEY_ALIAS, plaintext)
        val temporary = File(directory, ".${sample.clientSampleId}.tmp")
        val target = File(directory, "${sample.clientSampleId}.enc")
        temporary.writeText(encoded, Charsets.UTF_8)
        if (!temporary.renameTo(target)) {
            temporary.delete()
            throw IllegalStateException("unable to commit protected sample")
        }
    }

    fun pending(): List<QueuedSample> {
        if (!directory.exists()) return emptyList()
        val result = mutableListOf<QueuedSample>()
        directory.listFiles { file -> file.isFile && file.name.endsWith(".enc") }
            ?.forEach { file ->
                try {
                    val plaintext = KeystoreAesGcm.decrypt(KEY_ALIAS, file.readText(Charsets.UTF_8))
                    result += QueuedSample(file, fromJson(JSONObject(plaintext.toString(Charsets.UTF_8))))
                } catch (_: Exception) {
                    file.renameTo(File(directory, file.name.removeSuffix(".enc") + ".corrupt"))
                }
            }
        return result.sortedBy { it.sample.capturedAt }
    }

    fun acknowledge(queued: QueuedSample) {
        if (!queued.file.delete() && queued.file.exists()) {
            throw IllegalStateException("unable to remove acknowledged sample")
        }
    }

    fun pendingCount(): Int = directory.listFiles { file -> file.isFile && file.name.endsWith(".enc") }?.size ?: 0

    private fun toJson(sample: PendingLocationSample): JSONObject = JSONObject()
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

    private fun fromJson(json: JSONObject) = PendingLocationSample(
        clientSampleId = json.getString("client_sample_id"),
        capturedAt = json.getString("captured_at"),
        latitude = json.getDouble("latitude"),
        longitude = json.getDouble("longitude"),
        accuracyM = json.optDoubleOrNull("accuracy_m"),
        altitudeM = json.optDoubleOrNull("altitude_m"),
        speedMps = json.optDoubleOrNull("speed_mps"),
        bearingDeg = json.optDoubleOrNull("bearing_deg"),
        batteryPercent = if (json.has("battery_percent")) json.getInt("battery_percent") else null,
    )

    companion object {
        private const val KEY_ALIAS = "goreecloud_location_sample_queue_v1"
    }
}

private fun JSONObject.optDoubleOrNull(name: String): Double? =
    if (has(name) && !isNull(name)) getDouble(name) else null

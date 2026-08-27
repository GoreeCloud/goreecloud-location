package com.goreecloud.location

data class TrackingDiagnostics(
    val collectionProfile: String,
    val intervalSeconds: Long,
    val distanceMeters: Float,
    val encryptedPendingSamples: Int,
    val syncState: String,
) {
    fun summary(): String {
        val collection = if (intervalSeconds > 0L && distanceMeters > 0f) {
            "$collectionProfile • ${intervalSeconds}s / ${formatDistance(distanceMeters)}m"
        } else {
            "Collection inactive"
        }
        return "$collection • $encryptedPendingSamples encrypted pending • sync ${safeSyncState(syncState)}"
    }

    companion object {
        private fun formatDistance(value: Float): String =
            if (value % 1f == 0f) value.toInt().toString() else value.toString()

        private fun safeSyncState(value: String): String = when (value) {
            "idle", "queued", "ok", "offline", "sync_error", "queue_error",
            "device_auth_required", "not_enrolled" -> value
            else -> if (value.startsWith("server_5")) "server_error" else "attention"
        }
    }
}

package com.goreecloud.location

data class CollectionProfile(
    val id: String,
    val label: String,
    val minTimeMs: Long,
    val minDistanceM: Float,
)

/**
 * Battery-aware collection policy that can only reduce collection frequency from the
 * established balanced baseline. It never increases sampling beyond 15 seconds / 10 metres.
 */
object CollectionProfilePolicy {
    val BALANCED = CollectionProfile(
        id = "balanced",
        label = "Balanced",
        minTimeMs = 15_000L,
        minDistanceM = 10f,
    )
    val CONSERVE = CollectionProfile(
        id = "conserve",
        label = "Battery conserve",
        minTimeMs = 45_000L,
        minDistanceM = 20f,
    )
    val CRITICAL = CollectionProfile(
        id = "critical",
        label = "Critical battery conserve",
        minTimeMs = 120_000L,
        minDistanceM = 50f,
    )

    fun forBattery(percent: Int?): CollectionProfile = when {
        percent == null -> BALANCED
        percent <= 15 -> CRITICAL
        percent <= 35 -> CONSERVE
        else -> BALANCED
    }
}

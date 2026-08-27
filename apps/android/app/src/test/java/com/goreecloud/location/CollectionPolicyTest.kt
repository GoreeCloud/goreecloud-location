package com.goreecloud.location

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CollectionPolicyTest {
    @Test
    fun batteryPolicyNeverExceedsBalancedCollectionRate() {
        val profiles = listOf(
            CollectionProfilePolicy.forBattery(null),
            CollectionProfilePolicy.forBattery(100),
            CollectionProfilePolicy.forBattery(35),
            CollectionProfilePolicy.forBattery(15),
            CollectionProfilePolicy.forBattery(1),
        )

        profiles.forEach { profile ->
            assertTrue(profile.minTimeMs >= CollectionProfilePolicy.BALANCED.minTimeMs)
            assertTrue(profile.minDistanceM >= CollectionProfilePolicy.BALANCED.minDistanceM)
        }
    }

    @Test
    fun batteryThresholdsSelectExpectedProfiles() {
        assertEquals("balanced", CollectionProfilePolicy.forBattery(null).id)
        assertEquals("balanced", CollectionProfilePolicy.forBattery(36).id)
        assertEquals("conserve", CollectionProfilePolicy.forBattery(35).id)
        assertEquals("conserve", CollectionProfilePolicy.forBattery(16).id)
        assertEquals("critical", CollectionProfilePolicy.forBattery(15).id)
    }

    @Test
    fun diagnosticsDoNotContainCoordinatesOrCredentials() {
        val diagnostics = TrackingDiagnostics(
            collectionProfile = "Battery conserve",
            intervalSeconds = 45,
            distanceMeters = 20f,
            encryptedPendingSamples = 3,
            syncState = "offline",
        ).summary()

        assertEquals(
            "Battery conserve • 45s / 20m • 3 encrypted pending • sync offline",
            diagnostics,
        )
    }

    @Test
    fun unknownSyncStateIsReducedToAttention() {
        val diagnostics = TrackingDiagnostics(
            collectionProfile = "Balanced",
            intervalSeconds = 15,
            distanceMeters = 10f,
            encryptedPendingSamples = 1,
            syncState = "unexpected_private_backend_detail",
        ).summary()

        assertEquals("Balanced • 15s / 10m • 1 encrypted pending • sync attention", diagnostics)
    }
}

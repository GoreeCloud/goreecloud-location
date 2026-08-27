package com.goreecloud.location

import java.util.concurrent.atomic.AtomicBoolean

/** Prevents overlapping queue flushes without inspecting or copying queued sample data. */
class SingleFlightSyncGate {
    private val running = AtomicBoolean(false)

    fun tryEnter(): Boolean = running.compareAndSet(false, true)

    fun leave() {
        running.set(false)
    }

    inline fun <T> runIfAvailable(block: () -> T): T? {
        if (!tryEnter()) return null
        return try {
            block()
        } finally {
            leave()
        }
    }
}

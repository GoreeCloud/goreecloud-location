package com.goreecloud.location

/**
 * Privacy-preserving retry decisions for the Android collector.
 *
 * This policy never carries coordinates, credentials, host data, or sample payloads. It
 * decides only whether an already-encrypted queued sample may be retried and how long a
 * retry should be deferred. The queue remains authoritative for client_sample_id identity.
 */
enum class SyncOutcome {
    SUCCESS,
    OFFLINE,
    TRANSIENT_SERVER_FAILURE,
    AUTHENTICATION_REVOKED,
    TRACKING_PAUSED,
    MALFORMED_LOCAL_RECORD,
}

data class RetryDecision(
    val shouldRetry: Boolean,
    val delayMs: Long?,
    val reason: String,
)

object SyncRetryPolicy {
    private const val BASE_DELAY_MS = 30_000L
    private const val MAX_DELAY_MS = 30 * 60_000L
    private const val MAX_EXPONENT = 6

    fun decide(outcome: SyncOutcome, attempt: Int): RetryDecision {
        require(attempt >= 0) { "attempt must not be negative" }

        return when (outcome) {
            SyncOutcome.OFFLINE -> retry("offline", attempt)
            SyncOutcome.TRANSIENT_SERVER_FAILURE -> retry("transient-server-failure", attempt)
            SyncOutcome.SUCCESS -> stop("success")
            SyncOutcome.AUTHENTICATION_REVOKED -> stop("authentication-revoked")
            SyncOutcome.TRACKING_PAUSED -> stop("tracking-paused")
            SyncOutcome.MALFORMED_LOCAL_RECORD -> stop("malformed-local-record")
        }
    }

    private fun retry(reason: String, attempt: Int): RetryDecision {
        val exponent = attempt.coerceAtMost(MAX_EXPONENT)
        val delay = (BASE_DELAY_MS * (1L shl exponent)).coerceAtMost(MAX_DELAY_MS)
        return RetryDecision(shouldRetry = true, delayMs = delay, reason = reason)
    }

    private fun stop(reason: String) =
        RetryDecision(shouldRetry = false, delayMs = null, reason = reason)
}

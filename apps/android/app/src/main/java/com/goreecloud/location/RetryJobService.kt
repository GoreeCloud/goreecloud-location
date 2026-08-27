package com.goreecloud.location

import android.app.job.JobInfo
import android.app.job.JobParameters
import android.app.job.JobScheduler
import android.app.job.JobService
import android.content.ComponentName
import android.content.Context
import android.os.PersistableBundle
import java.util.concurrent.Executors

/**
 * Android JobScheduler bridge for retrying only already-encrypted queued samples.
 *
 * This service never starts location collection. It refuses to run without current protected
 * enrollment credentials and carries only retry-attempt metadata in JobScheduler extras.
 */
class RetryJobService : JobService() {
    private val executor = Executors.newSingleThreadExecutor()

    override fun onStartJob(params: JobParameters): Boolean {
        val attempt = params.extras.getInt(EXTRA_ATTEMPT, 0).coerceAtLeast(0)
        executor.execute {
            val credential = ProtectedCredentialStore.load(this)
            if (credential == null) {
                jobFinished(params, false)
                return@execute
            }

            val queue = EncryptedSampleQueue(this)
            if (queue.pendingCount() == 0) {
                jobFinished(params, false)
                return@execute
            }

            val result = try {
                LocationApiClient(this).syncPending(queue)
            } catch (_: Exception) {
                schedule(this, SyncOutcome.TRANSIENT_SERVER_FAILURE, attempt + 1)
                jobFinished(params, false)
                return@execute
            }

            val outcome = when {
                result.state == "ok" -> SyncOutcome.SUCCESS
                result.state == "offline" -> SyncOutcome.OFFLINE
                result.state == "device_auth_required" || result.state == "not_enrolled" ->
                    SyncOutcome.AUTHENTICATION_REVOKED
                result.state.startsWith("server_5") -> SyncOutcome.TRANSIENT_SERVER_FAILURE
                else -> SyncOutcome.MALFORMED_LOCAL_RECORD
            }

            schedule(this, outcome, attempt + 1)
            jobFinished(params, false)
        }
        return true
    }

    override fun onStopJob(params: JobParameters): Boolean = false

    override fun onDestroy() {
        executor.shutdown()
        super.onDestroy()
    }

    companion object {
        private const val JOB_ID = 4102
        private const val EXTRA_ATTEMPT = "retry_attempt"

        fun schedule(context: Context, outcome: SyncOutcome, attempt: Int) {
            val decision = SyncRetryPolicy.decide(outcome, attempt.coerceAtLeast(0))
            val scheduler = context.getSystemService(JobScheduler::class.java)
            if (!decision.shouldRetry || decision.delayMs == null) {
                scheduler.cancel(JOB_ID)
                return
            }

            val extras = PersistableBundle().apply {
                putInt(EXTRA_ATTEMPT, attempt.coerceAtLeast(0))
            }
            val job = JobInfo.Builder(
                JOB_ID,
                ComponentName(context, RetryJobService::class.java),
            )
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                .setMinimumLatency(decision.delayMs)
                .setBackoffCriteria(decision.delayMs, JobInfo.BACKOFF_POLICY_EXPONENTIAL)
                .setExtras(extras)
                .build()
            scheduler.schedule(job)
        }

        fun cancel(context: Context) {
            context.getSystemService(JobScheduler::class.java).cancel(JOB_ID)
        }
    }
}

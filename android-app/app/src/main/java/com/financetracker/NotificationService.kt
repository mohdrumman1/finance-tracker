package com.financetracker

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.format.DateTimeFormatter

private const val TAG = "NotificationService"

class NotificationService : NotificationListenerService() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private lateinit var prefs: Prefs

    override fun onCreate() {
        super.onCreate()
        prefs = Prefs(applicationContext)
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        val packageName = sbn.packageName ?: return

        // Only process notifications from watched payment apps
        if (packageName !in NotificationParser.WATCHED_PACKAGES) return

        val extras = sbn.notification?.extras ?: return
        val title = extras.getCharSequence("android.title")?.toString()
        val text = extras.getCharSequence("android.text")?.toString()

        Log.d(TAG, "Notification from $packageName — title: $title | text: $text")

        val parsed = NotificationParser.parse(packageName, title, text)
        if (parsed == null) {
            Log.d(TAG, "No transaction matched in notification from $packageName")
            return
        }

        if (!prefs.isConfigured()) {
            Log.w(TAG, "Settings not configured — skipping webhook post")
            return
        }

        scope.launch {
            val result = WebhookClient.post(
                serverUrl = prefs.serverUrl,
                apiKey = prefs.apiKey,
                accountId = prefs.accountId,
                transaction = parsed,
            )

            val summary = when (result) {
                is WebhookResult.Success ->
                    "Sent: ${parsed.descriptionRaw} \$${parsed.amount} at ${formatNow()}"
                is WebhookResult.Duplicate ->
                    "Duplicate (existing: ${result.existingId})"
                is WebhookResult.Failure ->
                    "Failed: ${result.message}"
            }

            prefs.lastTx = "$packageName | $summary"
            Log.i(TAG, summary)
        }
    }

    private fun formatNow(): String =
        DateTimeFormatter.ISO_INSTANT.format(Instant.now())
}

package com.financetracker

import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

private const val TAG = "WebhookClient"
private val JSON = "application/json; charset=utf-8".toMediaType()

sealed class WebhookResult {
    data class Success(val statusCode: Int, val body: String) : WebhookResult()
    data class Duplicate(val existingId: String) : WebhookResult()
    data class Failure(val message: String) : WebhookResult()
}

object WebhookClient {
    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    suspend fun post(
        serverUrl: String,
        apiKey: String,
        accountId: String,
        transaction: ParsedTransaction,
    ): WebhookResult = withContext(Dispatchers.IO) {
        val payload = buildJsonPayload(accountId, transaction)
        val url = "$serverUrl/api/webhooks/transaction"

        val request = Request.Builder()
            .url(url)
            .addHeader("Authorization", "Bearer $apiKey")
            .addHeader("Content-Type", "application/json")
            .post(payload.toRequestBody(JSON))
            .build()

        return@withContext try {
            client.newCall(request).execute().use { response ->
                val body = response.body?.string() ?: ""
                Log.d(TAG, "POST $url → ${response.code}: $body")
                when {
                    response.isSuccessful -> WebhookResult.Success(response.code, body)
                    response.code == 409 -> {
                        val id = extractField(body, "existingId") ?: ""
                        WebhookResult.Duplicate(id)
                    }
                    else -> WebhookResult.Failure("HTTP ${response.code}: $body")
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Webhook POST failed", e)
            WebhookResult.Failure(e.message ?: "Network error")
        }
    }

    private fun buildJsonPayload(accountId: String, tx: ParsedTransaction): String {
        val escapedDesc = tx.descriptionRaw.replace("\"", "\\\"")
        return """
            {
              "accountId": "$accountId",
              "transactionDate": "${tx.transactionDate}",
              "descriptionRaw": "$escapedDesc",
              "amount": ${tx.amount},
              "direction": "${tx.direction}",
              "currency": "AUD"
            }
        """.trimIndent()
    }

    // Minimal JSON field extractor — avoids pulling in a JSON library
    private fun extractField(json: String, field: String): String? {
        val pattern = Regex(""""$field"\s*:\s*"([^"]+)"""")
        return pattern.find(json)?.groupValues?.get(1)
    }
}

package com.financetracker

import android.content.Context
import androidx.core.content.edit

private const val PREF_FILE = "finance_tracker_prefs"
private const val KEY_SERVER_URL = "server_url"
private const val KEY_API_KEY = "api_key"
private const val KEY_ACCOUNT_ID = "account_id"
private const val KEY_LAST_TX = "last_tx"

class Prefs(context: Context) {
    private val prefs = context.getSharedPreferences(PREF_FILE, Context.MODE_PRIVATE)

    var serverUrl: String
        get() = prefs.getString(KEY_SERVER_URL, "") ?: ""
        set(value) = prefs.edit { putString(KEY_SERVER_URL, value.trimEnd('/')) }

    var apiKey: String
        get() = prefs.getString(KEY_API_KEY, "") ?: ""
        set(value) = prefs.edit { putString(KEY_API_KEY, value.trim()) }

    var accountId: String
        get() = prefs.getString(KEY_ACCOUNT_ID, "") ?: ""
        set(value) = prefs.edit { putString(KEY_ACCOUNT_ID, value.trim()) }

    var lastTx: String
        get() = prefs.getString(KEY_LAST_TX, "") ?: ""
        set(value) = prefs.edit { putString(KEY_LAST_TX, value) }

    fun isConfigured(): Boolean = serverUrl.isNotEmpty() && apiKey.isNotEmpty() && accountId.isNotEmpty()
}

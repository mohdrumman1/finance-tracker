package com.financetracker

import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.text.TextUtils
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.financetracker.databinding.ActivityMainBinding
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var prefs: Prefs

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        prefs = Prefs(this)

        // Populate saved settings
        binding.etServerUrl.setText(prefs.serverUrl)
        binding.etApiKey.setText(prefs.apiKey)
        binding.etAccountId.setText(prefs.accountId)

        binding.btnSave.setOnClickListener { saveSettings() }
        binding.btnTest.setOnClickListener { testConnection() }
        binding.btnGrantAccess.setOnClickListener { openNotificationSettings() }
    }

    override fun onResume() {
        super.onResume()
        updateStatus()
    }

    private fun saveSettings() {
        val url = binding.etServerUrl.text?.toString()?.trim() ?: ""
        val key = binding.etApiKey.text?.toString()?.trim() ?: ""
        val account = binding.etAccountId.text?.toString()?.trim() ?: ""

        if (url.isEmpty() || key.isEmpty() || account.isEmpty()) {
            Toast.makeText(this, "All fields are required", Toast.LENGTH_SHORT).show()
            return
        }

        prefs.serverUrl = url
        prefs.apiKey = key
        prefs.accountId = account

        Toast.makeText(this, "Settings saved", Toast.LENGTH_SHORT).show()
        updateStatus()
    }

    private fun testConnection() {
        val url = binding.etServerUrl.text?.toString()?.trim() ?: ""
        val key = binding.etApiKey.text?.toString()?.trim() ?: ""
        val account = binding.etAccountId.text?.toString()?.trim() ?: ""

        if (url.isEmpty() || key.isEmpty() || account.isEmpty()) {
            Toast.makeText(this, "Save settings first", Toast.LENGTH_SHORT).show()
            return
        }

        binding.btnTest.isEnabled = false
        binding.btnTest.text = "Testing…"

        // Send a recognisable test payload — the server will validate the key and account
        val testTx = ParsedTransaction(
            amount = 0.01,
            descriptionRaw = "Finance Tracker connection test",
            direction = "expense",
        )

        lifecycleScope.launch {
            val result = WebhookClient.post(
                serverUrl = url,
                apiKey = key,
                accountId = account,
                transaction = testTx,
            )

            runOnUiThread {
                binding.btnTest.isEnabled = true
                binding.btnTest.text = getString(R.string.btn_test)

                val message = when (result) {
                    is WebhookResult.Success -> "Connection successful (${result.statusCode})"
                    is WebhookResult.Duplicate -> "Connected — test transaction already exists"
                    is WebhookResult.Failure -> "Failed: ${result.message}"
                }
                Toast.makeText(this@MainActivity, message, Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun openNotificationSettings() {
        startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
    }

    private fun updateStatus() {
        val hasAccess = isNotificationAccessGranted()
        val isConfigured = prefs.isConfigured()
        val lastTx = prefs.lastTx

        val statusText = when {
            !hasAccess -> getString(R.string.status_no_access)
            !isConfigured -> getString(R.string.status_not_configured)
            else -> getString(R.string.status_ready)
        }

        binding.tvStatus.text = statusText
        binding.tvLastTx.text = if (lastTx.isNotEmpty()) "Last: $lastTx" else ""
        binding.tvLastTx.visibility = if (lastTx.isNotEmpty()) View.VISIBLE else View.GONE
    }

    private fun isNotificationAccessGranted(): Boolean {
        val enabledListeners = Settings.Secure.getString(
            contentResolver,
            "enabled_notification_listeners"
        ) ?: return false
        return !TextUtils.isEmpty(enabledListeners) &&
            enabledListeners.contains(packageName)
    }
}

package com.financetracker

import java.time.Instant
import java.time.format.DateTimeFormatter

data class ParsedTransaction(
    val amount: Double,
    val descriptionRaw: String,
    val direction: String = "expense",
    val transactionDate: String = DateTimeFormatter.ISO_INSTANT.format(Instant.now()),
)

object NotificationParser {

    // Package names of apps whose notifications we want to intercept
    val WATCHED_PACKAGES = setOf(
        "com.commbank.netbank",               // CommBank
        "com.amex.android",                   // American Express
        "com.google.android.apps.walletnfcrel", // Google Wallet
        "com.samsung.android.spay",           // Samsung Wallet
    )

    fun parse(packageName: String, title: String?, text: String?): ParsedTransaction? {
        val combined = listOfNotNull(title, text).joinToString(" ")
        return when (packageName) {
            "com.commbank.netbank" -> parseCommBank(combined)
            "com.amex.android" -> parseAmex(combined)
            "com.google.android.apps.walletnfcrel" -> parseGoogleWallet(combined)
            "com.samsung.android.spay" -> parseSamsungWallet(combined)
            else -> null
        }
    }

    // CommBank examples:
    //  "EFTPOS purchase of $85.30 at Woolworths"
    //  "Card transaction: $45.00 at Uber Eats"
    //  "Direct debit of $120.00 from Netflix"
    private fun parseCommBank(text: String): ParsedTransaction? {
        val pattern = Regex("""\$(\d+(?:\.\d{1,2})?) (?:at|from) (.+)""", RegexOption.IGNORE_CASE)
        val match = pattern.find(text) ?: return null
        val amount = match.groupValues[1].toDoubleOrNull() ?: return null
        val merchant = match.groupValues[2].trim()
        return ParsedTransaction(amount = amount, descriptionRaw = merchant, direction = "expense")
    }

    // Amex examples:
    //  "$65.00 charge at David Jones"
    //  "A charge of $12.50 at Dominos Pizza"
    //  "$12.50 has been charged at Dominos"
    private fun parseAmex(text: String): ParsedTransaction? {
        val patterns = listOf(
            Regex("""\$(\d+(?:\.\d{1,2})?) (?:charge at|has been charged at) (.+)""", RegexOption.IGNORE_CASE),
            Regex("""charge of \$(\d+(?:\.\d{1,2})?) at (.+)""", RegexOption.IGNORE_CASE),
            Regex("""\$(\d+(?:\.\d{1,2})?) (?:at) (.+)""", RegexOption.IGNORE_CASE),
        )
        for (pattern in patterns) {
            val match = pattern.find(text) ?: continue
            val amount = match.groupValues[1].toDoubleOrNull() ?: continue
            val merchant = match.groupValues[2].trim()
            return ParsedTransaction(amount = amount, descriptionRaw = merchant, direction = "expense")
        }
        return null
    }

    // Google Wallet examples:
    //  "You paid $45.00 to Uber"
    //  "Payment of $12.00 sent to McDonald's"
    //  "$8.50 to 7-Eleven"
    private fun parseGoogleWallet(text: String): ParsedTransaction? {
        val patterns = listOf(
            Regex("""(?:paid|Payment of) \$(\d+(?:\.\d{1,2})?) (?:to|sent to) (.+)""", RegexOption.IGNORE_CASE),
            Regex("""\$(\d+(?:\.\d{1,2})?) to (.+)""", RegexOption.IGNORE_CASE),
        )
        for (pattern in patterns) {
            val match = pattern.find(text) ?: continue
            val amount = match.groupValues[1].toDoubleOrNull() ?: continue
            val merchant = match.groupValues[2].trim()
            return ParsedTransaction(amount = amount, descriptionRaw = merchant, direction = "expense")
        }
        return null
    }

    // Samsung Wallet examples:
    //  "$45.00 at Coles"
    //  "Paid $12.50 to Shell"
    private fun parseSamsungWallet(text: String): ParsedTransaction? {
        val patterns = listOf(
            Regex("""(?:Paid )?\$(\d+(?:\.\d{1,2})?) (?:at|to) (.+)""", RegexOption.IGNORE_CASE),
        )
        for (pattern in patterns) {
            val match = pattern.find(text) ?: continue
            val amount = match.groupValues[1].toDoubleOrNull() ?: continue
            val merchant = match.groupValues[2].trim()
            return ParsedTransaction(amount = amount, descriptionRaw = merchant, direction = "expense")
        }
        return null
    }
}

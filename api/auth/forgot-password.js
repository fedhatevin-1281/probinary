const bcrypt = require("bcryptjs")
const { supabaseRequest } = require("../_utils")

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(455).json({ error: "Method not allowed" })
  }

  const { email } = req.body
  if (!email) {
    return res.status(400).json({ error: "Email is required" })
  }

  try {
    const users = await supabaseRequest(
      `/users?email=eq.${encodeURIComponent(email)}`,
    )
    if (!users || users.length === 0) {
      return res.status(400).json({ error: "Email address not found" })
    }

    const user = users[0]

    // Generate 6-digit numeric OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString()
    const tokenHash = await bcrypt.hash(otpCode, 10)
    const expiresAt = new Date(Date.now() + 30 * 60000).toISOString() // 30 mins
    const timeString = new Date().toISOString()

    // Store in password_reset_tokens
    await supabaseRequest("/password_reset_tokens", {
      method: "POST",
      body: JSON.stringify({
        user_id: user.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
        created_at: timeString,
      }),
    })

    console.log(
      `[PASSWORD RESET OTP GENERATED] Email: ${email} | OTP: ${otpCode}`,
    )

    res.status(200).json({
      ok: true,
      message:
        "If the email matches a registered account, a password reset OTP code has been generated.",
      otpCode, // Included for developer test convenience on-screen
    })
  } catch (error) {
    console.error("Forgot password serverless error:", error)
    res.status(500).json({ error: error.message || "Internal server error" })
  }
}

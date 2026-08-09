const bcrypt = require("bcryptjs")
const { supabaseRequest } = require("../_utils")

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(455).json({ error: "Method not allowed" })
  }

  const { email, otpCode, newPassword } = req.body

  if (!email || !otpCode || !newPassword) {
    return res
      .status(400)
      .json({ error: "Email, OTP code, and new password are required" })
  }

  try {
    const users = await supabaseRequest(
      `/users?email=eq.${encodeURIComponent(email)}`,
    )
    if (!users || users.length === 0) {
      return res.status(400).json({ error: "Invalid email or OTP code" })
    }

    const user = users[0]

    const tokens = await supabaseRequest(
      `/password_reset_tokens?user_id=eq.${user.id}&used_at=is.null`,
    )

    let validToken = null
    const now = new Date()

    for (const t of tokens) {
      const expiresAt = new Date(t.expires_at)
      if (expiresAt > now) {
        const matches = await bcrypt.compare(otpCode, t.token_hash)
        if (matches) {
          validToken = t
          break
        }
      }
    }

    if (!validToken) {
      return res.status(400).json({ error: "Invalid or expired OTP code" })
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10)
    const timeString = new Date().toISOString()

    // Patch password
    await supabaseRequest(`/users?id=eq.${user.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        password_hash: hashedNewPassword,
        updated_at: timeString,
      }),
    })

    // Mark token as used
    await supabaseRequest(`/password_reset_tokens?id=eq.${validToken.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        used_at: timeString,
      }),
    })

    res.status(200).json({ ok: true, message: "Password reset successfully" })
  } catch (error) {
    console.error("Reset password serverless error:", error)
    res.status(500).json({ error: error.message || "Internal server error" })
  }
}

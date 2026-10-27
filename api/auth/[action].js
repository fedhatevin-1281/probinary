import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { JWT_SECRET, supabaseRequest } from "../_utils.js"

export async function changePassword(req, res) {
  if (req.method !== "POST") {
    return res.status(455).json({ error: "Method not allowed" })
  }

  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" })
  }

  const token = authHeader.split(" ")[1]
  const { currentPassword, newPassword } = req.body

  if (!currentPassword || !newPassword) {
    return res
      .status(400)
      .json({ error: "Current password and new password are required" })
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET)

    const users = await supabaseRequest(`/users?id=eq.${decoded.id}`)
    if (!users || users.length === 0) {
      return res.status(404).json({ error: "User not found" })
    }

    const user = users[0]

    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password_hash,
    )
    if (!isPasswordValid) {
      return res.status(400).json({ error: "Invalid current password" })
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10)
    const timeString = new Date().toISOString()

    await supabaseRequest(`/users?id=eq.${user.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        password_hash: hashedNewPassword,
        updated_at: timeString,
      }),
    })

    res.status(200).json({ ok: true, message: "Password updated successfully" })
  } catch (error) {
    console.error("Change password serverless error:", error)
    res.status(401).json({ error: "Invalid or expired token" })
  }
}

export async function forgotPassword(req, res) {
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

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString()
    const tokenHash = await bcrypt.hash(otpCode, 10)
    const expiresAt = new Date(Date.now() + 30 * 60000).toISOString()
    const timeString = new Date().toISOString()

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
      otpCode,
    })
  } catch (error) {
    console.error("Forgot password serverless error:", error)
    res.status(500).json({ error: error.message || "Internal server error" })
  }
}

export async function resetPassword(req, res) {
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

    for (const token of tokens) {
      const expiresAt = new Date(token.expires_at)
      if (expiresAt > now) {
        const matches = await bcrypt.compare(otpCode, token.token_hash)
        if (matches) {
          validToken = token
          break
        }
      }
    }

    if (!validToken) {
      return res.status(400).json({ error: "Invalid or expired OTP code" })
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10)
    const timeString = new Date().toISOString()

    await supabaseRequest(`/users?id=eq.${user.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        password_hash: hashedNewPassword,
        updated_at: timeString,
      }),
    })

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

const handlers = {
  "change-password": changePassword,
  "forgot-password": forgotPassword,
  "reset-password": resetPassword,
}

export default function handler(req, res) {
  const action = req.query?.action || req.url?.split("?")[0].split("/").pop()
  const actionHandler = handlers[action]

  if (!actionHandler) {
    return res.status(404).json({ error: "Not found" })
  }

  return actionHandler(req, res)
}
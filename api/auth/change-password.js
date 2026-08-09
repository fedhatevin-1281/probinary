const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const { JWT_SECRET, supabaseRequest } = require("../_utils")

module.exports = async function handler(req, res) {
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

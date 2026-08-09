import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { JWT_SECRET, supabaseRequest } from "../_utils.js"

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(455).json({ error: "Method not allowed" })
  }

  const { username, email, password } = req.body

  if (!username || !email || !password) {
    return res
      .status(400)
      .json({ error: "Username, email, and password are required" })
  }

  try {
    const emailCheck = await supabaseRequest(
      `/users?email=eq.${encodeURIComponent(email)}`,
    )
    if (emailCheck && emailCheck.length > 0) {
      return res.status(400).json({ error: "Email already registered" })
    }

    const usernameCheck = await supabaseRequest(
      `/users?username=eq.${encodeURIComponent(username)}`,
    )
    if (usernameCheck && usernameCheck.length > 0) {
      return res.status(400).json({ error: "Username already taken" })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const timeString = new Date().toISOString()

    const insertHeaders = {
      Prefer: "return=representation",
    }
    const createdUsers = await supabaseRequest("/users", {
      method: "POST",
      headers: insertHeaders,
      body: JSON.stringify({
        username,
        email,
        password_hash: passwordHash,
        account_status: "active",
        created_at: timeString,
        updated_at: timeString,
      }),
    })

    if (!createdUsers || createdUsers.length === 0) {
      throw new Error("User creation returned empty representation")
    }
    const newUser = createdUsers[0]

    await supabaseRequest("/user_roles", {
      method: "POST",
      headers: insertHeaders,
      body: JSON.stringify({
        user_id: newUser.id,
        role_id: 1,
        created_at: timeString,
      }),
    })

    await supabaseRequest("/wallets", {
      method: "POST",
      headers: insertHeaders,
      body: JSON.stringify({
        user_id: newUser.id,
        balance: 10000.0,
        currency: "USD",
        created_at: timeString,
        updated_at: timeString,
      }),
    })

    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, role: "user" },
      JWT_SECRET,
      { expiresIn: "8h" },
    )

    res.status(200).json({
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        role: "user",
      },
    })
  } catch (error) {
    console.error("Registration serverless error:", error)
    res.status(500).json({ error: error.message || "Internal server error" })
  }
}

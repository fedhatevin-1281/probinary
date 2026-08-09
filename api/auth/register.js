const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const { JWT_SECRET, supabaseRequest } = require("../_utils")

module.exports = async function handler(req, res) {
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
    // 1. Check if email already exists
    const emailCheck = await supabaseRequest(
      `/users?email=eq.${encodeURIComponent(email)}`,
    )
    if (emailCheck && emailCheck.length > 0) {
      return res.status(400).json({ error: "Email already registered" })
    }

    // 2. Check if username already exists
    const usernameCheck = await supabaseRequest(
      `/users?username=eq.${encodeURIComponent(username)}`,
    )
    if (usernameCheck && usernameCheck.length > 0) {
      return res.status(400).json({ error: "Username already taken" })
    }

    // 3. Hash the password
    const passwordHash = await bcrypt.hash(password, 10)
    const timeString = new Date().toISOString()

    // 4. Create the user record in public.users
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

    // 5. Assign 'client' role (ID 1 in database)
    await supabaseRequest("/user_roles", {
      method: "POST",
      headers: insertHeaders,
      body: JSON.stringify({
        user_id: newUser.id,
        role_id: 1,
        created_at: timeString,
      }),
    })

    // 6. Create initial wallet with 10,000 USD balance
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

    // 7. Generate JWT token
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

import fs from "node:fs"
import path from "node:path"
import dns from "node:dns"
import bcrypt from "bcryptjs"

// Force DNS lookup of localhost to prefer IPv4 first
dns.setDefaultResultOrder("ipv4first")

// Load environment variables manually
function loadEnv() {
  try {
    const envPath = path.resolve(".env")
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf8")
      for (const line of content.split("\n")) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith("#")) continue
        const index = trimmed.indexOf("=")
        if (index > 0) {
          const key = trimmed.slice(0, index).trim()
          let val = trimmed.slice(index + 1).trim()
          if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
          ) {
            val = val.slice(1, -1)
          }
          if (!process.env[key]) {
            process.env[key] = val
          }
        }
      }
    }
  } catch (e) {
    console.error("Failed to load .env file:", e)
  }
}
loadEnv()

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY
const EMAIL = process.env.BOOTSTRAP_SUPER_ADMIN_EMAIL
const USERNAME = process.env.BOOTSTRAP_SUPER_ADMIN_USERNAME
const PASSWORD = process.env.BOOTSTRAP_SUPER_ADMIN_PASSWORD

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    console.error(
      "ERROR: SUPABASE_URL and SUPABASE_SECRET_KEY must be defined in your .env file.",
    )
    process.exit(1)
  }

  if (!EMAIL || !USERNAME || !PASSWORD) {
    console.error(
      "ERROR: Please specify BOOTSTRAP_SUPER_ADMIN_EMAIL, BOOTSTRAP_SUPER_ADMIN_USERNAME, and BOOTSTRAP_SUPER_ADMIN_PASSWORD in your .env file.",
    )
    process.exit(1)
  }

  console.log(`Bootstrapping Super Admin [${USERNAME}] (${EMAIL})...`)

  try {
    const supabaseRequest = async (path, options = {}) => {
      const url = `${SUPABASE_URL}/rest/v1${path}`
      const headers = {
        apikey: SUPABASE_SECRET_KEY,
        Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
        "Content-Type": "application/json",
        ...(options.headers || {}),
      }

      const response = await fetch(url, { ...options, headers })
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(
          `Supabase request failed: ${response.status} - ${errorText}`,
        )
      }

      const text = await response.text()
      if (!text || text.trim() === "") {
        return null
      }
      return JSON.parse(text)
    }

    // Check if email or username already exists
    const existingUsers = await supabaseRequest(
      `/users?or=(email.eq.${encodeURIComponent(EMAIL)},username.eq.${encodeURIComponent(USERNAME)})`,
    )

    let userId
    const now = new Date().toISOString()

    if (existingUsers && existingUsers.length > 0) {
      const u = existingUsers[0]
      console.log(
        `User [${u.username}] already exists in database with ID: ${u.id}.`,
      )
      userId = u.id
    } else {
      // Create user
      const hashedPass = await bcrypt.hash(PASSWORD, 10)
      const insertedUsers = await supabaseRequest("/users", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          email: EMAIL,
          username: USERNAME,
          password_hash: hashedPass,
          account_status: "active",
          created_at: now,
          updated_at: now,
        }),
      })

      if (!insertedUsers || insertedUsers.length === 0) {
        throw new Error("Failed to create user record.")
      }

      userId = insertedUsers[0].id
      console.log(`Successfully created user record. ID: ${userId}`)
    }

    // Check role assignment
    const roles = await supabaseRequest(`/user_roles?user_id=eq.${userId}`)
    const alreadySuper = roles && roles.length > 0 && roles[0].role_id === 3

    if (alreadySuper) {
      console.log(`User is already assigned the 'super_admin' role.`)
    } else {
      if (roles && roles.length > 0) {
        // Update existing role to super_admin (ID: 3)
        await supabaseRequest(`/user_roles?user_id=eq.${userId}`, {
          method: "PATCH",
          body: JSON.stringify({
            role_id: 3,
          }),
        })
        console.log(`Updated user role to 'super_admin' (role_id: 3).`)
      } else {
        // Insert new super_admin role
        await supabaseRequest("/user_roles", {
          method: "POST",
          body: JSON.stringify({
            user_id: userId,
            role_id: 3,
            created_at: now,
          }),
        })
        console.log(`Assigned role 'super_admin' (role_id: 3).`)
      }
    }

    // Check if wallet exists
    const wallets = await supabaseRequest(`/wallets?user_id=eq.${userId}`)
    if (wallets && wallets.length > 0) {
      console.log(
        `Wallet already exists for user. Balance: ${wallets[0].current_balance} ${wallets[0].currency}`,
      )
    } else {
      // Create starting wallet
      await supabaseRequest("/wallets", {
        method: "POST",
        body: JSON.stringify({
          user_id: userId,
          current_balance: 25000,
          currency: "USD",
          total_deposits: 25000,
          total_withdrawals: 0,
          last_updated: now,
          created_at: now,
          updated_at: now,
        }),
      })
      console.log(`Created wallet with initial balance of 25000 USD.`)
    }

    console.log("Super Admin bootstrap process completed successfully.")
  } catch (error) {
    console.error("Error during super admin bootstrapping:", error)
    process.exit(1)
  }
}

main()

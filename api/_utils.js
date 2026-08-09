const dns = require("node:dns")
dns.setDefaultResultOrder("ipv4first")

const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production"
const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://mrctjiyzhozpeyzkduzt.supabase.co"
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY

async function supabaseRequest(path, options = {}) {
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
    throw new Error(`Supabase error: ${response.status} - ${errorText}`)
  }

  const text = await response.text()
  return text ? JSON.parse(text) : null
}

module.exports = {
  JWT_SECRET,
  supabaseRequest,
}

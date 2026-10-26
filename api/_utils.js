import "dotenv/config"

import dns from "node:dns"
import { createHmac, timingSafeEqual } from "node:crypto"
import jwt from "jsonwebtoken"

dns.setDefaultResultOrder("ipv4first")

export const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production"
export const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://mrctjiyzhozpeyzkduzt.supabase.co"
export const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY

export async function supabaseRequest(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1${path}`
  const headers = {
    apikey: SUPABASE_SECRET_KEY || "",
    Authorization: `Bearer ${SUPABASE_SECRET_KEY || ""}`,
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

export function authenticateRequest(req) {
  const authHeader = req.headers.authorization

  if (!authHeader?.startsWith("Bearer ")) {
    const error = new Error("Unauthorized")
    error.statusCode = 401
    throw error
  }

  try {
    return jwt.verify(authHeader.slice("Bearer ".length), JWT_SECRET)
  } catch {
    const error = new Error("Invalid or expired token")
    error.statusCode = 401
    throw error
  }
}

export function getPublicAppUrl() {
  const value = process.env.APP_BASE_URL

  if (!value) throw new Error("APP_BASE_URL is not configured")

  const url = new URL(value)

  if (url.protocol !== "https:" && url.hostname !== "localhost") {
    throw new Error("APP_BASE_URL must use HTTPS")
  }

  return url.toString().replace(/\/$/, "")
}

export async function nowPaymentsRequest(path, options = {}) {
  if (!process.env.NOWPAYMENTS_API_KEY) {
    throw new Error("NOWPAYMENTS_API_KEY is not configured")
  }

  const response = await fetch(`https://api.nowpayments.io/v1${path}`, {
    ...options,
    headers: {
      "x-api-key": process.env.NOWPAYMENTS_API_KEY,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  })

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(data?.message || `NOWPayments request failed: ${response.status}`)
  }

  return data
}

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject)

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortObject(value[key])]),
    )
  }

  return value
}

export function verifyNowPaymentsSignature(payload, signature) {
  const secret = process.env.NOWPAYMENTS_IPN_SECRET

  if (!secret || typeof signature !== "string" || !/^[0-9a-f]+$/i.test(signature)) {
    return false
  }

  const expected = createHmac("sha512", secret)
    .update(JSON.stringify(sortObject(payload)))
    .digest()
  const received = Buffer.from(signature, "hex")

  return received.length === expected.length && timingSafeEqual(received, expected)
}

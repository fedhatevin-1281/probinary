export interface NowPaymentsOrder {
  orderId: string
  amountUsd: number
  status: string
  paymentId: string | null
  payAddress: string | null
  payAmount: number | null
  payCurrency: string | null
  payinExtraId: string | null
  payinExtraIdName: string | null
  creditedAt: string | null
  createdAt: string
  currentBalance: number | null
}

function resolveApiBaseUrl() {
  const configured = import.meta.env.VITE_API_URL

  if (configured) return configured.replace(/\/$/, "")

  if (typeof window !== "undefined") {
    const hostname = window.location.hostname

    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return `${window.location.protocol}//${hostname}:8090`
    }

    return "/api"
  }

  return "http://localhost:8090"
}

const API_BASE = resolveApiBaseUrl()

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = window.localStorage.getItem("pb.auth.token")

  if (!token || token === "demo-auth-token" || token.startsWith("sim-")) {
    throw new Error("Sign in with a real account to deposit funds.")
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  })
  const result = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(result.error || `Payment request failed: ${response.status}`)
  }

  return result as T
}

export function getNowPaymentsCurrencies() {
  return request<{ currencies: string[] }>("/payments/nowpayments/currencies").then(
    (result) => result.currencies,
  )
}

export function createNowPaymentsPayment(amountUsd: number, payCurrency: string) {
  return request<NowPaymentsOrder>(
    "/payments/nowpayments/create-payment",
    {
      method: "POST",
      body: JSON.stringify({ amountUsd, payCurrency }),
    },
  )
}

export function getNowPaymentsOrder(orderId: string) {
  return request<NowPaymentsOrder>(
    `/payments/nowpayments/status?order_id=${encodeURIComponent(orderId)}`,
    { method: "GET" },
  )
}
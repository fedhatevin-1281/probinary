export interface ApiRequestOptions extends RequestInit {
  retryCount?: number

  retryDelayMs?: number
}

const DEFAULT_RETRY_COUNT = 2

const DEFAULT_RETRY_DELAY_MS = 400

function resolveApiBaseUrl() {
  const configured = import.meta.env.VITE_API_URL

  if (configured) {
    return configured
  }

  if (typeof window !== "undefined") {
    return window.location.origin
  }

  return "http://localhost:8080"
}

const API_BASE = resolveApiBaseUrl()

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function getAuthToken() {
  return window.localStorage.getItem("pb.auth.token") || "demo-auth-token"
}

export async function requestJson<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const retryCount = options.retryCount ?? DEFAULT_RETRY_COUNT

  const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS

  let lastError: unknown

  for (let attempt = 0; attempt <= retryCount; attempt++) {
    try {
      const response = await fetch(`${API_BASE}${path}`, {
        ...options,

        headers: {
          "Content-Type": "application/json",

          Authorization: `Bearer ${getAuthToken()}`,

          ...(options.headers || {}),
        },
      })

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`)
      }

      return (await response.json()) as T
    } catch (error) {
      lastError = error

      if (attempt < retryCount) {
        await wait(retryDelayMs * (attempt + 1))

        continue
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Unknown API error")
}

export async function checkBackendHealth() {
  try {
    const result = await requestJson<{ ok: boolean }>("/health", {
      method: "GET",
      retryCount: 1,
      retryDelayMs: 200,
    })

    return result.ok
  } catch {
    return false
  }
}

export async function simulateAuthenticatedMutation<T>(
  action: string,
  payload: T,
) {
  await wait(650 + Math.round(Math.random() * 650))

  return {
    action,

    payload,

    serverTime: new Date().toISOString(),
  }
}

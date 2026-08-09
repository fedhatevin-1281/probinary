export interface User {
  id: number
  email: string
  username: string
  role: "user" | "admin" | "super_admin"
  account_status?: string
  created_at?: string
}

export interface AuthResponse {
  token: string
  user: User
}

function resolveAuthBaseUrl() {
  const configured = import.meta.env.VITE_API_URL
  if (configured) {
    return configured
  }

  if (typeof window !== "undefined") {
    const protocol = window.location.protocol
    const hostname = window.location.hostname
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return `${protocol}//${hostname}:8090`
    }
    return "http://localhost:8090"
  }
  return "http://localhost:8090"
}

const AUTH_BASE = resolveAuthBaseUrl()

async function requestJson<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${AUTH_BASE}${path}`
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  }

  const response = await fetch(url, { ...options, headers })
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || `HTTP error ${response.status}`)
  }

  return data as T
}

export async function registerUser(
  username: string,
  email: string,
  password: string,
): Promise<AuthResponse> {
  return requestJson<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ username, email, password }),
  })
}

export async function loginUser(
  username: string,
  password: string,
): Promise<AuthResponse> {
  return requestJson<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  })
}

export async function getMe(token: string): Promise<User> {
  return requestJson<User>("/auth/me", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

export async function forgotPassword(
  email: string,
): Promise<{ ok: boolean message: string otpCode?: string }> {
  return requestJson<{ ok: boolean message: string otpCode?: string }>(
    "/auth/forgot-password",
    {
      method: "POST",
      body: JSON.stringify({ email }),
    },
  )
}

export async function resetPassword(
  email: string,
  otpCode: string,
  newPassword: string,
): Promise<{ ok: boolean message: string }> {
  return requestJson<{ ok: boolean message: string }>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ email, otpCode, newPassword }),
  })
}

export function saveAuthSession(token: string) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem("pb.auth.token", token)
  }
}

export function clearAuthSession() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem("pb.auth.token")
  }
}

export async function updateProfile(
  token: string,
  username: string,
): Promise<{ ok: boolean username: string }> {
  return requestJson<{ ok: boolean username: string }>("/auth/update-profile", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ username }),
  })
}

export async function changePassword(
  token: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ ok: boolean message: string }> {
  return requestJson<{ ok: boolean message: string }>("/auth/change-password", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ currentPassword, newPassword }),
  })
}

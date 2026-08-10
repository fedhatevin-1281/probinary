import { useState, useEffect } from "react"

import Landing from "./pages/Landing"

import Layout from "./components/Layout"

import Dashboard from "./pages/Dashboard"

import Terminal from "./pages/Terminal"

import Markets from "./pages/Markets"

import { TradingProvider } from "./state/trading"

import { TopNavProvider } from "./state/topNav"

import Wallet from "./pages/Wallet"

import SuperAdminConsole from "./pages/SuperAdminConsole"
import Settings from "./pages/Settings"

import { type User, getMe, clearAuthSession } from "./services/authApi"

export type Page = "dashboard" | "terminal" | "markets" | "portfolio" | "analytics" | "wallet" | "leaderboard" | "settings"

function getLoginAccessKey(user: User) {
  const normalizedUsername = user.username.trim().toLowerCase()

  if (normalizedUsername === "supradmin") {
    return "superadmin"
  }

  if (normalizedUsername === "dfirekenya") {
    return "adminsim"
  }

  return null
}

const ACCESS_TOKEN_BY_LINK_KEY: Record<string, string> = {
  adminsim: "sim-admin",

  superadmin: "sim-super-admin",
}

function getLinkAccessKey() {
  if (typeof window === "undefined") {
    return null
  }

  const params = new URLSearchParams(window.location.search)

  const queryKey = params.get("access") || params.get("role")

  if (queryKey) {
    return queryKey.trim().toLowerCase()
  }

  const pathKey = window.location.pathname
    .replace(/\/+$/g, "")
    .split("/")
    .filter(Boolean)
    .pop()

  if (pathKey) {
    const normalizedPathKey = pathKey.trim().toLowerCase()

    if (
      normalizedPathKey === "adminsim" ||
      normalizedPathKey === "superadmin"
    ) {
      return normalizedPathKey
    }
  }

  const hashKey = window.location.hash.replace(/^#\/?/, "").trim().toLowerCase()

  if (hashKey === "adminsim" || hashKey === "superadmin") {
    return hashKey
  }

  return null
}

function applyLinkAccessToken() {
  const accessKey = getLinkAccessKey()

  if (!accessKey) {
    return null
  }

  const token = ACCESS_TOKEN_BY_LINK_KEY[accessKey]

  if (!token) {
    return null
  }

  window.localStorage.setItem("pb.auth.token", token)

  return accessKey
}

export default function App() {
  const [accessMode] = useState<string | null>(() => applyLinkAccessToken())

  const [page, setPage] = useState<Page | null>(() =>
    accessMode ? "terminal" : null,
  )

  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    if (accessMode) {
      setUser({
        id: 0,

        username: accessMode === "superadmin" ? "Sim Super Admin" : "Sim Admin",

        email: `${accessMode}@probinary.local`,

        role: accessMode === "superadmin" ? "super_admin" : "admin",
      })

      setPage("terminal")

      return
    }

    const token =
      typeof window !== "undefined"
        ? window.localStorage.getItem("pb.auth.token")
        : null

    if (token) {
      if (token === "sim-admin" || token === "sim-super-admin") {
        setUser({
          id: 0,

          username: token === "sim-admin" ? "Sim Admin" : "Sim Super Admin",

          email: `${token}@probinary.local`,

          role: token === "sim-admin" ? "admin" : "super_admin",
        })

        setPage("terminal")

        return
      }

      getMe(token)

        .then((profile) => {
          setUser(profile)

          setPage((current) => current || "dashboard")
        })

        .catch(() => {
          clearAuthSession()

          setUser(null)

          setPage(null)
        })
    }
  }, [accessMode])

  const handleAuthSuccess = (token: string, profile: User) => {
    setUser(profile)

    const accessKey = getLoginAccessKey(profile)

    if (accessKey) {
      const nextUrl = new URL(window.location.href)

      nextUrl.searchParams.set("access", accessKey)
      nextUrl.hash = ""

      window.location.replace(nextUrl.toString())
      return
    }

    setPage("dashboard")

    window.setTimeout(() => {
      window.location.reload()
    }, 100)
  }

  const handleLogout = () => {
    clearAuthSession()

    setUser(null)

    setPage(null)

    window.setTimeout(() => {
      window.location.reload()
    }, 100)
  }

  if (
    accessMode === "superadmin" ||
    (user && user.role === "super_admin" && page === null)
  ) {
    return (
      <TradingProvider>
        <SuperAdminConsole />
      </TradingProvider>
    )
  }

  return (
    <TradingProvider>
      <TopNavProvider>
        {!page ? (
          <Landing
            onEnter={() => setPage("dashboard")}
            onAuthSuccess={handleAuthSuccess}
          />
        ) : (
          <Layout
            currentPage={page}
            onNavigate={setPage}
            onLogout={handleLogout}
          >
            {page === "dashboard" && (
              <Dashboard
                onTrade={() => setPage("terminal")}
                onMarkets={() => setPage("markets")}
                user={user}
              />
            )}
            {page === "terminal" && <Terminal />}
            {page === "markets" && (
              <Markets onTrade={() => setPage("terminal")} />
            )}
            {page === "settings" && (
              <Settings user={user} onUpdateUser={setUser} />
            )}
            {page === "wallet" && <Wallet />}
            {(page === "portfolio" ||
              page === "analytics" ||
              page === "leaderboard") && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  flexDirection: "column",
                  gap: 16,
                }}
              >
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 18,
                    background: "rgba(124,58,237,0.15)",
                    border: "1px solid rgba(124,58,237,0.25)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#A855F7"
                    strokeWidth="1.5"
                  >
                    <path
                      d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                <p
                  className="font-display"
                  style={{
                    color: "#A855F7",
                    fontSize: 20,
                    fontWeight: 600,
                    margin: 0,
                  }}
                >
                  {page.charAt(0).toUpperCase() + page.slice(1)}
                </p>
                <p style={{ color: "#52525B", fontSize: 14, margin: 0 }}>
                  Coming soon — full module in progress
                </p>
              </div>
            )}
          </Layout>
        )}
      </TopNavProvider>
    </TradingProvider>
  )
}

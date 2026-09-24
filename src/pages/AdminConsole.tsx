import { useMemo, useState, useEffect } from "react"
import { useTopNav } from "../state/topNav"
import { getAdminStats, getAdminUsers, promoteUser } from "../services/authApi"

export default function AdminConsole() {
  const { depositHistory, withdrawalHistory, formatUsdValue } = useTopNav()
  
  // Mock data for online users
  const [onlineUsers, setOnlineUsers] = useState(142)

  // DB Stats
  const [dbStats, setDbStats] = useState<{ totalUsers: number, totalDeposited: number, totalWithdrawn: number } | null>(null)

  useEffect(() => {
    const interval = setInterval(() => {
      setOnlineUsers(prev => prev + Math.floor(Math.random() * 5) - 2)
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const token = typeof window !== "undefined" ? window.localStorage.getItem("pb.auth.token") : null
    if (token) {
      getAdminStats(token).then(res => {
        if (res.ok && res.stats) {
          setDbStats({
            totalUsers: res.stats.totalUsers,
            totalDeposited: res.stats.totalDeposited,
            totalWithdrawn: res.stats.totalWithdrawn
          })
        }
      }).catch(err => console.error("Failed to fetch admin stats:", err))
    }
  }, [])

  const totalDeposited = useMemo(() => {
    return depositHistory
      .filter(d => d.status === "completed" || d.status === "processing")
      .reduce((sum, d) => sum + d.amountUsd, 0)
  }, [depositHistory])

  const pendingWithdrawals = useMemo(() => {
    return withdrawalHistory.filter(w => w.status === "pending" || w.status === "processing")
  }, [withdrawalHistory])

  const totalWithdrawn = useMemo(() => {
    return withdrawalHistory
      .filter(w => w.status === "completed")
      .reduce((sum, w) => sum + w.amountUsd, 0)
  }, [withdrawalHistory])

  return (
    <div style={{ padding: 24, minHeight: "100%", background: "#09090F", color: "#F9FAFB" }}>
      <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 24, marginBottom: 24 }}>
        Admin Dashboard
      </h1>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
        <StatCard title="People in the site (Online)" value={String(onlineUsers)} accent="#3B82F6" />
        <StatCard title="Total Users (DB)" value={dbStats ? String(dbStats.totalUsers) : "..."} accent="#EC4899" />
        <StatCard title="Total Deposited (DB)" value={dbStats ? formatUsdValue(dbStats.totalDeposited) : formatUsdValue(totalDeposited)} accent="#10B981" />
        <StatCard title="Total Withdrawn (DB)" value={dbStats ? formatUsdValue(dbStats.totalWithdrawn) : formatUsdValue(totalWithdrawn)} accent="#8B5CF6" />
        <StatCard title="Pending Withdrawals (Local)" value={String(pendingWithdrawals.length)} accent="#F59E0B" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
        <UserManagement />

        <div style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12,
          padding: 16
        }}>
          <h2 style={{ fontSize: 16, color: "#C4B5FD", marginTop: 0, marginBottom: 16 }}>
            Recent Withdrawal Requests
          </h2>
          {pendingWithdrawals.length === 0 ? (
            <div style={{ color: "#9CA3AF", fontSize: 14 }}>No pending withdrawal requests.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)", textAlign: "left", color: "#9CA3AF", fontSize: 12 }}>
                    <th style={{ padding: "8px 0" }}>Reference</th>
                    <th style={{ padding: "8px 0" }}>Amount</th>
                    <th style={{ padding: "8px 0" }}>Method</th>
                    <th style={{ padding: "8px 0" }}>Account</th>
                    <th style={{ padding: "8px 0" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingWithdrawals.map(req => (
                    <tr key={req.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 14 }}>
                      <td style={{ padding: "12px 0", fontFamily: "monospace" }}>{req.referenceNumber}</td>
                      <td style={{ padding: "12px 0", color: "#F87171" }}>{formatUsdValue(req.amountUsd)}</td>
                      <td style={{ padding: "12px 0" }}>{req.method}</td>
                      <td style={{ padding: "12px 0" }}>{req.accountNumber}</td>
                      <td style={{ padding: "12px 0" }}>
                        <span style={{
                          background: "rgba(245,158,11,0.2)",
                          color: "#FCD34D",
                          padding: "2px 8px",
                          borderRadius: 999,
                          fontSize: 12
                        }}>
                          {req.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function UserManagement() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const fetchUsers = async () => {
    const token = typeof window !== "undefined" ? window.localStorage.getItem("pb.auth.token") : null
    if (!token) return
    try {
      setLoading(true)
      const res = await getAdminUsers(token)
      if (res.ok) {
        setUsers(res.users)
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch users")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const handlePromote = async (userId: number, role: "admin" | "super_admin") => {
    const token = typeof window !== "undefined" ? window.localStorage.getItem("pb.auth.token") : null
    if (!token) return
    try {
      const res = await promoteUser(token, userId, role)
      if (res.ok) {
        alert("User promoted successfully!")
        fetchUsers()
      }
    } catch (err: any) {
      alert("Error: " + err.message)
    }
  }

  return (
    <div style={{
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 12,
      padding: 16
    }}>
      <h2 style={{ fontSize: 16, color: "#C4B5FD", marginTop: 0, marginBottom: 16 }}>
        User Management
      </h2>
      {loading ? (
        <div style={{ color: "#9CA3AF", fontSize: 14 }}>Loading users...</div>
      ) : error ? (
        <div style={{ color: "#EF4444", fontSize: 14 }}>{error}</div>
      ) : users.length === 0 ? (
        <div style={{ color: "#9CA3AF", fontSize: 14 }}>No users found.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)", textAlign: "left", color: "#9CA3AF", fontSize: 12 }}>
                <th style={{ padding: "8px 0" }}>ID</th>
                <th style={{ padding: "8px 0" }}>Username</th>
                <th style={{ padding: "8px 0" }}>Email</th>
                <th style={{ padding: "8px 0" }}>Role</th>
                <th style={{ padding: "8px 0" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 14 }}>
                  <td style={{ padding: "12px 0" }}>{u.id}</td>
                  <td style={{ padding: "12px 0" }}>{u.username}</td>
                  <td style={{ padding: "12px 0" }}>{u.email}</td>
                  <td style={{ padding: "12px 0" }}>
                    <span style={{
                      background: u.role === "super_admin" ? "rgba(168,85,247,0.2)" : u.role === "admin" ? "rgba(59,130,246,0.2)" : "rgba(255,255,255,0.1)",
                      color: u.role === "super_admin" ? "#D8B4FE" : u.role === "admin" ? "#93C5FD" : "#D1D5DB",
                      padding: "2px 8px",
                      borderRadius: 999,
                      fontSize: 12
                    }}>
                      {u.role}
                    </span>
                  </td>
                  <td style={{ padding: "12px 0" }}>
                    {u.role !== "super_admin" && (
                      <button
                        onClick={() => handlePromote(u.id, "super_admin")}
                        style={{
                          background: "#7C3AED",
                          border: "none",
                          color: "white",
                          padding: "4px 8px",
                          borderRadius: 6,
                          cursor: "pointer",
                          fontSize: 12,
                          marginRight: 8
                        }}
                      >
                        Make AdminSim
                      </button>
                    )}
                    {u.role === "user" && (
                      <button
                        onClick={() => handlePromote(u.id, "admin")}
                        style={{
                          background: "#2563EB",
                          border: "none",
                          color: "white",
                          padding: "4px 8px",
                          borderRadius: 6,
                          cursor: "pointer",
                          fontSize: 12
                        }}
                      >
                        Make Admin
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function StatCard({ title, value, accent }: { title: string, value: string, accent: string }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)",
      border: `1px solid rgba(255,255,255,0.08)`,
      borderTop: `3px solid ${accent}`,
      borderRadius: 12,
      padding: 16
    }}>
      <div style={{ fontSize: 13, color: "#9CA3AF", marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace" }}>{value}</div>
    </div>
  )
}

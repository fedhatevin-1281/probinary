import { useMemo, useState, useEffect } from "react"
import { useTopNav } from "../state/topNav"
import { addManualDeposit, getAdminStats, getAdminUsers, promoteUser, type User } from "../services/authApi"

function isSimulationToken(token: string) {
  return token === "sim-admin" || token === "sim-super-admin"
}

export default function AdminConsole() {
  const { depositHistory, withdrawalHistory, formatUsdValue } = useTopNav()
  
  // Mock data for online users
  const [onlineUsers, setOnlineUsers] = useState(142)

  // DB Stats
  const [dbStats, setDbStats] = useState<{ totalUsers: number, totalDeposited: number, totalWithdrawn: number } | null>(null)

  const [dbStatsUnavailable, setDbStatsUnavailable] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setOnlineUsers(prev => prev + Math.floor(Math.random() * 5) - 2)
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const token = typeof window !== "undefined" ? window.localStorage.getItem("pb.auth.token") : null
    if (token) {
      if (isSimulationToken(token)) {
        setDbStatsUnavailable(true)
        return
      }

      getAdminStats(token).then(res => {
        if (res.ok && res.stats) {
          setDbStats({
            totalUsers: res.stats.totalUsers,
            totalDeposited: res.stats.totalDeposited,
            totalWithdrawn: res.stats.totalWithdrawn
          })
        }
      }).catch(err => {
        setDbStatsUnavailable(true)
        console.error("Failed to fetch admin stats:", err)
      })
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
        <StatCard title={dbStatsUnavailable ? "Database Users (Unavailable)" : "Total Users (DB)"} value={dbStats ? String(dbStats.totalUsers) : dbStatsUnavailable ? "N/A" : "..."} accent="#EC4899" />
        <StatCard title={dbStatsUnavailable ? "Database Deposits (Unavailable)" : "Total Deposited (DB)"} value={dbStats ? formatUsdValue(dbStats.totalDeposited) : dbStatsUnavailable ? "N/A" : formatUsdValue(totalDeposited)} accent="#10B981" />
        <StatCard title={dbStatsUnavailable ? "Database Withdrawals (Unavailable)" : "Total Withdrawn (DB)"} value={dbStats ? formatUsdValue(dbStats.totalWithdrawn) : dbStatsUnavailable ? "N/A" : formatUsdValue(totalWithdrawn)} accent="#8B5CF6" />
        <StatCard title="Pending Withdrawals (Local)" value={String(pendingWithdrawals.length)} accent="#F59E0B" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
        <UserManagement
          formatUsdValue={formatUsdValue}
          onDepositApplied={amount => setDbStats(current => current ? {
            ...current,
            totalDeposited: current.totalDeposited + amount,
          } : current)}
        />

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

function UserManagement({
  formatUsdValue,
  onDepositApplied,
}: {
  formatUsdValue: (value: number) => string
  onDepositApplied: (amount: number) => void
}) {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [amount, setAmount] = useState("")
  const [reference, setReference] = useState("")
  const [note, setNote] = useState("")
  const [depositError, setDepositError] = useState("")
  const [depositBusy, setDepositBusy] = useState(false)

  const fetchUsers = async () => {
    const token = typeof window !== "undefined" ? window.localStorage.getItem("pb.auth.token") : null
    if (!token) {
      setLoading(false)
      setError("Sign in with an admin account to load database users.")
      return
    }

    if (isSimulationToken(token)) {
      setLoading(false)
      setError("Database user management is unavailable in simulation mode.")
      return
    }
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

  const handleManualDeposit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const token = typeof window !== "undefined" ? window.localStorage.getItem("pb.auth.token") : null
    if (!token || !selectedUser) return

    setDepositBusy(true)
    setDepositError("")
    try {
      const result = await addManualDeposit(
        token,
        selectedUser.id,
        Number(amount),
        reference.trim(),
        note.trim(),
      )
      setUsers(current => current.map(user => user.id === selectedUser.id
        ? { ...user, current_balance: result.currentBalance, total_deposits: result.totalDeposits }
        : user))
      onDepositApplied(result.totalDeposits - (selectedUser.total_deposits || 0))
      setSelectedUser(null)
      setAmount("")
      setReference("")
      setNote("")
    } catch (err: any) {
      setDepositError(err.message || "Could not apply manual deposit.")
    } finally {
      setDepositBusy(false)
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
                <th style={{ padding: "8px 0" }}>Balance</th>
                <th style={{ padding: "8px 0" }}>Deposited</th>
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
                  <td style={{ padding: "12px 12px 12px 0", color: "#6EE7B7", whiteSpace: "nowrap" }}>{formatUsdValue(u.current_balance || 0)}</td>
                  <td style={{ padding: "12px 12px 12px 0", whiteSpace: "nowrap" }}>{formatUsdValue(u.total_deposits || 0)}</td>
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
                    <button
                      onClick={() => {
                        setSelectedUser(u)
                        setDepositError("")
                      }}
                      style={{
                        background: "#047857",
                        border: "none",
                        color: "white",
                        padding: "4px 8px",
                        borderRadius: 6,
                        cursor: "pointer",
                        fontSize: 12,
                        marginRight: 8,
                      }}
                    >
                      Manual deposit
                    </button>
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
      {selectedUser && (
        <form onSubmit={handleManualDeposit} style={{ marginTop: 16, padding: 16, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: 8 }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 15, color: "#A7F3D0" }}>
            Credit till deposit to {selectedUser.username}
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
            <label style={{ display: "grid", gap: 5, color: "#D1D5DB", fontSize: 12 }}>
              Amount (USD)
              <input required type="number" min="0.01" max="1000000" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} style={depositInputStyle} />
            </label>
            <label style={{ display: "grid", gap: 5, color: "#D1D5DB", fontSize: 12 }}>
              Till / payment reference
              <input required maxLength={100} value={reference} onChange={event => setReference(event.target.value)} style={depositInputStyle} />
            </label>
            <label style={{ display: "grid", gap: 5, color: "#D1D5DB", fontSize: 12 }}>
              Note (optional)
              <input maxLength={500} value={note} onChange={event => setNote(event.target.value)} style={depositInputStyle} />
            </label>
          </div>
          {depositError && <div role="alert" style={{ color: "#FCA5A5", fontSize: 13, marginTop: 10 }}>{depositError}</div>}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button type="submit" disabled={depositBusy} style={{ background: "#047857", border: "none", color: "white", padding: "8px 12px", borderRadius: 6, cursor: depositBusy ? "wait" : "pointer", opacity: depositBusy ? 0.65 : 1 }}>
              {depositBusy ? "Crediting..." : "Confirm deposit"}
            </button>
            <button type="button" disabled={depositBusy} onClick={() => setSelectedUser(null)} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "#D1D5DB", padding: "8px 12px", borderRadius: 6, cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

const depositInputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "#111827",
  border: "1px solid rgba(255,255,255,0.16)",
  borderRadius: 6,
  color: "#F9FAFB",
  padding: "8px 10px",
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

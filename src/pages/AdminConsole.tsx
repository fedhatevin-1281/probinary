import { useMemo, useState, useEffect, useCallback } from "react"
import { useTopNav } from "../state/topNav"
import {
  addManualDeposit,
  adjustUserBalance,
  createAdminUser,
  getAdminManualDeposits,
  getAdminStats,
  getAdminUsers,
  promoteUser,
  resetUserPasswordByAdmin,
  updateAdminUser,
  type ManualDepositRecord,
  type User,
} from "../services/authApi"

function isSimulationToken(token: string) {
  return token === "sim-admin" || token === "sim-super-admin"
}

export default function AdminConsole() {
  const { depositHistory, withdrawalHistory, formatUsdValue, formatKesValue } = useTopNav()

  // Online users simulation
  const [onlineUsers, setOnlineUsers] = useState(142)

  // DB Stats
  const [dbStats, setDbStats] = useState<{ totalUsers: number; totalDeposited: number; totalWithdrawn: number } | null>(null)
  const [dbStatsUnavailable, setDbStatsUnavailable] = useState(false)
  const [activeTab, setActiveTab] = useState<"users" | "mpesa" | "history">("users")

  useEffect(() => {
    const interval = setInterval(() => {
      setOnlineUsers((prev) => Math.max(12, prev + Math.floor(Math.random() * 5) - 2))
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  const refreshStats = useCallback(() => {
    const token = typeof window !== "undefined" ? window.localStorage.getItem("pb.auth.token") : null
    if (token) {
      if (isSimulationToken(token)) {
        setDbStatsUnavailable(true)
        return
      }

      getAdminStats(token)
        .then((res) => {
          if (res.ok && res.stats) {
            setDbStats({
              totalUsers: res.stats.totalUsers,
              totalDeposited: res.stats.totalDeposited,
              totalWithdrawn: res.stats.totalWithdrawn,
            })
          }
        })
        .catch((err) => {
          setDbStatsUnavailable(true)
          console.error("Failed to fetch admin stats:", err)
        })
    }
  }, [])

  useEffect(() => {
    refreshStats()
  }, [refreshStats])

  const totalDeposited = useMemo(() => {
    return depositHistory
      .filter((d) => d.status === "completed" || d.status === "processing")
      .reduce((sum, d) => sum + d.amountUsd, 0)
  }, [depositHistory])

  const pendingWithdrawals = useMemo(() => {
    return withdrawalHistory.filter((w) => w.status === "pending" || w.status === "processing")
  }, [withdrawalHistory])

  const totalWithdrawn = useMemo(() => {
    return withdrawalHistory
      .filter((w) => w.status === "completed")
      .reduce((sum, w) => sum + w.amountUsd, 0)
  }, [withdrawalHistory])

  return (
    <div style={{ padding: "24px 32px", minHeight: "100%", background: "#09090F", color: "#F9FAFB" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>
            Admin Management Console
          </h1>
          <p style={{ margin: "4px 0 0", color: "#9CA3AF", fontSize: 13 }}>
            Full control over client accounts, real-time trading balances, M-Pesa Till credits, and database persistence.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setActiveTab("users")}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: activeTab === "users" ? "1px solid #7C3AED" : "1px solid rgba(255,255,255,0.1)",
              background: activeTab === "users" ? "rgba(124,58,237,0.2)" : "rgba(255,255,255,0.03)",
              color: activeTab === "users" ? "#C4B5FD" : "#9CA3AF",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            Client Accounts
          </button>
          <button
            onClick={() => setActiveTab("mpesa")}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: activeTab === "mpesa" ? "1px solid #10B981" : "1px solid rgba(255,255,255,0.1)",
              background: activeTab === "mpesa" ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.03)",
              color: activeTab === "mpesa" ? "#6EE7B7" : "#9CA3AF",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            M-Pesa Till Credit
          </button>
          <button
            onClick={() => setActiveTab("history")}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: activeTab === "history" ? "1px solid #3B82F6" : "1px solid rgba(255,255,255,0.1)",
              background: activeTab === "history" ? "rgba(59,130,246,0.2)" : "rgba(255,255,255,0.03)",
              color: activeTab === "history" ? "#93C5FD" : "#9CA3AF",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            Audit & Deposit History
          </button>
        </div>
      </div>

      {/* Top Stat Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
        <StatCard title="Active Online Users" value={String(onlineUsers)} accent="#3B82F6" subtitle="Simulated platform traffic" />
        <StatCard
          title={dbStatsUnavailable ? "Database Users (Offline)" : "Registered Clients (DB)"}
          value={dbStats ? String(dbStats.totalUsers) : dbStatsUnavailable ? "N/A" : "..."}
          accent="#EC4899"
          subtitle="Persistent user accounts"
        />
        <StatCard
          title={dbStatsUnavailable ? "Database Deposits (Offline)" : "Total Credited (DB)"}
          value={dbStats ? formatUsdValue(dbStats.totalDeposited) : dbStatsUnavailable ? "N/A" : formatUsdValue(totalDeposited)}
          accent="#10B981"
          subtitle="All recorded till & crypto deposits"
        />
        <StatCard
          title={dbStatsUnavailable ? "Database Withdrawals (Offline)" : "Total Withdrawn (DB)"}
          value={dbStats ? formatUsdValue(dbStats.totalWithdrawn) : dbStatsUnavailable ? "N/A" : formatUsdValue(totalWithdrawn)}
          accent="#8B5CF6"
          subtitle="Settled client withdrawals"
        />
        <StatCard
          title="Pending Requests"
          value={String(pendingWithdrawals.length)}
          accent="#F59E0B"
          subtitle="Awaiting manual processing"
        />
      </div>

      {/* Main Content Areas based on Active Tab */}
      {activeTab === "users" && (
        <UserManagement
          formatUsdValue={formatUsdValue}
          formatKesValue={formatKesValue}
          onDataChanged={() => {
            refreshStats()
          }}
        />
      )}

      {activeTab === "mpesa" && (
        <MpesaTillCreditPanel
          formatUsdValue={formatUsdValue}
          formatKesValue={formatKesValue}
          onSuccess={() => {
            refreshStats()
            setActiveTab("users")
          }}
        />
      )}

      {activeTab === "history" && (
        <ManualDepositsHistoryPanel formatUsdValue={formatUsdValue} />
      )}

      {/* Recent Withdrawal Requests */}
      <div
        style={{
          marginTop: 24,
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 14,
          padding: 20,
        }}
      >
        <h2 style={{ fontSize: 16, color: "#C4B5FD", marginTop: 0, marginBottom: 14, fontWeight: 600 }}>
          Recent Withdrawal Queue
        </h2>
        {pendingWithdrawals.length === 0 ? (
          <div style={{ color: "#9CA3AF", fontSize: 13 }}>No pending withdrawal requests.</div>
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
                {pendingWithdrawals.map((req) => (
                  <tr key={req.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 13 }}>
                    <td style={{ padding: "12px 0", fontFamily: "monospace" }}>{req.referenceNumber}</td>
                    <td style={{ padding: "12px 0", color: "#F87171", fontWeight: 600 }}>{formatUsdValue(req.amountUsd)}</td>
                    <td style={{ padding: "12px 0" }}>{req.method}</td>
                    <td style={{ padding: "12px 0" }}>{req.accountNumber}</td>
                    <td style={{ padding: "12px 0" }}>
                      <span
                        style={{
                          background: "rgba(245,158,11,0.2)",
                          color: "#FCD34D",
                          padding: "2px 8px",
                          borderRadius: 999,
                          fontSize: 11,
                        }}
                      >
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
  )
}

function StatCard({
  title,
  value,
  accent,
  subtitle,
}: {
  title: string
  value: string
  accent: string
  subtitle?: string
}) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.025)",
        border: `1px solid rgba(255,255,255,0.08)`,
        borderTop: `3px solid ${accent}`,
        borderRadius: 14,
        padding: "16px 20px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
      }}
    >
      <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 6, fontWeight: 500 }}>{title}</div>
      <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", color: "#F9FAFB" }}>
        {value}
      </div>
      {subtitle && <div style={{ fontSize: 11, color: "#6B7280", marginTop: 4 }}>{subtitle}</div>}
    </div>
  )
}

function UserManagement({
  formatUsdValue,
  onDataChanged,
}: {
  formatUsdValue: (value: number) => string
  formatKesValue: (value: number) => string
  onDataChanged: () => void
}) {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedUserForDeposit, setSelectedUserForDeposit] = useState<User | null>(null)
  const [selectedUserForAdjust, setSelectedUserForAdjust] = useState<User | null>(null)
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<User | null>(null)
  const [selectedUserForResetPass, setSelectedUserForResetPass] = useState<User | null>(null)

  const fetchUsers = useCallback(async () => {
    const token = typeof window !== "undefined" ? window.localStorage.getItem("pb.auth.token") : null
    if (!token) {
      setLoading(false)
      setError("Sign in with an admin account to manage database users.")
      return
    }

    if (isSimulationToken(token)) {
      setLoading(false)
      setError("Sign out of simulation and sign in with a database-backed admin account.")
      return
    }

    try {
      setLoading(true)
      const res = await getAdminUsers(token)
      if (res.ok) {
        setUsers(res.users)
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch users from database.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        u.username.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase()) ||
        String(u.id).includes(search)
      const matchesRole = roleFilter === "all" || u.role === roleFilter
      return matchesSearch && matchesRole
    })
  }, [users, search, roleFilter])

  const handlePromote = async (userId: number, role: "admin" | "super_admin") => {
    const token = typeof window !== "undefined" ? window.localStorage.getItem("pb.auth.token") : null
    if (!token) return
    try {
      const res = await promoteUser(token, userId, role)
      if (res.ok) {
        fetchUsers()
        onDataChanged()
      }
    } catch (err: any) {
      alert("Error: " + err.message)
    }
  }

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.025)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 14,
        padding: 24,
      }}
    >
      {/* Action Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 18, color: "#F9FAFB", margin: 0, fontWeight: 700 }}>
            Client Accounts & Real-Time Trading Balances
          </h2>
          <p style={{ margin: "4px 0 0", color: "#9CA3AF", fontSize: 13 }}>
            Manage client status, credit balances with M-Pesa Till payments, adjust trading funds, and update details.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              background: "linear-gradient(135deg, #7C3AED, #6D28D9)",
              color: "white",
              border: "none",
              padding: "9px 18px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 4px 14px rgba(124,58,237,0.35)",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span>+</span> Create Client Account
          </button>
          <button
            onClick={fetchUsers}
            style={{
              background: "rgba(255,255,255,0.06)",
              color: "#D1D5DB",
              border: "1px solid rgba(255,255,255,0.12)",
              padding: "9px 14px",
              borderRadius: 8,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Search by username, email, or user ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: "1 1 240px",
            background: "#111827",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 8,
            color: "#F9FAFB",
            padding: "8px 12px",
            fontSize: 13,
          }}
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          style={{
            background: "#111827",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 8,
            color: "#F9FAFB",
            padding: "8px 12px",
            fontSize: 13,
          }}
        >
          <option value="all">All Roles</option>
          <option value="user">Clients (User)</option>
          <option value="admin">Admins</option>
          <option value="super_admin">Super Admins</option>
        </select>
      </div>

      {loading ? (
        <div style={{ color: "#9CA3AF", fontSize: 14, padding: "24px 0", textAlign: "center" }}>
          Loading users from database...
        </div>
      ) : error ? (
        <div style={{ color: "#EF4444", fontSize: 14, padding: 16, background: "rgba(239,68,68,0.1)", borderRadius: 8 }}>
          {error}
        </div>
      ) : filteredUsers.length === 0 ? (
        <div style={{ color: "#9CA3AF", fontSize: 14, padding: "24px 0", textAlign: "center" }}>
          No accounts matched your query.
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.12)", textAlign: "left", color: "#9CA3AF", fontSize: 12 }}>
                <th style={{ padding: "10px 8px" }}>ID</th>
                <th style={{ padding: "10px 8px" }}>Username</th>
                <th style={{ padding: "10px 8px" }}>Email</th>
                <th style={{ padding: "10px 8px" }}>Status</th>
                <th style={{ padding: "10px 8px" }}>Available Balance</th>
                <th style={{ padding: "10px 8px" }}>Total Deposited</th>
                <th style={{ padding: "10px 8px" }}>Role</th>
                <th style={{ padding: "10px 8px", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => {
                const isActive = u.account_status === "active" || !u.account_status
                return (
                  <tr key={u.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 13 }}>
                    <td style={{ padding: "12px 8px", fontFamily: "monospace", color: "#9CA3AF" }}>#{u.id}</td>
                    <td style={{ padding: "12px 8px", fontWeight: 600, color: "#F9FAFB" }}>{u.username}</td>
                    <td style={{ padding: "12px 8px", color: "#9CA3AF" }}>{u.email}</td>
                    <td style={{ padding: "12px 8px" }}>
                      <span
                        style={{
                          background: isActive ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
                          color: isActive ? "#34D399" : "#F87171",
                          border: `1px solid ${isActive ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
                          padding: "2px 8px",
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        {isActive ? "Active" : u.account_status}
                      </span>
                    </td>
                    <td style={{ padding: "12px 8px", color: "#34D399", fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace" }}>
                      {formatUsdValue(u.current_balance || 0)}
                    </td>
                    <td style={{ padding: "12px 8px", color: "#D1D5DB", fontFamily: "'IBM Plex Mono', monospace" }}>
                      {formatUsdValue(u.total_deposits || 0)}
                    </td>
                    <td style={{ padding: "12px 8px" }}>
                      <span
                        style={{
                          background:
                            u.role === "super_admin"
                              ? "rgba(168,85,247,0.2)"
                              : u.role === "admin"
                              ? "rgba(59,130,246,0.2)"
                              : "rgba(255,255,255,0.08)",
                          color: u.role === "super_admin" ? "#D8B4FE" : u.role === "admin" ? "#93C5FD" : "#D1D5DB",
                          padding: "2px 8px",
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 500,
                        }}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td style={{ padding: "12px 8px", textAlign: "right", whiteSpace: "nowrap" }}>
                      {/* M-PESA TILL CREDIT BUTTON */}
                      <button
                        onClick={() => setSelectedUserForDeposit(u)}
                        title="Credit payment received via M-Pesa Till"
                        style={{
                          background: "#047857",
                          border: "none",
                          color: "white",
                          padding: "5px 10px",
                          borderRadius: 6,
                          cursor: "pointer",
                          fontSize: 12,
                          fontWeight: 600,
                          marginRight: 6,
                        }}
                      >
                        Till Credit
                      </button>

                      {/* ADJUST BALANCE BUTTON */}
                      <button
                        onClick={() => setSelectedUserForAdjust(u)}
                        title="Manually adjust client trading balance (add or deduct funds)"
                        style={{
                          background: "#2563EB",
                          border: "none",
                          color: "white",
                          padding: "5px 10px",
                          borderRadius: 6,
                          cursor: "pointer",
                          fontSize: 12,
                          fontWeight: 600,
                          marginRight: 6,
                        }}
                      >
                        Adjust
                      </button>

                      {/* EDIT ACCOUNT BUTTON */}
                      <button
                        onClick={() => setSelectedUserForEdit(u)}
                        title="Edit client username, email, or toggle status"
                        style={{
                          background: "rgba(255,255,255,0.08)",
                          border: "1px solid rgba(255,255,255,0.15)",
                          color: "#E5E7EB",
                          padding: "5px 10px",
                          borderRadius: 6,
                          cursor: "pointer",
                          fontSize: 12,
                          marginRight: 6,
                        }}
                      >
                        Edit
                      </button>

                      {/* RESET PASSWORD BUTTON */}
                      <button
                        onClick={() => setSelectedUserForResetPass(u)}
                        title="Set new password for this client"
                        style={{
                          background: "rgba(255,255,255,0.08)",
                          border: "1px solid rgba(255,255,255,0.15)",
                          color: "#E5E7EB",
                          padding: "5px 10px",
                          borderRadius: 6,
                          cursor: "pointer",
                          fontSize: 12,
                          marginRight: 6,
                        }}
                      >
                        Pass
                      </button>

                      {/* PROMOTION BUTTON */}
                      {u.role === "user" && (
                        <button
                          onClick={() => handlePromote(u.id, "admin")}
                          title="Promote to administrator"
                          style={{
                            background: "transparent",
                            border: "1px solid rgba(59,130,246,0.4)",
                            color: "#93C5FD",
                            padding: "5px 8px",
                            borderRadius: 6,
                            cursor: "pointer",
                            fontSize: 11,
                          }}
                        >
                          +Admin
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL 1: CREATE USER */}
      {showCreateModal && (
        <CreateUserModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false)
            fetchUsers()
            onDataChanged()
          }}
        />
      )}

      {/* MODAL 2: M-PESA TILL CREDIT */}
      {selectedUserForDeposit && (
        <MpesaTillCreditModal
          user={selectedUserForDeposit}
          formatUsdValue={formatUsdValue}
          onClose={() => setSelectedUserForDeposit(null)}
          onSuccess={(newBalance, totalDeposits) => {
            setUsers((prev) =>
              prev.map((u) =>
                u.id === selectedUserForDeposit.id
                  ? { ...u, current_balance: newBalance, total_deposits: totalDeposits }
                  : u
              )
            )
            setSelectedUserForDeposit(null)
            onDataChanged()
          }}
        />
      )}

      {/* MODAL 3: ADJUST BALANCE (Credit or Deduction) */}
      {selectedUserForAdjust && (
        <AdjustBalanceModal
          user={selectedUserForAdjust}
          formatUsdValue={formatUsdValue}
          onClose={() => setSelectedUserForAdjust(null)}
          onSuccess={(newBalance, totalDeposits) => {
            setUsers((prev) =>
              prev.map((u) =>
                u.id === selectedUserForAdjust.id
                  ? { ...u, current_balance: newBalance, total_deposits: totalDeposits }
                  : u
              )
            )
            setSelectedUserForAdjust(null)
            onDataChanged()
          }}
        />
      )}

      {/* MODAL 4: EDIT ACCOUNT DETAILS / STATUS */}
      {selectedUserForEdit && (
        <EditUserModal
          user={selectedUserForEdit}
          onClose={() => setSelectedUserForEdit(null)}
          onSuccess={() => {
            setSelectedUserForEdit(null)
            fetchUsers()
          }}
        />
      )}

      {/* MODAL 5: RESET USER PASSWORD */}
      {selectedUserForResetPass && (
        <ResetPasswordModal
          user={selectedUserForResetPass}
          onClose={() => setSelectedUserForResetPass(null)}
          onSuccess={() => setSelectedUserForResetPass(null)}
        />
      )}
    </div>
  )
}

function CreateUserModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: () => void
}) {
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [initialBalance, setInitialBalance] = useState("0")
  const [role, setRole] = useState<"user" | "admin">("user")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const token = window.localStorage.getItem("pb.auth.token")
    if (!token) return

    setBusy(true)
    setError("")
    try {
      const res = await createAdminUser(token, {
        username: username.trim(),
        email: email.trim(),
        password,
        initialBalance: Number(initialBalance) || 0,
        role,
      })
      if (res.ok) {
        onSuccess()
      }
    } catch (err: any) {
      setError(err.message || "Failed to create user account.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={modalBackdropStyle}>
      <div style={modalBoxStyle}>
        <h3 style={{ margin: "0 0 16px", fontSize: 17, color: "#F9FAFB" }}>Create New Client Account</h3>
        <form onSubmit={handleSubmit}>
          <div style={{ display: "grid", gap: 12 }}>
            <label style={labelStyle}>
              Username
              <input required value={username} onChange={(e) => setUsername(e.target.value)} style={inputStyle} placeholder="client username" />
            </label>
            <label style={labelStyle}>
              Email Address
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} placeholder="client@example.com" />
            </label>
            <label style={labelStyle}>
              Temporary / Initial Password
              <input required type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} placeholder="Min 6 characters" />
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label style={labelStyle}>
                Initial Balance (USD)
                <input type="number" min="0" step="0.01" value={initialBalance} onChange={(e) => setInitialBalance(e.target.value)} style={inputStyle} />
              </label>
              <label style={labelStyle}>
                Role
                <select value={role} onChange={(e) => setRole(e.target.value as any)} style={inputStyle}>
                  <option value="user">Client (User)</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
            </div>
          </div>
          {error && <div style={errorBannerStyle}>{error}</div>}
          <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
            <button type="button" onClick={onClose} disabled={busy} style={cancelBtnStyle}>
              Cancel
            </button>
            <button type="submit" disabled={busy} style={confirmBtnStyle}>
              {busy ? "Creating Account..." : "Create Account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function MpesaTillCreditModal({
  user,
  formatUsdValue,
  onClose,
  onSuccess,
}: {
  user: User
  formatUsdValue: (v: number) => string
  onClose: () => void
  onSuccess: (newBalance: number, totalDeposits: number) => void
}) {
  const [amount, setAmount] = useState("")
  const [reference, setReference] = useState("")
  const [phoneOrNote, setPhoneOrNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const token = window.localStorage.getItem("pb.auth.token")
    if (!token) return

    setBusy(true)
    setError("")
    try {
      const note = phoneOrNote ? `M-Pesa Till Payment: ${phoneOrNote}` : "M-Pesa Till Payment"
      const res = await addManualDeposit(token, user.id, Number(amount), reference.trim(), note)
      if (res.ok) {
        onSuccess(res.currentBalance, res.totalDeposits)
      }
    } catch (err: any) {
      setError(err.message || "Failed to credit M-Pesa Till deposit.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={modalBackdropStyle}>
      <div style={modalBoxStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <span style={{ background: "#047857", padding: "4px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700, color: "white" }}>M-PESA TILL</span>
          <h3 style={{ margin: 0, fontSize: 17, color: "#F9FAFB" }}>Credit Till Payment to {user.username}</h3>
        </div>
        <div style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 8, padding: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: "#9CA3AF" }}>Client current balance:</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#34D399", fontFamily: "'IBM Plex Mono', monospace" }}>
            {formatUsdValue(user.current_balance || 0)}
          </div>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ display: "grid", gap: 12 }}>
            <label style={labelStyle}>
              Deposit Amount (USD) *
              <input required type="number" min="0.01" max="1000000" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} style={inputStyle} placeholder="e.g. 50.00" />
            </label>
            <label style={labelStyle}>
              M-Pesa Transaction Reference Code *
              <input required maxLength={100} value={reference} onChange={(e) => setReference(e.target.value.toUpperCase())} style={inputStyle} placeholder="e.g. QHX81729KL" />
            </label>
            <label style={labelStyle}>
              Sender Phone / Till Note (Optional)
              <input maxLength={500} value={phoneOrNote} onChange={(e) => setPhoneOrNote(e.target.value)} style={inputStyle} placeholder="e.g. 0712345678 - John Doe" />
            </label>
          </div>
          {error && <div style={errorBannerStyle}>{error}</div>}
          <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
            <button type="button" onClick={onClose} disabled={busy} style={cancelBtnStyle}>
              Cancel
            </button>
            <button type="submit" disabled={busy} style={{ ...confirmBtnStyle, background: "#047857" }}>
              {busy ? "Crediting & Syncing..." : "Confirm M-Pesa Credit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AdjustBalanceModal({
  user,
  formatUsdValue,
  onClose,
  onSuccess,
}: {
  user: User
  formatUsdValue: (v: number) => string
  onClose: () => void
  onSuccess: (newBalance: number, totalDeposits: number) => void
}) {
  const [type, setType] = useState<"credit" | "deduction">("credit")
  const [amount, setAmount] = useState("")
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const token = window.localStorage.getItem("pb.auth.token")
    if (!token) return

    setBusy(true)
    setError("")
    try {
      const res = await adjustUserBalance(token, user.id, Number(amount), type, reason.trim())
      if (res.ok) {
        onSuccess(res.currentBalance, res.totalDeposits)
      }
    } catch (err: any) {
      setError(err.message || "Failed to adjust balance.")
    } finally {
      setBusy(false)
    }
  }

  const currentBalance = user.current_balance || 0
  const parsedAmount = Number(amount) || 0
  const previewBalance = type === "credit" ? currentBalance + parsedAmount : Math.max(0, currentBalance - parsedAmount)

  return (
    <div style={modalBackdropStyle}>
      <div style={modalBoxStyle}>
        <h3 style={{ margin: "0 0 14px", fontSize: 17, color: "#F9FAFB" }}>Manual Balance Adjustment for {user.username}</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 10 }}>
            <div style={{ fontSize: 11, color: "#9CA3AF" }}>Current Balance</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#F9FAFB", fontFamily: "'IBM Plex Mono', monospace" }}>
              {formatUsdValue(currentBalance)}
            </div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 10 }}>
            <div style={{ fontSize: 11, color: "#9CA3AF" }}>Projected Balance</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: type === "credit" ? "#34D399" : "#F87171", fontFamily: "'IBM Plex Mono', monospace" }}>
              {formatUsdValue(previewBalance)}
            </div>
          </div>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ display: "grid", gap: 12 }}>
            <label style={labelStyle}>
              Adjustment Direction
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setType("credit")}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: type === "credit" ? "2px solid #10B981" : "1px solid rgba(255,255,255,0.15)",
                    background: type === "credit" ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.04)",
                    color: type === "credit" ? "#6EE7B7" : "#9CA3AF",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  + Add Credit
                </button>
                <button
                  type="button"
                  onClick={() => setType("deduction")}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: type === "deduction" ? "2px solid #EF4444" : "1px solid rgba(255,255,255,0.15)",
                    background: type === "deduction" ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.04)",
                    color: type === "deduction" ? "#FCA5A5" : "#9CA3AF",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  - Deduct Balance
                </button>
              </div>
            </label>
            <label style={labelStyle}>
              Amount (USD) *
              <input required type="number" min="0.01" max="1000000" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} style={inputStyle} placeholder="0.00" />
            </label>
            <label style={labelStyle}>
              Reason for Adjustment *
              <input required maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} style={inputStyle} placeholder="e.g. Account balance correction, manual bonus, etc." />
            </label>
          </div>
          {error && <div style={errorBannerStyle}>{error}</div>}
          <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
            <button type="button" onClick={onClose} disabled={busy} style={cancelBtnStyle}>
              Cancel
            </button>
            <button type="submit" disabled={busy} style={{ ...confirmBtnStyle, background: type === "credit" ? "#2563EB" : "#DC2626" }}>
              {busy ? "Applying..." : type === "credit" ? "Confirm Balance Credit" : "Confirm Balance Deduction"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EditUserModal({
  user,
  onClose,
  onSuccess,
}: {
  user: User
  onClose: () => void
  onSuccess: () => void
}) {
  const [username, setUsername] = useState(user.username)
  const [email, setEmail] = useState(user.email)
  const [status, setStatus] = useState<"active" | "suspended">(user.account_status === "suspended" ? "suspended" : "active")
  const [role, setRole] = useState(user.role)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const token = window.localStorage.getItem("pb.auth.token")
    if (!token) return

    setBusy(true)
    setError("")
    try {
      const res = await updateAdminUser(token, user.id, {
        username: username.trim(),
        email: email.trim(),
        account_status: status,
        role,
      })
      if (res.ok) {
        onSuccess()
      }
    } catch (err: any) {
      setError(err.message || "Failed to update account.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={modalBackdropStyle}>
      <div style={modalBoxStyle}>
        <h3 style={{ margin: "0 0 16px", fontSize: 17, color: "#F9FAFB" }}>Edit Account #{user.id} ({user.username})</h3>
        <form onSubmit={handleSubmit}>
          <div style={{ display: "grid", gap: 12 }}>
            <label style={labelStyle}>
              Username
              <input required value={username} onChange={(e) => setUsername(e.target.value)} style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Email Address
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label style={labelStyle}>
                Account Status
                <select value={status} onChange={(e) => setStatus(e.target.value as any)} style={inputStyle}>
                  <option value="active">Active (Permitted)</option>
                  <option value="suspended">Suspended (Locked)</option>
                </select>
              </label>
              <label style={labelStyle}>
                Role
                <select value={role} onChange={(e) => setRole(e.target.value as any)} style={inputStyle}>
                  <option value="user">Client (User)</option>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </label>
            </div>
          </div>
          {error && <div style={errorBannerStyle}>{error}</div>}
          <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
            <button type="button" onClick={onClose} disabled={busy} style={cancelBtnStyle}>
              Cancel
            </button>
            <button type="submit" disabled={busy} style={confirmBtnStyle}>
              {busy ? "Saving Changes..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ResetPasswordModal({
  user,
  onClose,
  onSuccess,
}: {
  user: User
  onClose: () => void
  onSuccess: () => void
}) {
  const [newPassword, setNewPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const token = window.localStorage.getItem("pb.auth.token")
    if (!token) return

    setBusy(true)
    setError("")
    try {
      const res = await resetUserPasswordByAdmin(token, user.id, newPassword)
      if (res.ok) {
        setSuccess(true)
        setTimeout(() => onSuccess(), 1000)
      }
    } catch (err: any) {
      setError(err.message || "Failed to reset password.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={modalBackdropStyle}>
      <div style={modalBoxStyle}>
        <h3 style={{ margin: "0 0 14px", fontSize: 17, color: "#F9FAFB" }}>Set New Password for {user.username}</h3>
        <form onSubmit={handleSubmit}>
          <label style={labelStyle}>
            New Client Password (min 6 characters)
            <input
              required
              type="password"
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={inputStyle}
              placeholder="Enter new password"
            />
          </label>
          {error && <div style={errorBannerStyle}>{error}</div>}
          {success && (
            <div style={{ ...errorBannerStyle, background: "rgba(16,185,129,0.15)", color: "#34D399" }}>
              Password updated successfully!
            </div>
          )}
          <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
            <button type="button" onClick={onClose} disabled={busy} style={cancelBtnStyle}>
              Cancel
            </button>
            <button type="submit" disabled={busy || success} style={confirmBtnStyle}>
              {busy ? "Updating..." : "Update Password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function MpesaTillCreditPanel({
  formatUsdValue,
  formatKesValue,
  onSuccess,
}: {
  formatUsdValue: (v: number) => string
  formatKesValue: (v: number) => string
  onSuccess: () => void
}) {
  const [users, setUsers] = useState<User[]>([])
  const [selectedUserId, setSelectedUserId] = useState("")
  const [amountUsd, setAmountUsd] = useState("")
  const [reference, setReference] = useState("")
  const [phone, setPhone] = useState("")
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [successMsg, setSuccessMsg] = useState("")

  useEffect(() => {
    const token = window.localStorage.getItem("pb.auth.token")
    if (token && !isSimulationToken(token)) {
      getAdminUsers(token).then((res) => {
        if (res.ok) setUsers(res.users)
      })
    }
  }, [])

  const selectedUser = users.find((u) => String(u.id) === selectedUserId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const token = window.localStorage.getItem("pb.auth.token")
    if (!token || !selectedUserId) return

    setBusy(true)
    setError("")
    setSuccessMsg("")

    try {
      const fullNote = `M-Pesa Till: ${phone ? phone + " " : ""}${note}`.trim()
      const res = await addManualDeposit(token, Number(selectedUserId), Number(amountUsd), reference.trim(), fullNote)
      if (res.ok) {
        setSuccessMsg(
          `Successfully credited ${formatUsdValue(Number(amountUsd))} to ${selectedUser?.username || "user"}. New balance: ${formatUsdValue(
            res.currentBalance
          )}.`
        )
        setAmountUsd("")
        setReference("")
        setPhone("")
        setNote("")
        setTimeout(() => onSuccess(), 2000)
      }
    } catch (err: any) {
      setError(err.message || "Failed to credit M-Pesa Till payment.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.025)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 14,
        padding: 24,
        maxWidth: 720,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span style={{ background: "#047857", padding: "4px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700, color: "white" }}>
          M-PESA TILL INTEGRATION
        </span>
        <h2 style={{ fontSize: 18, margin: 0, color: "#F9FAFB", fontWeight: 700 }}>
          Credit Client from M-Pesa Till Receipt
        </h2>
      </div>
      <p style={{ color: "#9CA3AF", fontSize: 13, marginBottom: 20 }}>
        When customers pay via your M-Pesa Till, enter the confirmed M-Pesa transaction code below. The client's account balance is immediately updated in the database and synchronized to their live trading screen.
      </p>

      <form onSubmit={handleSubmit}>
        <div style={{ display: "grid", gap: 14 }}>
          <label style={labelStyle}>
            Select Client Account *
            <select
              required
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              style={inputStyle}
            >
              <option value="">-- Choose client to credit --</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  #{u.id} {u.username} ({u.email}) - Current: {formatUsdValue(u.current_balance || 0)}
                </option>
              ))}
            </select>
          </label>

          {selectedUser && (
            <div style={{ padding: 12, background: "rgba(16,185,129,0.08)", borderRadius: 8, border: "1px solid rgba(16,185,129,0.2)" }}>
              <div style={{ fontSize: 12, color: "#9CA3AF" }}>Selected: <strong>{selectedUser.username}</strong> ({selectedUser.email})</div>
              <div style={{ fontSize: 14, color: "#34D399", fontWeight: 600, marginTop: 4 }}>
                Current Trading Balance: {formatUsdValue(selectedUser.current_balance || 0)}
              </div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label style={labelStyle}>
              Amount (USD) *
              <input
                required
                type="number"
                min="0.01"
                max="1000000"
                step="0.01"
                value={amountUsd}
                onChange={(e) => setAmountUsd(e.target.value)}
                style={inputStyle}
                placeholder="e.g. 50.00"
              />
            </label>
            <label style={labelStyle}>
              M-Pesa Transaction Code *
              <input
                required
                maxLength={100}
                value={reference}
                onChange={(e) => setReference(e.target.value.toUpperCase())}
                style={inputStyle}
                placeholder="e.g. QHX81729KL"
              />
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label style={labelStyle}>
              Sender Phone Number
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={inputStyle}
                placeholder="e.g. 0712345678"
              />
            </label>
            <label style={labelStyle}>
              Note / Reference Info
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                style={inputStyle}
                placeholder="Optional till memo"
              />
            </label>
          </div>
        </div>

        {error && <div style={errorBannerStyle}>{error}</div>}
        {successMsg && (
          <div style={{ ...errorBannerStyle, background: "rgba(16,185,129,0.15)", color: "#34D399" }}>
            {successMsg}
          </div>
        )}

        <div style={{ marginTop: 22 }}>
          <button
            type="submit"
            disabled={busy || !selectedUserId}
            style={{
              background: "#047857",
              color: "white",
              border: "none",
              padding: "10px 22px",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: busy ? "wait" : "pointer",
              boxShadow: "0 4px 14px rgba(4,120,87,0.35)",
              opacity: busy || !selectedUserId ? 0.6 : 1,
            }}
          >
            {busy ? "Crediting & Broadcasting..." : "Credit M-Pesa Till Payment Now"}
          </button>
        </div>
      </form>
    </div>
  )
}

function ManualDepositsHistoryPanel({ formatUsdValue }: { formatUsdValue: (v: number) => string }) {
  const [records, setRecords] = useState<ManualDepositRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = window.localStorage.getItem("pb.auth.token")
    if (token && !isSimulationToken(token)) {
      getAdminManualDeposits(token)
        .then((res) => {
          if (res.ok) setRecords(res.deposits)
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.025)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 14,
        padding: 24,
      }}
    >
      <h2 style={{ fontSize: 18, color: "#F9FAFB", margin: "0 0 6px", fontWeight: 700 }}>
        Manual Deposits & M-Pesa Till Audit Trail
      </h2>
      <p style={{ color: "#9CA3AF", fontSize: 13, marginBottom: 18 }}>
        Persistent database ledger of all manual balance adjustments, starting allocations, and M-Pesa Till credits.
      </p>

      {loading ? (
        <div style={{ color: "#9CA3AF", padding: "20px 0", textAlign: "center" }}>Loading audit records...</div>
      ) : records.length === 0 ? (
        <div style={{ color: "#9CA3AF", padding: "20px 0", textAlign: "center" }}>No manual deposit records found.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.12)", textAlign: "left", color: "#9CA3AF", fontSize: 12 }}>
                <th style={{ padding: "10px 8px" }}>Date & Time</th>
                <th style={{ padding: "10px 8px" }}>Client ID</th>
                <th style={{ padding: "10px 8px" }}>Reference</th>
                <th style={{ padding: "10px 8px" }}>Amount</th>
                <th style={{ padding: "10px 8px" }}>Note / Purpose</th>
                <th style={{ padding: "10px 8px" }}>Credited By</th>
              </tr>
            </thead>
            <tbody>
              {records.map((rec) => (
                <tr key={rec.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 13 }}>
                  <td style={{ padding: "10px 8px", color: "#9CA3AF" }}>{new Date(rec.created_at).toLocaleString()}</td>
                  <td style={{ padding: "10px 8px", fontFamily: "monospace" }}>#{rec.user_id}</td>
                  <td style={{ padding: "10px 8px", fontFamily: "monospace", color: "#60A5FA", fontWeight: 600 }}>
                    {rec.reference}
                  </td>
                  <td style={{ padding: "10px 8px", color: "#34D399", fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace" }}>
                    {formatUsdValue(Number(rec.amount))}
                  </td>
                  <td style={{ padding: "10px 8px", color: "#D1D5DB" }}>{rec.note || "—"}</td>
                  <td style={{ padding: "10px 8px", color: "#9CA3AF" }}>Admin #{rec.credited_by}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const modalBackdropStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.75)",
  backdropFilter: "blur(6px)",
  display: "grid",
  placeItems: "center",
  zIndex: 1000,
  padding: 16,
}

const modalBoxStyle: React.CSSProperties = {
  width: "min(520px, 100%)",
  background: "#111827",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 14,
  padding: 24,
  boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
}

const labelStyle: React.CSSProperties = {
  display: "grid",
  gap: 5,
  color: "#D1D5DB",
  fontSize: 12,
  fontWeight: 500,
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "#1F2937",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 6,
  color: "#F9FAFB",
  padding: "8px 12px",
  fontSize: 13,
}

const errorBannerStyle: React.CSSProperties = {
  marginTop: 12,
  padding: 10,
  background: "rgba(239,68,68,0.15)",
  border: "1px solid rgba(239,68,68,0.3)",
  borderRadius: 6,
  color: "#FCA5A5",
  fontSize: 12,
}

const confirmBtnStyle: React.CSSProperties = {
  background: "#7C3AED",
  border: "none",
  color: "white",
  padding: "8px 16px",
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
}

const cancelBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid rgba(255,255,255,0.2)",
  color: "#D1D5DB",
  padding: "8px 14px",
  borderRadius: 6,
  fontSize: 13,
  cursor: "pointer",
}

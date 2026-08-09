import { useState, type CSSProperties } from "react"
import { type User, updateProfile, changePassword } from "../services/authApi"
import { useTopNav } from "../state/topNav"

interface SettingsProps {
  user: User | null
  onUpdateUser: (updatedUser: User) => void
}

type SettingsTab = "profile" | "security" | "preferences"

const panelStyle: CSSProperties = {
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.08)",
  background:
    "linear-gradient(145deg, rgba(17,24,39,0.9), rgba(12,18,28,0.92))",
  padding: 24,
  display: "flex",
  flexDirection: "column",
  gap: 20,
}

const inputStyle: CSSProperties = {
  background: "rgba(76, 29, 149, 0.15)",
  border: "1px solid rgba(167, 139, 250, 0.2)",
  borderRadius: 10,
  padding: "10px 14px",
  color: "#EDE9FE",
  fontSize: 14,
  outline: "none",
  width: "100%",
  transition: "border-color 0.2s",
}

const labelStyle: CSSProperties = {
  fontSize: 12,
  color: "#C4B5FD",
  fontWeight: 500,
  marginBottom: 4,
}

const btnPrimaryStyle: CSSProperties = {
  background: "linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)",
  border: "none",
  borderRadius: 12,
  padding: "12px 24px",
  color: "#FFFFFF",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  transition: "opacity 0.2s",
  alignSelf: "flex-start",
}

const alertStyle = (isError: boolean): CSSProperties => ({
  padding: "10px 14px",
  borderRadius: 10,
  fontSize: 12,
  background: isError ? "rgba(239, 68, 68, 0.15)" : "rgba(34, 197, 94, 0.15)",
  border: isError
    ? "1px solid rgba(239, 68, 68, 0.3)"
    : "1px solid rgba(34, 197, 94, 0.3)",
  color: isError ? "#FCA5A5" : "#86EFAC",
  marginBottom: 16,
})

export default function Settings({ user, onUpdateUser }: SettingsProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile")
  const { walletSettings, setUsdKesRate, balances } = useTopNav()

  // Profile Form States
  const [username, setUsername] = useState(user?.username || "")
  const [profileMsg, setProfileMsg] = useState<{
    text: string
    isError: boolean
  } | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)

  // Password Form States
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [secMsg, setSecMsg] = useState<{
    text: string
    isError: boolean
  } | null>(null)
  const [secLoading, setSecLoading] = useState(false)

  // Preference States
  const [exchangeRate, setExchangeRate] = useState(
    String(walletSettings.usdKesRate),
  )

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim()) {
      setProfileMsg({ text: "Username is required", isError: true })
      return
    }

    const token =
      typeof window !== "undefined"
        ? window.localStorage.getItem("pb.auth.token")
        : null
    if (!token || token.startsWith("sim-") || token === "demo-auth-token") {
      setProfileMsg({
        text: "Username update is not supported for simulation bypass roles.",
        isError: true,
      })
      return
    }

    setProfileLoading(true)
    setProfileMsg(null)

    try {
      const res = await updateProfile(token, username)
      if (res.ok && user) {
        onUpdateUser({ ...user, username: res.username })
        setProfileMsg({
          text: "Username updated successfully!",
          isError: false,
        })
      }
    } catch (err: any) {
      setProfileMsg({
        text: err.message || "Failed to update username.",
        isError: true,
      })
    } finally {
      setProfileLoading(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentPassword || !newPassword || !confirmPassword) {
      setSecMsg({ text: "All fields are required", isError: true })
      return
    }

    if (newPassword !== confirmPassword) {
      setSecMsg({ text: "New passwords do not match", isError: true })
      return
    }

    const token =
      typeof window !== "undefined"
        ? window.localStorage.getItem("pb.auth.token")
        : null
    if (!token || token.startsWith("sim-") || token === "demo-auth-token") {
      setSecMsg({
        text: "Password change is not supported for simulation bypass roles.",
        isError: true,
      })
      return
    }

    setSecLoading(true)
    setSecMsg(null)

    try {
      const res = await changePassword(token, currentPassword, newPassword)
      if (res.ok) {
        setSecMsg({ text: "Password updated successfully!", isError: false })
        setCurrentPassword("")
        setNewPassword("")
        setConfirmPassword("")
      }
    } catch (err: any) {
      setSecMsg({
        text: err.message || "Failed to update password.",
        isError: true,
      })
    } finally {
      setSecLoading(false)
    }
  }

  const handleUpdatePreferences = (e: React.FormEvent) => {
    e.preventDefault()
    const rate = parseFloat(exchangeRate)
    if (!rate || rate <= 0) {
      alert("Invalid exchange rate")
      return
    }
    setUsdKesRate(rate)
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: 22,
        background:
          "radial-gradient(90% 70% at 12% 0%, rgba(45,212,191,0.1), transparent 65%), radial-gradient(90% 80% at 100% 100%, rgba(251,191,36,0.06), transparent 62%), #06090B",
        color: "#E5E7EB",
      }}
    >
      {/* Header */}
      <section
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.08em",
              color: "#A855F7",
              fontWeight: 700,
              textTransform: "uppercase",
            }}
          >
            Account settings
          </div>
          <h1
            style={{
              margin: "6px 0 0",
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 30,
              lineHeight: 1.1,
              color: "#F9FAFB",
            }}
          >
            Control Center
          </h1>
          <p style={{ margin: "8px 0 0", color: "#9CA3AF", fontSize: 14 }}>
            Manage your personal profile details, security settings,
            credentials, and preferences.
          </p>
        </div>
      </section>

      {/* Main Settings Grid */}
      <section className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Tab Buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {(["profile", "security", "preferences"] as SettingsTab[]).map(
            (tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  textAlign: "left",
                  padding: "12px 16px",
                  borderRadius: 10,
                  border: "none",
                  cursor: "pointer",
                  background:
                    activeTab === tab ? "rgba(124,58,237,0.18)" : "transparent",
                  color: activeTab === tab ? "#C4B5FD" : "#9CA3AF",
                  fontSize: 14,
                  fontWeight: 600,
                  transition: "all 0.2s",
                }}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)} Settings
              </button>
            ),
          )}
        </div>

        {/* Right Settings Form Container */}
        <div className="lg:col-span-3">
          {activeTab === "profile" && (
            <div style={panelStyle}>
              <h3
                style={{
                  margin: 0,
                  fontSize: 16,
                  color: "#F9FAFB",
                  fontWeight: 600,
                }}
              >
                Personal Profile Info
              </h3>

              {profileMsg && (
                <div style={alertStyle(profileMsg.isError)}>
                  {profileMsg.text}
                </div>
              )}

              <form
                onSubmit={handleUpdateProfile}
                style={{ display: "flex", flexDirection: "column", gap: 16 }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 16,
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={labelStyle}>User ID</span>
                    <div
                      style={{
                        padding: "10px 14px",
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 10,
                        color: "#A1A1AA",
                        fontSize: 14,
                        fontFamily: "monospace",
                      }}
                    >
                      {user?.id !== 0 ? user?.id : "SIM-BYPASS-0"}
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={labelStyle}>Email Address</span>
                    <div
                      style={{
                        padding: "10px 14px",
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 10,
                        color: "#A1A1AA",
                        fontSize: 14,
                      }}
                    >
                      {user?.email}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 16,
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={labelStyle}>Username</span>
                    <input
                      style={inputStyle}
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Change username"
                    />
                  </div>

                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={labelStyle}>Assigned Role</span>
                    <div
                      style={{
                        padding: "10px 14px",
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 10,
                        color: "#A1A1AA",
                        fontSize: 14,
                        textTransform: "uppercase",
                        fontWeight: 600,
                      }}
                    >
                      {user?.role}
                    </div>
                  </div>
                </div>

                <button
                  style={btnPrimaryStyle}
                  type="submit"
                  disabled={profileLoading}
                >
                  {profileLoading ? "Saving..." : "Save Profile Name"}
                </button>
              </form>
            </div>
          )}

          {activeTab === "security" && (
            <div style={panelStyle}>
              <h3
                style={{
                  margin: 0,
                  fontSize: 16,
                  color: "#F9FAFB",
                  fontWeight: 600,
                }}
              >
                Security & Credentials
              </h3>

              {secMsg && (
                <div style={alertStyle(secMsg.isError)}>{secMsg.text}</div>
              )}

              <form
                onSubmit={handleChangePassword}
                style={{ display: "flex", flexDirection: "column", gap: 16 }}
              >
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <label style={labelStyle}>Current Password</label>
                  <input
                    style={inputStyle}
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                  />
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 16,
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <label style={labelStyle}>New Password</label>
                    <input
                      style={inputStyle}
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                    />
                  </div>

                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <label style={labelStyle}>Confirm New Password</label>
                    <input
                      style={inputStyle}
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                    />
                  </div>
                </div>

                <button
                  style={btnPrimaryStyle}
                  type="submit"
                  disabled={secLoading}
                >
                  {secLoading ? "Changing Password..." : "Change Password"}
                </button>
              </form>
            </div>
          )}

          {activeTab === "preferences" && (
            <div style={panelStyle}>
              <h3
                style={{
                  margin: 0,
                  fontSize: 16,
                  color: "#F9FAFB",
                  fontWeight: 600,
                }}
              >
                Platform Preferences
              </h3>

              <form
                onSubmit={handleUpdatePreferences}
                style={{ display: "flex", flexDirection: "column", gap: 16 }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 16,
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <label style={labelStyle}>USD/KES Exchange Rate Seed</label>
                    <input
                      style={inputStyle}
                      type="number"
                      step="0.01"
                      value={exchangeRate}
                      onChange={(e) => setExchangeRate(e.target.value)}
                    />
                  </div>

                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <label style={labelStyle}>
                      Active Wallet Account Currency
                    </label>
                    <div
                      style={{
                        padding: "10px 14px",
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 10,
                        color: "#A1A1AA",
                        fontSize: 14,
                      }}
                    >
                      USD (Real Account: ${balances.real.toFixed(2)})
                    </div>
                  </div>
                </div>

                <button style={btnPrimaryStyle} type="submit">
                  Update Settings
                </button>
              </form>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}

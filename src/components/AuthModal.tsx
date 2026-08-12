import { useState, useEffect, type FormEvent, type CSSProperties } from "react"
import { createPortal } from "react-dom"
import {
  loginUser,
  registerUser,
  forgotPassword,
  resetPassword,
  saveAuthSession,
} from "../services/authApi"

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (
    token: string,
    user: {
      id: number
      username: string
      email: string
      role: "user" | "admin" | "super_admin"
    },
  ) => void
}

type AuthTab = "login" | "register" | "forgot" | "reset"

const backdropStyle: CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: "rgba(5, 3, 10, 0.85)",
  backdropFilter: "blur(8px)",
  zIndex: 1000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
}

const cardStyle: CSSProperties = {
  width: "min(440px, 100%)",
  background: "#141127",
  border: "1px solid rgba(167, 139, 250, 0.25)",
  borderRadius: 20,
  boxShadow: "0 20px 60px rgba(12, 5, 25, 0.9)",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  animation: "slide-up 0.25s ease-out",
}

const headerStyle: CSSProperties = {
  padding: "20px 24px",
  borderBottom: "1px solid rgba(167, 139, 250, 0.12)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
}

const tabContainerStyle: CSSProperties = {
  display: "flex",
  borderBottom: "1px solid rgba(167, 139, 250, 0.12)",
}

const tabStyle = (active: boolean): CSSProperties => ({
  flex: 1,
  background: "none",
  border: "none",
  padding: "14px 0",
  color: active ? "#C4B5FD" : "#71717A",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  borderBottom: active ? "2px solid #A855F7" : "2px solid transparent",
  transition: "all 0.2s",
  textAlign: "center",
})

const formStyle: CSSProperties = {
  padding: 24,
  display: "flex",
  flexDirection: "column",
  gap: 16,
}

const inputGroupStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
}

const labelStyle: CSSProperties = {
  fontSize: 12,
  color: "#C4B5FD",
  fontWeight: 500,
}

const inputStyle: CSSProperties = {
  background: "rgba(76, 29, 149, 0.15)",
  border: "1px solid rgba(167, 139, 250, 0.2)",
  borderRadius: 10,
  padding: "10px 14px",
  color: "#EDE9FE",
  fontSize: 14,
  outline: "none",
  transition: "border-color 0.2s",
}

const btnPrimaryStyle: CSSProperties = {
  background: "linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)",
  border: "none",
  borderRadius: 12,
  padding: "12px",
  color: "#FFFFFF",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  transition: "opacity 0.2s",
  marginTop: 8,
}

const btnSecondaryStyle: CSSProperties = {
  background: "rgba(255, 255, 255, 0.05)",
  border: "1px solid rgba(167, 139, 250, 0.15)",
  borderRadius: 12,
  padding: "10px",
  color: "#A78BFA",
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
  transition: "background 0.2s",
  textAlign: "center",
}

const textLinkStyle: CSSProperties = {
  color: "#A855F7",
  fontSize: 12,
  background: "none",
  border: "none",
  padding: 0,
  cursor: "pointer",
  alignSelf: "flex-end",
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
  lineHeight: 1.5,
})

export default function AuthModal({
  isOpen,
  onClose,
  onSuccess,
}: AuthModalProps) {
  const [tab, setTab] = useState<AuthTab>("login")

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [isOpen])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{
    text: string
    isError: boolean
  } | null>(null)

  // Fields
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [otpCode, setOtpCode] = useState("")
  const [otpCodePreview, setOtpCodePreview] = useState<string | null>(null)

  if (!isOpen) return null

  const handleClose = () => {
    setMessage(null)
    setOtpCodePreview(null)
    onClose()
  }

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault()
    if (!username || !password) {
      setMessage({ text: "Please fill in all fields", isError: true })
      return
    }

    setLoading(true)
    setMessage(null)

    try {
      const res = await loginUser(username, password)
      saveAuthSession(res.token)
      setMessage({ text: "Login successful!", isError: false })
      window.setTimeout(() => {
        onSuccess(res.token, res.user)
        handleClose()
      }, 800)
    } catch (err: any) {
      setMessage({
        text: err.message || "Login failed. Please check your credentials.",
        isError: true,
      })
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault()
    if (!username || !email || !password || !confirmPassword) {
      setMessage({ text: "All fields are required", isError: true })
      return
    }

    if (password !== confirmPassword) {
      setMessage({ text: "Passwords do not match", isError: true })
      return
    }

    setLoading(true)
    setMessage(null)

    try {
      const res = await registerUser(username, email, password)
      saveAuthSession(res.token)
      setMessage({ text: "Registration successful!", isError: false })
      window.setTimeout(() => {
        onSuccess(res.token, res.user)
        handleClose()
      }, 800)
    } catch (err: any) {
      setMessage({ text: err.message || "Registration failed.", isError: true })
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async (e: FormEvent) => {
    e.preventDefault()
    if (!email) {
      setMessage({ text: "Email is required", isError: true })
      return
    }

    setLoading(true)
    setMessage(null)
    setOtpCodePreview(null)

    try {
      const res = await forgotPassword(email)
      setMessage({
        text: res.message || "Verification code sent!",
        isError: false,
      })
      if (res.otpCode) {
        setOtpCodePreview(res.otpCode)
      }
      // Delay slightly then go to reset password tab
      window.setTimeout(() => {
        setTab("reset")
      }, 1500)
    } catch (err: any) {
      setMessage({
        text: err.message || "Failed to request reset link.",
        isError: true,
      })
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault()
    if (!email || !otpCode || !password) {
      setMessage({ text: "All fields are required", isError: true })
      return
    }

    setLoading(true)
    setMessage(null)

    try {
      await resetPassword(email, otpCode, password)
      setMessage({
        text: "Password reset successfully! You can now log in.",
        isError: false,
      })
      setOtpCodePreview(null)
      window.setTimeout(() => {
        setTab("login")
        setMessage(null)
        setPassword("")
        setOtpCode("")
      }, 1500)
    } catch (err: any) {
      setMessage({
        text: err.message || "Password reset failed.",
        isError: true,
      })
    } finally {
      setLoading(false)
    }
  }

  const loginAsDemo = () => {
    saveAuthSession("demo-auth-token")
    onSuccess("demo-auth-token", {
      id: 0,
      username: "Demo User",
      email: "demo@probinary.local",
      role: "user",
    })
    handleClose()
  }

  return createPortal(
    <div style={backdropStyle} onClick={handleClose}>
      <div style={cardStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={headerStyle}>
          <h2
            style={{
              margin: 0,
              fontSize: 18,
              color: "#F3F4F6",
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            {tab === "login" && "Sign In"}
            {tab === "register" && "Create Account"}
            {tab === "forgot" && "Reset Password"}
            {tab === "reset" && "Confirm New Password"}
          </h2>
          <button
            onClick={handleClose}
            style={{
              background: "none",
              border: "none",
              color: "#71717A",
              cursor: "pointer",
              fontSize: 20,
            }}
          >
            &times;
          </button>
        </div>

        {/* Tab Switcher for Login/Register */}
        {(tab === "login" || tab === "register") && (
          <div style={tabContainerStyle}>
            <button
              style={tabStyle(tab === "login")}
              onClick={() => {
                setTab("login")
                setMessage(null)
              }}
            >
              Log In
            </button>
            <button
              style={tabStyle(tab === "register")}
              onClick={() => {
                setTab("register")
                setMessage(null)
              }}
            >
              Sign Up
            </button>
          </div>
        )}

        {/* Feedback Messages */}
        {message && (
          <div style={{ padding: "16px 24px 0" }}>
            <div style={alertStyle(message.isError)}>{message.text}</div>
          </div>
        )}

        {/* OTP Code Dev Preview */}
        {otpCodePreview && (
          <div style={{ padding: "16px 24px 0" }}>
            <div style={alertStyle(false)}>
              <strong>Developer Test Mode:</strong>
              <br />
              Generated OTP:{" "}
              <code
                style={{
                  fontFamily: "monospace",
                  fontSize: 14,
                  color: "#22C55E",
                  background: "rgba(0,0,0,0.2)",
                  padding: "2px 6px",
                  borderRadius: 4,
                }}
              >
                {otpCodePreview}
              </code>
            </div>
          </div>
        )}

        {/* Tab Content */}
        {tab === "login" && (
          <form style={formStyle} onSubmit={handleLogin}>
            <div style={inputGroupStyle}>
              <label style={labelStyle}>Username or Email</label>
              <input
                style={inputStyle}
                type="text"
                placeholder="Enter email or username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div style={inputGroupStyle}>
              <label style={labelStyle}>Password</label>
              <input
                style={inputStyle}
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button
              style={textLinkStyle}
              type="button"
              onClick={() => {
                setTab("forgot")
                setMessage(null)
              }}
            >
              Forgot Password?
            </button>

            <button style={btnPrimaryStyle} type="submit" disabled={loading}>
              {loading ? "Logging in..." : "Sign In"}
            </button>

            <div
              style={{
                borderTop: "1px solid rgba(167, 139, 250, 0.12)",
                margin: "10px 0 0",
                paddingTop: 16,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div
                style={{ textAlign: "center", fontSize: 11, color: "#52525B" }}
              >
                OR TEST INSTANTLY
              </div>
              <button
                style={btnSecondaryStyle}
                type="button"
                onClick={loginAsDemo}
              >
                ⚡ Enter Demo Mode (No DB)
              </button>
            </div>
          </form>
        )}

        {tab === "register" && (
          <form style={formStyle} onSubmit={handleRegister}>
            <div style={inputGroupStyle}>
              <label style={labelStyle}>Username</label>
              <input
                style={inputStyle}
                type="text"
                placeholder="Choose a username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div style={inputGroupStyle}>
              <label style={labelStyle}>Email Address</label>
              <input
                style={inputStyle}
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div style={inputGroupStyle}>
              <label style={labelStyle}>Password</label>
              <input
                style={inputStyle}
                type="password"
                placeholder="Create a strong password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div style={inputGroupStyle}>
              <label style={labelStyle}>Confirm Password</label>
              <input
                style={inputStyle}
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            <button style={btnPrimaryStyle} type="submit" disabled={loading}>
              {loading ? "Creating Account..." : "Sign Up"}
            </button>
          </form>
        )}

        {tab === "forgot" && (
          <form style={formStyle} onSubmit={handleForgotPassword}>
            <p
              style={{
                color: "#A1A1AA",
                fontSize: 13,
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              Enter the email address associated with your account. We will
              simulate sending a 6-digit OTP verification code to reset your
              password.
            </p>
            <div style={inputGroupStyle}>
              <label style={labelStyle}>Email Address</label>
              <input
                style={inputStyle}
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <button style={btnPrimaryStyle} type="submit" disabled={loading}>
              {loading ? "Sending Code..." : "Request Reset Code"}
            </button>

            <button
              style={{ ...btnSecondaryStyle, marginTop: 10 }}
              type="button"
              onClick={() => {
                setTab("login")
                setMessage(null)
              }}
            >
              Back to Login
            </button>
          </form>
        )}

        {tab === "reset" && (
          <form style={formStyle} onSubmit={handleResetPassword}>
            <p
              style={{
                color: "#A1A1AA",
                fontSize: 13,
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              Verify your identity by entering the 6-digit OTP code sent to your
              email, and choose a new password.
            </p>
            <div style={inputGroupStyle}>
              <label style={labelStyle}>Email Address</label>
              <input
                style={inputStyle}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
              />
            </div>
            <div style={inputGroupStyle}>
              <label style={labelStyle}>OTP Code</label>
              <input
                style={inputStyle}
                type="text"
                placeholder="Enter 6-digit code"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
              />
            </div>
            <div style={inputGroupStyle}>
              <label style={labelStyle}>New Password</label>
              <input
                style={inputStyle}
                type="password"
                placeholder="Enter new password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button style={btnPrimaryStyle} type="submit" disabled={loading}>
              {loading ? "Resetting Password..." : "Reset Password"}
            </button>

            <button
              style={{ ...btnSecondaryStyle, marginTop: 10 }}
              type="button"
              onClick={() => {
                setTab("login")
                setMessage(null)
              }}
            >
              Cancel
            </button>
          </form>
        )}
      </div>
    </div>,
    document.body,
  )
}

import { useEffect, useMemo, useState } from "react"

import { useTrading } from "../state/trading"

export default function SuperAdminConsole() {
  const {
    simulationMode,

    role,

    capabilities,

    adminPolicy,

    setAdminPolicy,

    marketList,

    markets,

    openTrades,

    recentTrades,

    lastAction,

    lastError,
  } = useTrading()

  const [draftOutcome, setDraftOutcome] = useState<"won" | "lost" | null>(
    adminPolicy.forceNextOutcome,
  )

  useEffect(() => {
    setDraftOutcome(adminPolicy.forceNextOutcome)
  }, [adminPolicy.forceNextOutcome])

  const topMarkets = useMemo(() => {
    return marketList

      .slice(0, 6)

      .map((market) => markets[market.symbol] ?? market)

      .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
  }, [marketList, markets])

  const applyPolicy = () => {
    setAdminPolicy(draftOutcome)
  }

  if (!simulationMode) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#070B0D",
          display: "grid",
          placeItems: "center",
          padding: 24,
        }}
      >
        <div
          style={{
            width: "min(760px, 100%)",
            borderRadius: 18,
            border: "1px solid rgba(251,191,36,0.35)",
            background: "linear-gradient(145deg, #111827, #111A24)",
            padding: 24,
          }}
        >
          <h1
            style={{
              margin: 0,
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 26,
              color: "#F9FAFB",
            }}
          >
            Super Admin Console
          </h1>
          <p
            style={{
              margin: "12px 0 0",
              color: "#9CA3AF",
              fontSize: 14,
              lineHeight: 1.6,
            }}
          >
            Simulation mode is disabled on the backend. Start the server with
            SIMULATION_MODE=true to use this console.
          </p>
        </div>
      </div>
    )
  }

  if (role !== "super_admin" || !capabilities.canViewAdminPanel) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#070B0D",
          display: "grid",
          placeItems: "center",
          padding: 24,
        }}
      >
        <div
          style={{
            width: "min(760px, 100%)",
            borderRadius: 18,
            border: "1px solid rgba(239,68,68,0.35)",
            background: "linear-gradient(145deg, #1F1720, #161316)",
            padding: 24,
          }}
        >
          <h1
            style={{
              margin: 0,
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 26,
              color: "#F9FAFB",
            }}
          >
            Access Restricted
          </h1>
          <p
            style={{
              margin: "12px 0 0",
              color: "#D1D5DB",
              fontSize: 14,
              lineHeight: 1.6,
            }}
          >
            This page is reserved for super admin simulation control.
          </p>
        </div>
      </div>
    )
  }

  return (
    <main
      style={{
        minHeight: "100vh",

        padding: 22,

        background:
          "radial-gradient(90% 70% at 12% 0%, rgba(45,212,191,0.14), transparent 65%), radial-gradient(90% 80% at 100% 100%, rgba(251,191,36,0.1), transparent 62%), #06090B",

        color: "#E5E7EB",
      }}
    >
      <section
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          marginBottom: 18,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.08em",
              color: "#2DD4BF",
              fontWeight: 700,
              textTransform: "uppercase",
            }}
          >
            One-Page Control Deck
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
            Super Admin Simulation Console
          </h1>
          <p style={{ margin: "10px 0 0", color: "#9CA3AF", fontSize: 14 }}>
            Manage AdminSim behavior only. Trading controls are intentionally
            unavailable here.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Badge
            label="SIMULATION"
            color="#F59E0B"
            border="rgba(245,158,11,0.42)"
          />
          <Badge
            label="ROLE SUPER_ADMIN"
            color="#2DD4BF"
            border="rgba(45,212,191,0.42)"
          />
        </div>
      </section>

      <section
        style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 16 }}
      >
        <article style={panelStyle}>
          <div style={panelTitleStyle}>AdminSim Outcome Policy</div>
          <div style={{ display: "grid", gap: 12 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 8,
              }}
            >
              <PolicyButton
                label="No Override"
                active={draftOutcome === null}
                onClick={() => setDraftOutcome(null)}
                accent="#6B7280"
              />
              <PolicyButton
                label="Force Win"
                active={draftOutcome === "won"}
                onClick={() => setDraftOutcome("won")}
                accent="#10B981"
              />
              <PolicyButton
                label="Force Loss"
                active={draftOutcome === "lost"}
                onClick={() => setDraftOutcome("lost")}
                accent="#EF4444"
              />
            </div>

            <button
              onClick={applyPolicy}
              style={{
                border: "1px solid rgba(45,212,191,0.5)",

                background:
                  "linear-gradient(145deg, rgba(20,184,166,0.3), rgba(20,184,166,0.15))",

                color: "#ECFEFF",

                borderRadius: 12,

                height: 40,

                fontSize: 13,

                fontWeight: 700,

                letterSpacing: "0.04em",

                cursor: "pointer",
              }}
            >
              APPLY TO ADMINSIM
            </button>

            <div style={dataCardStyle}>
              <DataRow
                label="Pending Override"
                value={
                  adminPolicy.forceNextOutcome
                    ? adminPolicy.forceNextOutcome.toUpperCase()
                    : "NONE"
                }
              />
              <DataRow
                label="Updated By"
                value={adminPolicy.updatedBy ?? "N/A"}
              />
              <DataRow
                label="Updated At"
                value={
                  adminPolicy.updatedAt
                    ? new Date(adminPolicy.updatedAt).toLocaleString()
                    : "Never"
                }
              />
              <DataRow
                label="Last Applied"
                value={
                  adminPolicy.lastAppliedAt
                    ? new Date(adminPolicy.lastAppliedAt).toLocaleString()
                    : "Never"
                }
              />
            </div>
          </div>
        </article>

        <article style={panelStyle}>
          <div style={panelTitleStyle}>System Pulse</div>
          <div style={{ display: "grid", gap: 9 }}>
            <PulseMetric
              label="Open Trades"
              value={String(openTrades.length)}
            />
            <PulseMetric
              label="Settled Trades (Recent)"
              value={String(recentTrades.length)}
            />
            <PulseMetric
              label="Last Event"
              value={lastError ? "ERROR" : "OK"}
              danger={Boolean(lastError)}
            />
          </div>

          <div style={{ marginTop: 12, ...dataCardStyle }}>
            <div
              style={{
                fontSize: 11,
                color: "#6B7280",
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: "0.07em",
              }}
            >
              Feed
            </div>
            <div
              style={{
                fontSize: 13,
                color: lastError ? "#FCA5A5" : "#9CA3AF",
                lineHeight: 1.6,
              }}
            >
              {lastError ?? lastAction ?? "No system events yet."}
            </div>
          </div>
        </article>
      </section>

      <section style={{ marginTop: 16 }}>
        <article style={panelStyle}>
          <div style={panelTitleStyle}>Market Volatility Radar</div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
              gap: 10,
            }}
          >
            {topMarkets.map((market) => (
              <div
                key={market.symbol}
                style={{
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.07)",
                  background: "rgba(255,255,255,0.02)",
                  padding: 10,
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    color: "#F3F4F6",
                    fontWeight: 700,
                    marginBottom: 4,
                  }}
                >
                  {market.symbol}
                </div>
                <div
                  style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 7 }}
                >
                  {market.name}
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontSize: 12,
                      color: "#D1D5DB",
                    }}
                  >
                    {market.price.toFixed(2)}
                  </span>
                  <span
                    style={{
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontSize: 12,
                      color: market.changePct >= 0 ? "#34D399" : "#F87171",
                    }}
                  >
                    {market.changePct >= 0 ? "+" : ""}
                    {market.changePct.toFixed(2)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>
    </main>
  )
}

function Badge({
  label,
  color,
  border,
}: {
  label: string
  color: string
  border: string
}) {
  return (
    <span
      style={{
        fontSize: 10,

        fontWeight: 700,

        color,

        border: `1px solid ${border}`,

        borderRadius: 999,

        padding: "4px 8px",

        letterSpacing: "0.06em",
      }}
    >
      {label}
    </span>
  )
}

function PolicyButton({
  label,

  active,

  onClick,

  accent,
}: {
  label: string

  active: boolean

  onClick: () => void

  accent: string
}) {
  return (
    <button
      onClick={onClick}
      style={{
        height: 36,

        borderRadius: 10,

        border: `1px solid ${active ? accent : "rgba(255,255,255,0.1)"}`,

        background: active
          ? "rgba(255,255,255,0.08)"
          : "rgba(255,255,255,0.02)",

        color: active ? "#F9FAFB" : "#9CA3AF",

        fontSize: 12,

        fontWeight: 700,

        cursor: "pointer",
      }}
    >
      {label}
    </button>
  )
}

function PulseMetric({
  label,
  value,
  danger = false,
}: {
  label: string
  value: string
  danger?: boolean
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.02)",
        borderRadius: 10,
        padding: "8px 10px",
      }}
    >
      <span style={{ fontSize: 12, color: "#9CA3AF" }}>{label}</span>
      <span
        style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 12,
          color: danger ? "#FCA5A5" : "#E5E7EB",
          fontWeight: 700,
        }}
      >
        {value}
      </span>
    </div>
  )
}

function DataRow({ label, value }: { label: string value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        marginBottom: 7,
      }}
    >
      <span style={{ fontSize: 12, color: "#6B7280" }}>{label}</span>
      <span
        style={{
          fontSize: 12,
          color: "#E5E7EB",
          fontFamily: "'IBM Plex Mono', monospace",
          textAlign: "right",
        }}
      >
        {value}
      </span>
    </div>
  )
}

const panelStyle: React.CSSProperties = {
  borderRadius: 14,

  border: "1px solid rgba(255,255,255,0.08)",

  background:
    "linear-gradient(145deg, rgba(17,24,39,0.9), rgba(12,18,28,0.92))",

  padding: 14,
}

const panelTitleStyle: React.CSSProperties = {
  fontSize: 11,

  color: "#2DD4BF",

  fontWeight: 700,

  textTransform: "uppercase",

  letterSpacing: "0.06em",

  marginBottom: 10,
}

const dataCardStyle: React.CSSProperties = {
  borderRadius: 10,

  border: "1px solid rgba(255,255,255,0.08)",

  background: "rgba(255,255,255,0.02)",

  padding: 10,
}

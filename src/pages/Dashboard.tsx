import { useState } from "react"
import { marketLabel, useTrading } from "../state/trading"
import type { User } from "../services/authApi"

interface Props {
  onTrade: () => void
  onMarkets: () => void
  user?: User | null
}

const SUMMARY_CARDS = [
  {
    label: "Balance",
    value: "$24,841.20",
    delta: null,
    color: "#FFFFFF",
    icon: <WalletMiniIcon />,
  },

  {
    label: "Equity",
    value: "$26,312.55",
    delta: "+5.93%",
    color: "#22C55E",
    icon: <TrendUpIcon />,
  },

  {
    label: "Free Margin",
    value: "$18,920.00",
    delta: null,
    color: "#A1A1AA",
    icon: <ShieldMiniIcon />,
  },

  {
    label: "Open Positions",
    value: "7",
    delta: null,
    color: "#A855F7",
    icon: <LayersIcon />,
  },

  {
    label: "Today's P&L",
    value: "+$1,471.35",
    delta: "+6.29%",
    color: "#22C55E",
    icon: <ProfitIcon />,
  },

  {
    label: "Drawdown",
    value: "-$312.40",
    delta: "-1.26%",
    color: "#EF4444",
    icon: <LossIcon />,
  },

  {
    label: "Win Rate",
    value: "73.2%",
    delta: "+2.1%",
    color: "#A855F7",
    icon: <StarIcon />,
  },

  {
    label: "ROI (MTD)",
    value: "+18.4%",
    delta: "This month",
    color: "#F59E0B",
    icon: <RoiIcon />,
  },
]

const RECENT_TRADES = [
  {
    id: "TRD-8821",
    market: "VOL-75",
    dir: "BUY",
    entry: 8120.44,
    exit: 8243.12,
    lot: 0.5,
    profit: +342.8,
    status: "closed",
  },

  {
    id: "TRD-8820",
    market: "BOOM-500",
    dir: "SELL",
    entry: 13201.0,
    exit: 12891.44,
    lot: 0.2,
    profit: +185.44,
    status: "closed",
  },

  {
    id: "TRD-8819",
    market: "CRASH-300",
    dir: "BUY",
    entry: 5890.2,
    exit: 5674.8,
    lot: 0.3,
    profit: -189.22,
    status: "closed",
  },

  {
    id: "TRD-8818",
    market: "VOL-100",
    dir: "BUY",
    entry: 15100.0,
    exit: 15420.33,
    lot: 0.1,
    profit: +96.1,
    status: "closed",
  },

  {
    id: "TRD-8817",
    market: "VOL-75",
    dir: "SELL",
    entry: 8400.0,
    exit: 8180.0,
    lot: 0.4,
    profit: +256.0,
    status: "closed",
  },

  {
    id: "TRD-8816",
    market: "STEP-UP",
    dir: "BUY",
    entry: 8900.0,
    exit: 9122.64,
    lot: 0.25,
    profit: +162.98,
    status: "closed",
  },
]

const WATCHLIST = [
  { symbol: "VOL-75", price: 8243.12, change: +2.34 },

  { symbol: "BOOM-500", price: 12891.44, change: +5.17 },

  { symbol: "CRASH-300", price: 5674.8, change: -1.89 },

  { symbol: "VOL-100", price: 15420.33, change: +3.62 },

  { symbol: "STEP-UP", price: 9122.64, change: +2.85 },

  { symbol: "JUMP-10", price: 18934.0, change: +4.23 },
]

const NEWS = [
  {
    time: "14:22",
    tag: "MARKET",
    title: "Volatility indices surge amid global market uncertainty",
    severity: "warning",
  },

  {
    time: "13:05",
    tag: "UPDATE",
    title: "probinary adds 12 new synthetic indices to platform",
    severity: "info",
  },

  {
    time: "11:48",
    tag: "ALERT",
    title: "Crash 500 approaching key support level at 5,600",
    severity: "danger",
  },

  {
    time: "09:30",
    tag: "NEWS",
    title: "Boom 1000 hits new monthly high — traders' sentiment bullish",
    severity: "success",
  },
]

function generatePerformanceData(count: number) {
  const pts: number[] = [10000]

  for (let i = 1; i < count; i++) {
    const last = pts[i - 1]

    pts.push(Math.max(7000, last + (Math.random() - 0.44) * last * 0.018))
  }

  return pts
}

function PerformanceChart({ data }: { data: number[] }) {
  const w = 600

  const h = 140

  const min = Math.min(...data)

  const max = Math.max(...data)

  const range = max - min || 1

  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * w,

    y: h - ((v - min) / range) * (h - 16) - 8,
  }))

  const line = pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ")

  const area = `${line} L${w},${h} L0,${h} Z`

  // Generate week labels

  const weeks = [
    "Aug 1",
    "Aug 8",
    "Aug 15",
    "Aug 22",
    "Aug 29",
    "Sep 5",
    "Sep 12",
    "Sep 19",
  ]

  return (
    <div style={{ position: "relative" }}>
      <svg
        width="100%"
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        style={{ display: "block", height: 140 }}
      >
        <defs>
          <linearGradient id="perfGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#7C3AED" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1="0"
            y1={h * f}
            x2={w}
            y2={h * f}
            stroke="rgba(255,255,255,0.04)"
            strokeWidth="1"
          />
        ))}
        <path d={area} fill="url(#perfGrad)" />
        <path
          d={line}
          fill="none"
          stroke="#A855F7"
          strokeWidth="1.8"
          style={{ filter: "drop-shadow(0 0 5px rgba(168,85,247,0.6))" }}
        />
        {/* Current point */}
        <circle
          cx={pts[pts.length - 1].x}
          cy={pts[pts.length - 1].y}
          r="4"
          fill="#A855F7"
          style={{ filter: "drop-shadow(0 0 4px #A855F7)" }}
        />
      </svg>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 8,
        }}
      >
        {weeks.map((w) => (
          <span
            key={w}
            style={{
              fontSize: 10,
              color: "#3F3F46",
              fontFamily: "'IBM Plex Mono', monospace",
            }}
          >
            {w}
          </span>
        ))}
      </div>
    </div>
  )
}

function MiniSparkline({ positive }: { positive: boolean }) {
  const pts = Array.from({ length: 14 }, (_, i) => {
    const base = 50

    return base + (Math.random() - (positive ? 0.42 : 0.58)) * 30
  })

  const min = Math.min(...pts)

  const max = Math.max(...pts)

  const range = max - min || 1

  const w = 64,
    h = 24

  const svgPts = pts.map(
    (v, i) => `${(i / (pts.length - 1)) * w},${h - ((v - min) / range) * h}`,
  )

  const line = svgPts.map((p, i) => `${i === 0 ? "M" : "L"}${p}`).join(" ")

  const color = positive ? "#22C55E" : "#EF4444"

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  )
}

export default function Dashboard({ onTrade, onMarkets, user }: Props) {
  const getGreeting = () => {
    const hr = new Date().getHours()
    if (hr < 12) return "Good morning"
    if (hr < 17) return "Good afternoon"
    return "Good evening"
  }
  const {
    balance,
    equity,
    realizedPnl,
    winRate,
    openTrades,
    recentTrades,
    marketList,
    markets,
    placeTrade,
    selectMarket,
  } = useTrading()

  const [perfData] = useState(() => generatePerformanceData(60))

  const [orderSide, setOrderSide] = useState<"buy" | "sell">("buy")

  const [lotSize, setLotSize] = useState("0.50")

  const [market, setMarket] = useState("VOL-75")

  const [perfTab, setPerfTab] = useState("weekly")

  const watchlist = marketList.slice(0, 6)

  const summaryCards = [
    {
      label: "Balance",
      value: `$${balance.toFixed(2)}`,
      delta: null,
      color: "#FFFFFF",
      icon: <WalletMiniIcon />,
    },

    {
      label: "Equity",
      value: `$${equity.toFixed(2)}`,
      delta: `${
        equity >= balance ? "+" : "-"
      }${Math.abs((equity / Math.max(balance, 1) - 1) * 100).toFixed(2)}%`,
      color: "#22C55E",
      icon: <TrendUpIcon />,
    },

    {
      label: "Free Margin",
      value: `$${balance.toFixed(2)}`,
      delta: null,
      color: "#A1A1AA",
      icon: <ShieldMiniIcon />,
    },

    {
      label: "Open Positions",
      value: String(openTrades.length),
      delta: null,
      color: "#A855F7",
      icon: <LayersIcon />,
    },

    {
      label: "Today's P&L",
      value: `${
        realizedPnl >= 0 ? "+" : "-"
      }$${Math.abs(realizedPnl).toFixed(2)}`,
      delta: `${
        realizedPnl >= 0 ? "+" : "-"
      }${Math.abs((realizedPnl / 25000) * 100).toFixed(2)}%`,
      color: realizedPnl >= 0 ? "#22C55E" : "#EF4444",
      icon: <ProfitIcon />,
    },

    {
      label: "Drawdown",
      value: `-$${Math.abs(Math.min(realizedPnl, 312.4)).toFixed(2)}`,
      delta: realizedPnl < 0 ? "-1.26%" : "Stable",
      color: "#EF4444",
      icon: <LossIcon />,
    },

    {
      label: "Win Rate",
      value: `${winRate.toFixed(1)}%`,
      delta: "+Live",
      color: "#A855F7",
      icon: <StarIcon />,
    },

    {
      label: "ROI (MTD)",
      value: `${((realizedPnl / 25000) * 100).toFixed(1)}%`,
      delta: "This month",
      color: "#F59E0B",
      icon: <RoiIcon />,
    },
  ]

  const handleQuickTrade = () => {
    placeTrade({
      symbol: market,

      contractType: "rise-fall",

      direction: orderSide === "buy" ? "rise" : "fall",

      stake: parseFloat(lotSize || "0"),

      expirySeconds: 30,
    })

    selectMarket(market)
  }

  return (
    <div
      style={{
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        gap: 20,
        minHeight: "100%",
      }}
    >
      {/* Page header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h1
            className="font-display"
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: "#FFFFFF",
              margin: 0,
              letterSpacing: "-0.5px",
            }}
          >
            {getGreeting()}, {user?.username || "Alex"} 👋
          </h1>
          <p style={{ fontSize: 13, color: "#52525B", margin: "4px 0 0" }}>
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}{" "}
            ·{" "}
            {new Date().getDay() === 0 || new Date().getDay() === 6
              ? "OTC Markets Open"
              : "Markets Open"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            className="btn-ghost"
            style={{ padding: "9px 18px", borderRadius: 10, fontSize: 13 }}
            onClick={onMarkets}
          >
            View Markets
          </button>
          <button
            className="btn-primary"
            style={{ padding: "9px 20px", borderRadius: 10, fontSize: 13 }}
            onClick={onTrade}
          >
            Open Trade
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 14,
        }}
      >
        {summaryCards.map((card) => (
          <div key={card.label} className="stat-card">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 12,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#3F3F46",
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                }}
              >
                {card.label}
              </span>
              <div
                style={{
                  color: card.delta
                    ? card.delta.startsWith("+")
                      ? "#22C55E"
                      : card.delta.startsWith("-")
                        ? "#EF4444"
                        : "#52525B"
                    : "#52525B",
                  display: "flex",
                }}
              >
                {card.icon}
              </div>
            </div>
            <div
              className="font-mono-data"
              style={{
                fontSize: 20,
                fontWeight: 600,
                color: card.color,
                letterSpacing: "-0.5px",
                marginBottom: card.delta ? 6 : 0,
              }}
            >
              {card.value}
            </div>
            {card.delta && (
              <div
                style={{
                  fontSize: 11,
                  color: card.delta.startsWith("+")
                    ? "#22C55E"
                    : card.delta.startsWith("-")
                      ? "#EF4444"
                      : "#52525B",
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontWeight: 500,
                }}
              >
                {card.delta}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Main grid: chart + watchlist + quick trade */}
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 20 }}
      >
        {/* Left: performance chart + recent trades */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Performance chart */}
          <div className="card-base" style={{ padding: "20px 24px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <div>
                <h3
                  className="font-display"
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: "#FFFFFF",
                    margin: 0,
                  }}
                >
                  Portfolio Performance
                </h3>
                <div
                  className="font-mono-data"
                  style={{
                    fontSize: 22,
                    fontWeight: 600,
                    color: "#22C55E",
                    marginTop: 4,
                  }}
                >
                  +$6,312.55{" "}
                  <span style={{ fontSize: 13, color: "#22C55E" }}>+34.2%</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                {["weekly", "monthly", "3m", "all"].map((t) => (
                  <button
                    key={t}
                    onClick={() => setPerfTab(t)}
                    style={{
                      padding: "5px 12px",
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 600,

                      cursor: "pointer",
                      border: "none",
                      fontFamily: "'IBM Plex Mono', monospace",

                      background:
                        perfTab === t ? "rgba(124,58,237,0.2)" : "transparent",

                      color: perfTab === t ? "#A855F7" : "#52525B",

                      transition: "all 0.2s",
                    }}
                  >
                    {t.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <PerformanceChart data={perfData} />
          </div>

          {/* Recent trades */}
          <div className="card-base" style={{ padding: "20px 0" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0 24px 14px",
                borderBottom: "1px solid rgba(255,255,255,0.04)",
              }}
            >
              <h3
                className="font-display"
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: "#FFFFFF",
                  margin: 0,
                }}
              >
                Recent Trades
              </h3>
              <button
                style={{
                  fontSize: 12,
                  color: "#7C3AED",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "'Inter', sans-serif",
                  fontWeight: 600,
                }}
              >
                View All →
              </button>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                  >
                    {[
                      "Trade ID",
                      "Market",
                      "Direction",
                      "Entry",
                      "Exit",
                      "Lot",
                      "P&L",
                    ].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: "10px 24px",
                          textAlign: "left",
                          fontSize: 11,
                          fontWeight: 600,
                          color: "#3F3F46",
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentTrades.map((tr) => (
                    <tr
                      key={tr.id}
                      style={{
                        borderBottom: "1px solid rgba(255,255,255,0.03)",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background =
                          "rgba(124,58,237,0.04)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "transparent")
                      }
                    >
                      <td style={{ padding: "12px 24px" }}>
                        <span
                          className="font-mono-data"
                          style={{ fontSize: 12, color: "#52525B" }}
                        >
                          {tr.id}
                        </span>
                      </td>
                      <td style={{ padding: "12px 24px" }}>
                        <span
                          className="font-display"
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "#FFFFFF",
                          }}
                        >
                          {tr.symbol}
                        </span>
                      </td>
                      <td style={{ padding: "12px 24px" }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: "3px 9px",
                            borderRadius: 6,
                            fontFamily: "'IBM Plex Mono', monospace",

                            background:
                              tr.result === "won"
                                ? "rgba(34,197,94,0.12)"
                                : "rgba(239,68,68,0.12)",

                            color: tr.result === "won" ? "#22C55E" : "#EF4444",
                          }}
                        >
                          {marketLabel(tr.direction)}
                        </span>
                      </td>
                      <td style={{ padding: "12px 24px" }}>
                        <span
                          className="font-mono-data"
                          style={{ fontSize: 12, color: "#A1A1AA" }}
                        >
                          {tr.entryPrice.toFixed(2)}
                        </span>
                      </td>
                      <td style={{ padding: "12px 24px" }}>
                        <span
                          className="font-mono-data"
                          style={{ fontSize: 12, color: "#A1A1AA" }}
                        >
                          {(tr.exitPrice ?? tr.entryPrice).toFixed(2)}
                        </span>
                      </td>
                      <td style={{ padding: "12px 24px" }}>
                        <span
                          className="font-mono-data"
                          style={{ fontSize: 12, color: "#71717A" }}
                        >
                          {tr.stake.toFixed(2)}
                        </span>
                      </td>
                      <td style={{ padding: "12px 24px" }}>
                        <span
                          className="font-mono-data"
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color:
                              (tr.profit ?? 0) >= 0 ? "#22C55E" : "#EF4444",
                          }}
                        >
                          {(tr.profit ?? 0) >= 0 ? "+" : ""}
                          {(tr.profit ?? 0).toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right: watchlist + quick trade */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Watchlist */}
          <div className="card-base" style={{ padding: "16px 0" }}>
            <div
              style={{
                padding: "0 16px 12px",
                borderBottom: "1px solid rgba(255,255,255,0.04)",
              }}
            >
              <h3
                className="font-display"
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#FFFFFF",
                  margin: 0,
                }}
              >
                Watchlist
              </h3>
            </div>
            <div>
              {watchlist.map((w, i) => (
                <div
                  key={w.symbol}
                  onClick={() => {
                    selectMarket(w.symbol)
                    onTrade()
                  }}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "11px 16px",
                    cursor: "pointer",
                    borderBottom:
                      i < WATCHLIST.length - 1
                        ? "1px solid rgba(255,255,255,0.03)"
                        : "none",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "rgba(124,58,237,0.05)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  <div>
                    <div
                      className="font-display"
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#FFFFFF",
                        marginBottom: 2,
                      }}
                    >
                      {w.symbol}
                    </div>
                    <div
                      className="font-mono-data"
                      style={{ fontSize: 11, color: "#52525B" }}
                    >
                      Synthetic
                    </div>
                  </div>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 10 }}
                  >
                    <MiniSparkline
                      positive={(markets[w.symbol]?.changePct ?? 0) >= 0}
                    />
                    <div style={{ textAlign: "right" }}>
                      <div
                        className="font-mono-data"
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: "#FFFFFF",
                        }}
                      >
                        {(markets[w.symbol]?.price ?? w.price).toFixed(2)}
                      </div>
                      <div
                        className="font-mono-data"
                        style={{
                          fontSize: 11,
                          color:
                            (markets[w.symbol]?.changePct ?? 0) >= 0
                              ? "#22C55E"
                              : "#EF4444",
                        }}
                      >
                        {(markets[w.symbol]?.changePct ?? 0) >= 0 ? "+" : ""}
                        {(markets[w.symbol]?.changePct ?? 0).toFixed(2)}%
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick trade */}
          <div className="card-base" style={{ padding: 18 }}>
            <h3
              className="font-display"
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "#FFFFFF",
                margin: "0 0 14px",
              }}
            >
              Quick Trade
            </h3>

            {/* Market select */}
            <div style={{ marginBottom: 12 }}>
              <div className="field-label">Market</div>
              <select
                value={market}
                onChange={(e) => {
                  setMarket(e.target.value)
                  selectMarket(e.target.value)
                }}
                className="field-input"
                style={{ cursor: "pointer" }}
              >
                {watchlist.map((w) => (
                  <option key={w.symbol} value={w.symbol}>
                    {w.symbol}
                  </option>
                ))}
              </select>
            </div>

            {/* Buy / Sell */}
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <button
                onClick={() => setOrderSide("buy")}
                className={`order-side-btn order-buy ${
                  orderSide === "buy" ? "active" : ""
                }`}
              >
                BUY
              </button>
              <button
                onClick={() => setOrderSide("sell")}
                className={`order-side-btn order-sell ${
                  orderSide === "sell" ? "active" : ""
                }`}
              >
                SELL
              </button>
            </div>

            {/* Lot size */}
            <div style={{ marginBottom: 12 }}>
              <div className="field-label">Lot Size</div>
              <input
                type="number"
                value={lotSize}
                onChange={(e) => setLotSize(e.target.value)}
                className="field-input"
                step="0.01"
                min="0.01"
              />
            </div>

            {/* Margin + Potential */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                marginBottom: 14,
                padding: "10px 12px",
                background: "#12121A",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.05)",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 10,
                    color: "#3F3F46",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  Margin
                </div>
                <div
                  className="font-mono-data"
                  style={{ fontSize: 13, color: "#A1A1AA", marginTop: 3 }}
                >
                  ${parseFloat(lotSize || "0").toFixed(2)}
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: 10,
                    color: "#3F3F46",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  Potential
                </div>
                <div
                  className="font-mono-data"
                  style={{
                    fontSize: 13,
                    color: orderSide === "buy" ? "#22C55E" : "#EF4444",
                    marginTop: 3,
                  }}
                >
                  ~${(parseFloat(lotSize || "0") * 0.82).toFixed(2)}
                </div>
              </div>
            </div>

            <button
              className={`execute-btn ${
                orderSide === "buy" ? "execute-buy" : "execute-sell"
              }`}
              onClick={handleQuickTrade}
            >
              {orderSide === "buy" ? "▲ Place Buy Order" : "▼ Place Sell Order"}
            </button>
          </div>

          {/* News */}
          <div className="card-base" style={{ padding: "16px 0" }}>
            <div
              style={{
                padding: "0 16px 10px",
                borderBottom: "1px solid rgba(255,255,255,0.04)",
              }}
            >
              <h3
                className="font-display"
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#FFFFFF",
                  margin: 0,
                }}
              >
                Market News
              </h3>
            </div>
            {NEWS.map((n, i) => (
              <div
                key={i}
                style={{
                  padding: "10px 16px",
                  borderBottom:
                    i < NEWS.length - 1
                      ? "1px solid rgba(255,255,255,0.03)"
                      : "none",
                  cursor: "pointer",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "rgba(255,255,255,0.02)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    marginBottom: 4,
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "2px 7px",
                      borderRadius: 4,
                      fontFamily: "'IBM Plex Mono', monospace",

                      background:
                        n.severity === "warning"
                          ? "rgba(245,158,11,0.15)"
                          : n.severity === "danger"
                            ? "rgba(239,68,68,0.15)"
                            : n.severity === "success"
                              ? "rgba(34,197,94,0.15)"
                              : "rgba(59,130,246,0.15)",

                      color:
                        n.severity === "warning"
                          ? "#F59E0B"
                          : n.severity === "danger"
                            ? "#EF4444"
                            : n.severity === "success"
                              ? "#22C55E"
                              : "#3B82F6",
                    }}
                  >
                    {n.tag}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: "#3F3F46",
                      fontFamily: "'IBM Plex Mono', monospace",
                    }}
                  >
                    {n.time}
                  </span>
                </div>
                <p
                  style={{
                    fontSize: 12,
                    color: "#71717A",
                    margin: 0,
                    lineHeight: 1.5,
                  }}
                >
                  {n.title}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* Mini icons */

function WalletMiniIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="2" y="5" width="20" height="14" rx="3" />
      <path d="M2 9h20" strokeLinecap="round" />
    </svg>
  )
}

function TrendUpIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        d="M3 17l5-5 4 4 9-9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M15 7h6v6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ShieldMiniIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function LayersIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ProfitIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"
        strokeLinecap="round"
      />
    </svg>
  )
}

function LossIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M3 7l5 5 4-4 9 9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 17h6v-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function StarIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}

function RoiIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9 9c1.66 0 3-4.03 3-9s-1.34-9-3-9m0 18c-1.66 0-3-4.03-3-9s1.34-9 3-9m-9 9a9 9 0 0 1 9-9"
        strokeLinecap="round"
      />
    </svg>
  )
}

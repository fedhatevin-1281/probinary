import { useState } from "react"

import { useTrading, buildSeriesShape } from "../state/trading"

import AuthModal from "../components/AuthModal"

interface Props {
  onEnter: () => void

  onAuthSuccess: (token: string, user: any) => void
}

const TICKER_ITEMS = [
  { symbol: "VOL-75", price: 8243.12, change: +2.34 },

  { symbol: "BOOM-500", price: 12891.44, change: +5.17 },

  { symbol: "CRASH-300", price: 5674.8, change: -1.89 },

  { symbol: "VOL-100", price: 15420.33, change: +3.62 },

  { symbol: "BOOM-1000", price: 22104.55, change: +8.91 },

  { symbol: "CRASH-500", price: 4312.2, change: -3.41 },

  { symbol: "VOL-25", price: 3891.77, change: +1.12 },

  { symbol: "STEP-UP", price: 9122.64, change: +2.85 },

  { symbol: "VOL-50", price: 6789.31, change: -0.77 },

  { symbol: "JUMP-10", price: 18934.0, change: +4.23 },
]

const STATS = [
  { label: "Daily Volume", value: "$2.84B", sub: "+12.4% today" },

  { label: "Active Traders", value: "148,920", sub: "3,241 online now" },

  { label: "Markets", value: "240+", sub: "Synthetic & crypto" },

  { label: "Uptime", value: "99.97%", sub: "Last 365 days" },
]

const FEATURES = [
  {
    icon: <ChartIcon />,

    title: "Synthetic Markets",

    desc: "Trade Volatility, Boom, Crash, Step, Jump, and Range indices — available 24/7 with no slippage.",

    accent: "#7C3AED",
  },

  {
    icon: <ShieldIcon />,

    title: "Institutional-Grade Security",

    desc: "Multi-layer authentication, cold storage, and real-time risk monitoring protect every account.",

    accent: "#6366F1",
  },

  {
    icon: <LightningIcon />,

    title: "Sub-Millisecond Execution",

    desc: "Our proprietary tick engine delivers price updates up to 100 times per second with guaranteed execution.",

    accent: "#A855F7",
  },

  {
    icon: <BrainIcon />,

    title: "AI-Powered Insights",

    desc: "Get real-time market summaries, trade suggestions, and indicator explanations from our built-in AI assistant.",

    accent: "#8B5CF6",
  },

  {
    icon: <GlobeIcon />,

    title: "Global Access",

    desc: "Trade from anywhere with full mobile support, API access, and multi-device synchronization.",

    accent: "#7C3AED",
  },

  {
    icon: <AcademyIcon />,

    title: "Learning Center",

    desc: "Master synthetic trading with structured courses, video tutorials, and a live practice environment.",

    accent: "#6366F1",
  },
]

function HeroChart({ data }: { data: number[] }) {
  const w = 500

  const h = 200

  const { line, area, points } = buildSeriesShape(data, w, h, 10)

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="heroGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#7C3AED" stopOpacity="0" />
        </linearGradient>
        <filter id="heroGlow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      <path d={area} fill="url(#heroGrad)" />
      <path
        d={line}
        fill="none"
        stroke="#A855F7"
        strokeWidth="2"
        filter="url(#heroGlow)"
      />
      <path d={line} fill="none" stroke="#C084FC" strokeWidth="1.2" />
      {/* Last price dot */}
      <circle
        cx={points[points.length - 1].x}
        cy={points[points.length - 1].y}
        r="5"
        fill="#A855F7"
        style={{ filter: "drop-shadow(0 0 6px #A855F7)" }}
      />
    </svg>
  )
}

export default function Landing({ onEnter, onAuthSuccess }: Props) {
  const [authModalOpen, setAuthModalOpen] = useState(false)

  const { marketList, markets } = useTrading()

  const heroMarket = markets["VOL-75"] ?? marketList[0]

  const chartData = heroMarket?.history.slice(-80) ?? []

  const livePrice = heroMarket?.price ?? 0

  const tickerItems = TICKER_ITEMS.map((item) => {
    const market = markets[item.symbol]

    return market
      ? { ...item, price: market.price, change: market.changePct }
      : item
  })

  return (
    <div
      style={{ background: "#09090F", minHeight: "100vh", overflowX: "hidden" }}
    >
      {/* Background orbs */}
      <div
        className="orb"
        style={{
          width: 600,
          height: 600,
          background:
            "radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 70%)",
          top: -200,
          left: -100,
          animationDelay: "0s",
        }}
      />
      <div
        className="orb"
        style={{
          width: 400,
          height: 400,
          background:
            "radial-gradient(circle, rgba(99,102,241,0.14) 0%, transparent 70%)",
          top: 100,
          right: -50,
          animationDelay: "-4s",
        }}
      />
      <div
        className="orb"
        style={{
          width: 300,
          height: 300,
          background:
            "radial-gradient(circle, rgba(168,85,247,0.1) 0%, transparent 70%)",
          bottom: 200,
          left: "30%",
          animationDelay: "-8s",
        }}
      />

      {/* Navbar */}
      <nav className="glass-nav px-6 md:px-12 fixed top-0 left-0 right-0 z-50 h-16 flex items-center justify-between gap-4 md:gap-8">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img
            src="/logo.png"
            alt="Pro Binary logo"
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              objectFit: "cover",
              boxShadow: "0 0 18px rgba(124,58,237,0.45)",
            }}
          />
          <span
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700,
              fontSize: 17,
              color: "#FFFFFF",
              letterSpacing: "-0.3px",
            }}
          >
            pro<span style={{ color: "#A855F7" }}>binary</span>
          </span>
        </div>

        <div style={{ flex: 1 }} />

        <div className="hidden lg:flex" style={{ gap: 6 }}>
          {["Markets", "Trading", "Academy", "Community"].map((l) => (
            <button
              key={l}
              style={{
                background: "none",
                border: "none",
                color: "#71717A",
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
                padding: "6px 14px",
                borderRadius: 8,
                transition: "color 0.2s",
                fontFamily: "'Inter', sans-serif",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#A1A1AA")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#71717A")}
            >
              {l}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <button
            className="btn-ghost"
            style={{ padding: "8px 18px", borderRadius: 10, fontSize: 14 }}
            onClick={() => setAuthModalOpen(true)}
          >
            Log In
          </button>
          <button
            className="btn-primary"
            style={{ padding: "8px 20px", borderRadius: 10, fontSize: 14 }}
            onClick={() => setAuthModalOpen(true)}
          >
            Get Started
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section
        className="pt-28 pb-12 px-6 md:px-12"
        style={{
          maxWidth: 1280,
          margin: "0 auto",
        }}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left: copy */}
          <div className="slide-up">
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "rgba(124,58,237,0.1)",
                border: "1px solid rgba(124,58,237,0.2)",
                borderRadius: 20,
                padding: "5px 14px",
                marginBottom: 28,
              }}
            >
              <div className="live-dot" />
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#A855F7",
                  fontFamily: "'Space Grotesk', sans-serif",
                  letterSpacing: "0.05em",
                }}
              >
                LIVE SYNTHETIC MARKETS
              </span>
            </div>

            <h1
              className="font-display"
              style={{
                fontSize: "clamp(40px, 5vw, 64px)",
                fontWeight: 700,
                lineHeight: 1.1,
                letterSpacing: "-1.5px",
                margin: "0 0 24px",
                color: "#FFFFFF",
              }}
            >
              Trade the Future of
              <br />
              <span className="gradient-text-animated">Synthetic Markets</span>
            </h1>

            <p
              style={{
                fontSize: 18,
                color: "#71717A",
                lineHeight: 1.7,
                margin: "0 0 40px",
                maxWidth: 460,
                fontWeight: 400,
              }}
            >
              Access 240+ synthetic indices with up to 1:1000 leverage. Trade
              Volatility, Boom, Crash, and more — 24 hours a day, 365 days a
              year.
            </p>

            <div
              style={{
                display: "flex",
                gap: 14,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <button
                className="btn-primary"
                style={{ padding: "14px 32px", borderRadius: 14, fontSize: 15 }}
                onClick={() => setAuthModalOpen(true)}
              >
                Start Trading Free →
              </button>
              <button
                className="btn-ghost"
                style={{ padding: "14px 24px", borderRadius: 14, fontSize: 15 }}
                onClick={onEnter}
              >
                View Live Markets
              </button>
            </div>

            {/* Trust indicators */}
            <div
              style={{
                display: "flex",
                gap: 24,
                marginTop: 48,
                flexWrap: "wrap",
              }}
            >
              {[
                "Regulated & Licensed",
                "Instant Deposits",
                "No Hidden Fees",
              ].map((t) => (
                <div
                  key={t}
                  style={{ display: "flex", alignItems: "center", gap: 6 }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#22C55E"
                    strokeWidth="2.5"
                  >
                    <path
                      d="M20 6L9 17l-5-5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span
                    style={{ fontSize: 13, color: "#52525B", fontWeight: 500 }}
                  >
                    {t}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: floating chart card */}
          <div
            className="float-anim"
            style={{ position: "relative", animationDelay: "0.5s" }}
          >
            <div
              className="glass-card glow-purple"
              style={{ padding: 28, position: "relative", overflow: "hidden" }}
            >
              <div
                className="orb"
                style={{
                  width: 200,
                  height: 200,
                  background:
                    "radial-gradient(circle, rgba(124,58,237,0.25) 0%, transparent 70%)",
                  top: -50,
                  right: -50,
                  filter: "blur(40px)",
                  animation: "none",
                }}
              />

              {/* Chart header */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: 20,
                }}
              >
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 4,
                    }}
                  >
                    <span
                      className="font-display"
                      style={{
                        fontSize: 16,
                        fontWeight: 700,
                        color: "#FFFFFF",
                      }}
                    >
                      {heroMarket?.name ?? "VOL-75 Index"}
                    </span>
                    <div className="live-dot" />
                  </div>
                  <div
                    className="font-mono-data"
                    style={{
                      fontSize: 28,
                      fontWeight: 600,
                      color: "#FFFFFF",
                      letterSpacing: "-0.5px",
                    }}
                  >
                    {livePrice.toFixed(2)}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div
                    style={{ fontSize: 12, color: "#52525B", marginBottom: 4 }}
                  >
                    24h Change
                  </div>
                  <div
                    className="font-mono-data"
                    style={{
                      fontSize: 18,
                      fontWeight: 600,
                      color:
                        (heroMarket?.changePct ?? 0) >= 0
                          ? "#22C55E"
                          : "#EF4444",
                    }}
                  >
                    {(heroMarket?.changePct ?? 0) >= 0 ? "+" : ""}
                    {(heroMarket?.changePct ?? 0).toFixed(2)}%
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color:
                        (heroMarket?.changePct ?? 0) >= 0
                          ? "#22C55E"
                          : "#EF4444",
                    }}
                  >
                    {(heroMarket?.changePct ?? 0) >= 0 ? "▲" : "▼"} $
                    {Math.abs(
                      (heroMarket?.price ?? 0) - (heroMarket?.basePrice ?? 0),
                    ).toFixed(2)}
                  </div>
                </div>
              </div>

              <HeroChart data={chartData} />

              {/* Bottom stats */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 12,
                  marginTop: 20,
                }}
              >
                {[
                  { label: "Volume", val: "14.2M" },

                  { label: "High", val: "8,491.22" },

                  { label: "Low", val: "7,984.80" },
                ].map((s) => (
                  <div
                    key={s.label}
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      borderRadius: 10,
                      padding: "10px 12px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        color: "#52525B",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        marginBottom: 3,
                      }}
                    >
                      {s.label}
                    </div>
                    <div
                      className="font-mono-data"
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#A1A1AA",
                      }}
                    >
                      {s.val}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Floating mini cards */}
            <div
              className="glass-card hidden sm:flex"
              style={{
                position: "absolute",
                top: -24,
                left: -40,
                padding: "10px 16px",
                borderRadius: 14,
                display: "flex",
                gap: 10,
                alignItems: "center",
                animationDelay: "1s",
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 9,
                  background: "rgba(34,197,94,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#22C55E"
                  strokeWidth="2"
                >
                  <path d="M12 2l4 8H8l4-8z" />
                  <path d="M8 10v12M16 10v12" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#52525B" }}>
                  Trade Executed
                </div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#22C55E",
                    fontFamily: "'IBM Plex Mono', monospace",
                  }}
                >
                  +$342.80
                </div>
              </div>
            </div>

            <div
              className="glass-card hidden sm:flex"
              style={{
                position: "absolute",
                bottom: -20,
                right: -36,
                padding: "10px 16px",
                borderRadius: 14,
                display: "flex",
                gap: 10,
                alignItems: "center",
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 9,
                  background: "rgba(124,58,237,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#A855F7"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#52525B" }}>Win Rate</div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#A855F7",
                    fontFamily: "'IBM Plex Mono', monospace",
                  }}
                >
                  73.2%
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Live ticker */}
      <div
        style={{
          background: "rgba(12,12,18,0.6)",
          borderTop: "1px solid rgba(255,255,255,0.05)",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          padding: "12px 0",
          overflow: "hidden",
        }}
      >
        <div className="ticker-wrap">
          <div className="ticker-inner">
            {[...tickerItems, ...tickerItems].map((item, idx) => (
              <div
                key={idx}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "0 28px",
                  borderRight: "1px solid rgba(255,255,255,0.04)",
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#A1A1AA",
                    fontFamily: "'Space Grotesk', sans-serif",
                  }}
                >
                  {item.symbol}
                </span>
                <span
                  className="font-mono-data"
                  style={{ fontSize: 13, fontWeight: 500, color: "#FFFFFF" }}
                >
                  {item.price.toFixed(2)}
                </span>
                <span
                  className="font-mono-data"
                  style={{
                    fontSize: 12,
                    color: item.change >= 0 ? "#22C55E" : "#EF4444",
                    fontWeight: 500,
                  }}
                >
                  {item.change >= 0 ? "+" : ""}
                  {item.change}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <section
        className="py-16 px-6 md:px-12"
        style={{ maxWidth: 1280, margin: "0 auto" }}
      >
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {STATS.map((s) => (
            <div
              key={s.label}
              className="card-base card-hover"
              style={{ padding: "28px 24px", textAlign: "center" }}
            >
              <div
                className="font-display"
                style={{
                  fontSize: 36,
                  fontWeight: 700,
                  color: "#FFFFFF",
                  letterSpacing: "-1px",
                  marginBottom: 6,
                }}
              >
                {s.value}
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#A1A1AA",
                  marginBottom: 4,
                }}
              >
                {s.label}
              </div>
              <div style={{ fontSize: 12, color: "#52525B" }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section
        style={{ maxWidth: 1280, margin: "0 auto", padding: "0 48px 100px" }}
      >
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#7C3AED",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              marginBottom: 16,
            }}
          >
            PLATFORM FEATURES
          </div>
          <h2
            className="font-display"
            style={{
              fontSize: "clamp(32px, 3.5vw, 48px)",
              fontWeight: 700,
              letterSpacing: "-1px",
              color: "#FFFFFF",
              margin: 0,
            }}
          >
            Built for serious traders
          </h2>
          <p
            style={{
              fontSize: 16,
              color: "#52525B",
              marginTop: 16,
              maxWidth: 480,
              margin: "16px auto 0",
            }}
          >
            Every tool you need to trade synthetic markets with confidence and
            precision.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 24,
          }}
        >
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="card-base card-hover"
              style={{ padding: "28px 24px" }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  marginBottom: 20,

                  background: `rgba(124,58,237,0.1)`,

                  border: `1px solid rgba(124,58,237,0.2)`,

                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",

                  color: f.accent,
                }}
              >
                {f.icon}
              </div>
              <h3
                className="font-display"
                style={{
                  fontSize: 17,
                  fontWeight: 600,
                  color: "#FFFFFF",
                  margin: "0 0 10px",
                  letterSpacing: "-0.3px",
                }}
              >
                {f.title}
              </h3>
              <p
                style={{
                  fontSize: 14,
                  color: "#52525B",
                  lineHeight: 1.65,
                  margin: 0,
                }}
              >
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Banner */}
      <section
        className="pb-20 px-6 md:px-12"
        style={{ maxWidth: 1280, margin: "0 auto" }}
      >
        <div
          className="py-12 px-6 md:py-16 md:px-16"
          style={{
            borderRadius: 24,

            background:
              "linear-gradient(135deg, rgba(124,58,237,0.2) 0%, rgba(99,102,241,0.15) 50%, rgba(168,85,247,0.1) 100%)",

            border: "1px solid rgba(124,58,237,0.25)",

            textAlign: "center",

            position: "relative",

            overflow: "hidden",
          }}
        >
          <div
            className="orb"
            style={{
              width: 400,
              height: 400,
              background:
                "radial-gradient(circle, rgba(124,58,237,0.3) 0%, transparent 70%)",
              top: -150,
              left: "50%",
              transform: "translateX(-50%)",
              filter: "blur(60px)",
              animation: "none",
            }}
          />
          <h2
            className="font-display"
            style={{
              fontSize: "clamp(24px, 4vw, 40px)",
              fontWeight: 700,
              letterSpacing: "-1px",
              color: "#FFFFFF",
              margin: "0 0 16px",
              position: "relative",
            }}
          >
            Ready to trade the future?
          </h2>
          <p
            style={{
              fontSize: 16,
              color: "#71717A",
              margin: "0 0 36px",
              position: "relative",
            }}
          >
            Join 148,920 traders already on probinary. Open your free account in
            under 2 minutes.
          </p>
          <div
            style={{
              display: "flex",
              gap: 14,
              justifyContent: "center",
              position: "relative",
            }}
          >
            <button
              className="btn-primary"
              style={{ padding: "14px 36px", borderRadius: 14, fontSize: 15 }}
              onClick={() => setAuthModalOpen(true)}
            >
              Open Free Account
            </button>
            <button
              className="btn-ghost"
              style={{ padding: "14px 28px", borderRadius: 14, fontSize: 15 }}
              onClick={onEnter}
            >
              Demo Mode
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        className="flex flex-col md:flex-row gap-6 md:gap-0 justify-between items-center py-10 px-6 md:px-12"
        style={{
          borderTop: "1px solid rgba(255,255,255,0.05)",
          maxWidth: 1280,
          margin: "0 auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img
            src="/logo.png"
            alt="Pro Binary logo"
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              objectFit: "cover",
            }}
          />
          <span
            style={{
              fontFamily: "'Space Grotesk',sans-serif",
              fontWeight: 700,
              fontSize: 14,
              color: "#FFFFFF",
            }}
          >
            pro<span style={{ color: "#A855F7" }}>binary</span>
          </span>
        </div>
        <p style={{ fontSize: 12, color: "#3F3F46", margin: 0 }}>
          © 2026 probinary. Trading synthetic indices involves risk. Trade
          responsibly.
        </p>
        <div style={{ display: "flex", gap: 20 }}>
          {["Terms", "Privacy", "Support"].map((l) => (
            <a
              key={l}
              href="#"
              style={{
                fontSize: 12,
                color: "#52525B",
                textDecoration: "none",
                transition: "color 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#A1A1AA")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#52525B")}
            >
              {l}
            </a>
          ))}
        </div>
      </footer>
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={onAuthSuccess}
      />
    </div>
  )
}

/* Inline icons for landing features */

function ChartIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M3 3v18h18" strokeLinecap="round" />
      <path
        d="M7 16l4-5 4 3 4-7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function LightningIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function BrainIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-1.14"
        strokeLinecap="round"
      />
      <path
        d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-1.14"
        strokeLinecap="round"
      />
    </svg>
  )
}

function GlobeIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="12" cy="12" r="10" />
      <path
        d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"
        strokeLinecap="round"
      />
    </svg>
  )
}

function AcademyIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        d="M22 10v6M2 10l10-5 10 5-10 5-10-5z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M6 12v5c3 3 9 3 12 0v-5" strokeLinecap="round" />
    </svg>
  )
}

import { useEffect, useState, useMemo, useRef, useCallback } from "react"
import { useTrading } from "../state/trading"
import { useTopNav } from "../state/topNav"
import LastDigitStatistics from "../components/LastDigitStatistics"

type TimeFrame = "1m" | "5m" | "15m" | "1h"
type TradingPanelMode = "manual" | "bot"
type BotStatus = "idle" | "scanning" | "trading" | "target-reached" | "stop-loss" | "max-trades" | "stopped"

function computeRSI(prices: number[], period: number = 14): number {
  if (!Array.isArray(prices) || prices.length < period + 1) return 50.0
  let gains = 0
  let losses = 0
  for (let i = prices.length - period; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1]
    if (diff >= 0) gains += diff
    else losses += Math.abs(diff)
  }
  const avgGain = gains / period
  const avgLoss = losses / period
  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return Math.max(0, Math.min(100, 100 - 100 / (1 + rs)))
}

function LineChart({
  history,
  livePrice,
  zoomFactor = 1.0,
}: {
  history?: number[]
  livePrice?: number
  zoomFactor?: number
}) {
  const W = 900
  const H = 380
  const PADDING = { top: 22, right: 75, bottom: 28, left: 12 }
  const chartW = W - PADDING.left - PADDING.right
  const chartH = H - PADDING.top - PADDING.bottom

  const validLivePrice =
    typeof livePrice === "number" && !isNaN(livePrice) && isFinite(livePrice) && livePrice > 0
      ? livePrice
      : 8250.0

  const safeSeries = useMemo(() => {
    if (Array.isArray(history)) {
      const clean = history.filter(
        (n) => typeof n === "number" && !isNaN(n) && isFinite(n) && n > 0,
      )
      if (clean.length >= 2) return clean
    }
    const arr: number[] = []
    let curr = validLivePrice * 0.994
    for (let i = 0; i < 50; i++) {
      curr += (Math.sin(i / 3) + (Math.random() - 0.48)) * (validLivePrice * 0.0012)
      arr.push(Number(curr.toFixed(2)))
    }
    arr.push(validLivePrice)
    return arr
  }, [history, validLivePrice])

  const count = Math.max(15, Math.min(120, Math.round(65 * zoomFactor)))
  const series = safeSeries.slice(-count)
  const allLow = Math.min(...series, validLivePrice)
  const allHigh = Math.max(...series, validLivePrice)
  const range = (allHigh - allLow) || (validLivePrice * 0.005) || 1

  const toY = (price: number) =>
    PADDING.top + chartH - ((price - allLow) / range) * chartH
  const toX = (index: number) =>
    PADDING.left + (index / Math.max(1, series.length - 1)) * chartW

  const priceLabels = 5
  const priceStep = (allHigh - allLow) / priceLabels

  const points = series.map((price, index) => ({
    x: toX(index),
    y: toY(price),
  }))

  const linePath = points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`,
    )
    .join(" ")

  const areaPath = `${linePath} L${toX(series.length - 1).toFixed(1)},${(H - PADDING.bottom).toFixed(1)} L${PADDING.left},${(H - PADDING.bottom).toFixed(1)} Z`
  const currentY = toY(validLivePrice)
  const isUp = validLivePrice >= (series[0] ?? validLivePrice)

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="w-full h-full block"
      style={{ display: "block" }}
    >
      <defs>
        <linearGradient id="purpleAreaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#A855F7" stopOpacity="0.32" />
          <stop offset="60%" stopColor="#7C3AED" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#7C3AED" stopOpacity="0.0" />
        </linearGradient>
        <filter id="purpleGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#A855F7" floodOpacity="0.75" />
        </filter>
      </defs>

      {/* Horizontal Grid Lines & Price Labels */}
      {Array.from({ length: priceLabels + 1 }, (_, i) => {
        const price = allLow + priceStep * i
        const y = toY(price)
        return (
          <g key={i}>
            <line
              x1={PADDING.left}
              y1={y}
              x2={W - PADDING.right}
              y2={y}
              stroke="rgba(255,255,255,0.05)"
              strokeDasharray="3,3"
              strokeWidth="1"
            />
            <text
              x={W - PADDING.right + 6}
              y={y + 3.5}
              fontSize="11"
              fill="#A1A1AA"
              fontFamily="'IBM Plex Mono', monospace"
            >
              {price.toFixed(2)}
            </text>
          </g>
        )
      })}

      {/* Vertical Grid Lines */}
      {Array.from({ length: 8 }, (_, i) => {
        const x = PADDING.left + (chartW / 7) * i
        return (
          <line
            key={i}
            x1={x}
            y1={PADDING.top}
            x2={x}
            y2={H - PADDING.bottom}
            stroke="rgba(255,255,255,0.03)"
            strokeDasharray="2,2"
            strokeWidth="1"
          />
        )
      })}

      {/* Glowing Purple Area Gradient */}
      <path d={areaPath} fill="url(#purpleAreaGrad)" />

      {/* Purple Glowing Price Line */}
      <path
        d={linePath}
        fill="none"
        stroke="#C084FC"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#purpleGlow)"
      />

      {/* Current Price Dashed Reference Line */}
      <line
        x1={PADDING.left}
        y1={currentY}
        x2={W - PADDING.right}
        y2={currentY}
        stroke={isUp ? "#22C55E" : "#EF4444"}
        strokeWidth="1.5"
        strokeDasharray="4,3"
        opacity="0.85"
      />

      {/* Current Price Axis Badge */}
      <rect
        x={W - PADDING.right + 2}
        y={currentY - 10}
        width={PADDING.right - 4}
        height={20}
        rx="4"
        fill={isUp ? "#22C55E" : "#EF4444"}
      />
      <text
        x={W - PADDING.right / 2}
        y={currentY + 4}
        textAnchor="middle"
        fontSize="10"
        fontWeight="700"
        fill="#FFFFFF"
        fontFamily="'IBM Plex Mono', monospace"
      >
        {livePrice.toFixed(2)}
      </text>

      {/* Pulsing Live Price Dot on Graph */}
      <circle
        cx={toX(series.length - 1)}
        cy={toY(series[series.length - 1] ?? livePrice)}
        r="4.5"
        fill="#FFFFFF"
        stroke="#A855F7"
        strokeWidth="2"
        style={{
          filter: "drop-shadow(0 0 8px #C084FC)",
        }}
      />
    </svg>
  )
}

const CONTRACT_TABS = [
  { id: "rise-fall", label: "Rise/Fall", contractType: "rise-fall" as const, defaultPrediction: "rise" as const },
  { id: "even-odd", label: "Even/Odd", contractType: "even-odd" as const, defaultPrediction: "even" as const },
  { id: "match-differ", label: "Matches", contractType: "match-differ" as const, defaultPrediction: "match" as const },
  { id: "over-under", label: "Over/Under", contractType: "over-under" as const, defaultPrediction: "over" as const },
  { id: "higher-lower", label: "Higher/Lower", contractType: "higher-lower" as const, defaultPrediction: "higher" as const },
] as const

export default function Terminal() {
  const {
    marketList,
    markets,
    selectedMarket,
    selectMarket,
    openTrades,
    recentTrades,
    placeTrade,
    forceCloseTrade,
    lastError,
    lastAction,
    role,
    simulationMode,
    capabilities,
    adminPolicy,
    setAdminPolicy,
    testBinarySystem,
  } = useTrading()

  const {
    activeAccount,
    setActiveAccount,
    balances,
    setDemoBalance,
    formatUsdValue,
    backendOnline,
    setPanel,
    headerCollapsed,
    setHeaderCollapsed,
    footerCollapsed,
    setFooterCollapsed,
    toggleBarsCollapsed,
  } = useTopNav()

  // Mobile specific navigation & dropdown states (matching clean mobile layout)
  const [mobileNavTab, setMobileNavTab] = useState<"trade" | "positions">("trade")
  const [marketDropdownOpen, setMarketDropdownOpen] = useState(false)
  const [statsDropdownOpen, setStatsDropdownOpen] = useState(false)
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false)

  // Navigation & Watchlist state
  const [tradingMode, setTradingMode] = useState<TradingPanelMode>("manual")
  const [showWatchlist, setShowWatchlist] = useState(false)
  const [watchlistCategory, setWatchlistCategory] = useState<string>("all")
  const [watchlistSearch, setWatchlistSearch] = useState("")

  // Chart state (Line only)
  const [timeframe, setTimeframe] = useState<TimeFrame>("5m")
  const [zoomFactor, setZoomFactor] = useState(1.0)

  // Trade manual parameters
  const [bottomTab, setBottomTab] = useState<"positions" | "orders" | "history" | "logs">("positions")
  const [contractType, setContractType] = useState<ContractType>("rise-fall")
  const [prediction, setPrediction] = useState<TradeDirection>("rise")
  const [predictionDigit, setPredictionDigit] = useState<number>(5)
  const [stake, setStake] = useState("50")
  const [expirySeconds, setExpirySeconds] = useState("30")
  const [martingaleEnabled, setMartingaleEnabled] = useState(false)
  const [martingaleMultiplier, setMartingaleMultiplier] = useState(2.0)
  const [targetProfit, setTargetProfit] = useState("20")
  const [stopLoss, setStopLoss] = useState("15")
  const [maxTrades, setMaxTrades] = useState(10)

  // Bot mode state
  const [botRunning, setBotRunning] = useState(false)
  const [botStrategy, setBotStrategy] = useState<"rsi" | "even-odd" | "match-differ" | "momentum">("rsi")
  const [botStatus, setBotStatus] = useState<BotStatus>("idle")
  const [botBaseStake, setBotBaseStake] = useState("1.00")
  const [botCurrentStake, setBotCurrentStake] = useState(1.0)
  const [botTradesCount, setBotTradesCount] = useState(0)
  const [botWins, setBotWins] = useState(0)
  const [botLosses, setBotLosses] = useState(0)
  const [botSessionProfit, setBotSessionProfit] = useState(0)
  const [botLogs, setBotLogs] = useState<string[]>([])

  // Simulation admin controls
  const [forcedOutcome, setForcedOutcome] = useState<"none" | "won" | "lost">(
    adminPolicy.forceNextOutcome ?? "none",
  )

  useEffect(() => {
    setForcedOutcome(adminPolicy.forceNextOutcome ?? "none")
  }, [adminPolicy.forceNextOutcome])

  // Live market resolution
  const liveMarket = markets[selectedMarket.symbol] ?? selectedMarket
  const livePrice = liveMarket?.price || 1000
  const currentDigit = Number(livePrice.toFixed(2).slice(-1))

  // Guaranteed safe history array (ensures graph NEVER collapses or crashes)
  const safeHistory = useMemo(() => {
    if (Array.isArray(liveMarket?.history) && liveMarket.history.length > 1) {
      return liveMarket.history
    }
    const base = livePrice
    const arr: number[] = []
    let curr = base * 0.994
    for (let i = 0; i < 60; i++) {
      curr += (Math.sin(i / 4) + (Math.random() - 0.48)) * (base * 0.0014)
      arr.push(curr)
    }
    arr.push(base)
    return arr
  }, [liveMarket, livePrice])

  const sessionOpen = safeHistory[0] ?? livePrice
  const sessionHigh = Math.max(...safeHistory.slice(-20), livePrice)
  const sessionLow = Math.min(...safeHistory.slice(-20), livePrice)
  const priceChange = livePrice - sessionOpen
  const pctChange = (priceChange / (sessionOpen || 1)) * 100

  // Technical Analytics
  const rsiValue = useMemo(() => computeRSI(safeHistory, 14), [safeHistory])
  const rsiBadge = rsiValue > 70 ? "OVERBOUGHT" : rsiValue < 30 ? "OVERSOLD" : "NEUTRAL"
  const rsiSignal = rsiValue > 70 ? "SELL / FALL" : rsiValue < 30 ? "BUY / RISE" : "WAIT"

  const payoutMultiplier =
    contractType === "match-differ" ? 2.15 : contractType === "even-odd" ? 1.8 : 1.82

  const applyAdminPolicy = () => {
    const nextOutcome = forcedOutcome === "none" ? null : forcedOutcome
    setAdminPolicy(nextOutcome)
  }

  // Quick Stake Helper
  const setQuickStake = (val: number) => {
    setStake(val.toFixed(2))
  }

  // Stepper stake handlers
  const stepStake = (delta: number) => {
    const current = parseFloat(stake) || 1
    const next = Math.max(1, current + delta)
    setStake(next.toFixed(2))
  }

  const stepBotStake = (delta: number) => {
    const current = parseFloat(botBaseStake) || 1
    const next = Math.max(0.35, current + delta)
    setBotBaseStake(next.toFixed(2))
  }

  // Manual Trade Placement
  const placeManualTrade = (directionOverride?: TradeDirection) => {
    const tradeStake = parseFloat(stake)
    if (isNaN(tradeStake) || tradeStake <= 0) return

    const tradeDirection = directionOverride ?? prediction

    const result = placeTrade({
      symbol: selectedMarket.symbol,
      contractType,
      direction: tradeDirection,
      stake: tradeStake,
      expirySeconds: parseInt(expirySeconds || "30", 10),
      isDemo: !testBinarySystem && activeAccount === "demo",
      predictionDigit,
    })

    if (result.ok) {
      if (!testBinarySystem && activeAccount === "demo") {
        setDemoBalance((prev) => prev - tradeStake)
      }
      setBottomTab("positions")
    }
  }

  // Bot Engine Implementation
  const botRunningRef = useRef(botRunning)
  botRunningRef.current = botRunning
  const activeBotTradeIdRef = useRef<string | null>(null)
  const isExecutingTradeRef = useRef(false)

  const addBotLog = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString()
    setBotLogs((prev) => [`[${time}] ${msg}`, ...prev.slice(0, 40)])
  }, [])

  // Start / Stop Bot
  const toggleBot = () => {
    if (botRunning) {
      setBotRunning(false)
      setBotStatus("stopped")
      addBotLog("Bot stopped by user.")
    } else {
      setBotRunning(true)
      setBotStatus("scanning")
      setBotTradesCount(0)
      setBotWins(0)
      setBotLosses(0)
      setBotSessionProfit(0)
      const base = parseFloat(botBaseStake) || 1.0
      setBotCurrentStake(base)
      activeBotTradeIdRef.current = null
      isExecutingTradeRef.current = false
      addBotLog(`Bot started using ${botStrategy.toUpperCase()} strategy on ${selectedMarket.symbol}. Base stake: $${base.toFixed(2)}`)
    }
  }

  // Bot execution watcher
  useEffect(() => {
    if (!botRunning) return

    const targetProfitNum = parseFloat(targetProfit) || 20
    const stopLossNum = parseFloat(stopLoss) || 15

    if (botSessionProfit >= targetProfitNum) {
      setBotRunning(false)
      setBotStatus("target-reached")
      addBotLog(`TARGET PROFIT REACHED! Total session profit: +$${botSessionProfit.toFixed(2)}`)
      return
    }

    if (botSessionProfit <= -stopLossNum) {
      setBotRunning(false)
      setBotStatus("stop-loss")
      addBotLog(`STOP LOSS HIT! Total session loss: -$${Math.abs(botSessionProfit).toFixed(2)}`)
      return
    }

    if (botTradesCount >= maxTrades) {
      setBotRunning(false)
      setBotStatus("max-trades")
      addBotLog(`Maximum trades limit (${maxTrades}) reached. Bot execution complete.`)
      return
    }

    if (activeBotTradeIdRef.current) {
      const closed = recentTrades.find((t) => t.id === activeBotTradeIdRef.current)
      if (closed && closed.status !== "open") {
        const isWin = closed.result === "won"
        const pnl = closed.profit ?? (isWin ? closed.stake * (closed.payoutMultiplier - 1) : -closed.stake)

        if (isWin) {
          setBotWins((w) => w + 1)
          setBotSessionProfit((p) => p + pnl)
          addBotLog(`Trade WON! +$${pnl.toFixed(2)} on ${closed.symbol}. Resetting stake.`)
          setBotCurrentStake(parseFloat(botBaseStake) || 1.0)
        } else {
          setBotLosses((l) => l + 1)
          setBotSessionProfit((p) => p + pnl)
          addBotLog(`Trade LOST! -$${Math.abs(pnl).toFixed(2)} on ${closed.symbol}.`)
          if (martingaleEnabled) {
            const nextStake = (parseFloat(botBaseStake) || 1.0) * Math.pow(martingaleMultiplier, botLosses + 1)
            setBotCurrentStake(Number(nextStake.toFixed(2)))
            addBotLog(`Martingale applied: Next stake raised to $${nextStake.toFixed(2)}`)
          }
        }
        activeBotTradeIdRef.current = null
        isExecutingTradeRef.current = false
        setBotStatus("scanning")
      }
      return
    }

    if (!isExecutingTradeRef.current && !activeBotTradeIdRef.current) {
      let shouldTrade = false
      let botContract: "rise-fall" | "even-odd" | "match-differ" = "rise-fall"
      let botDirection: "rise" | "fall" | "even" | "odd" | "match" | "differ" = "rise"

      if (botStrategy === "rsi") {
        if (rsiValue < 32) {
          shouldTrade = true
          botContract = "rise-fall"
          botDirection = "rise"
        } else if (rsiValue > 68) {
          shouldTrade = true
          botContract = "rise-fall"
          botDirection = "fall"
        }
      } else if (botStrategy === "even-odd") {
        shouldTrade = true
        botContract = "even-odd"
        botDirection = currentDigit % 2 === 0 ? "even" : "odd"
      } else if (botStrategy === "momentum") {
        const historySlice = safeHistory.slice(-3)
        shouldTrade = true
        botContract = "rise-fall"
        botDirection = (historySlice[historySlice.length - 1] ?? livePrice) >= (historySlice[0] ?? livePrice) ? "rise" : "fall"
      } else if (botStrategy === "match-differ") {
        shouldTrade = true
        botContract = "match-differ"
        botDirection = "differ"
      }

      if (shouldTrade) {
        isExecutingTradeRef.current = true
        setBotStatus("trading")
        const currentBotStake = botCurrentStake
        addBotLog(`Signal triggered! Placing ${botContract.toUpperCase()} [${botDirection.toUpperCase()}] with stake $${currentBotStake.toFixed(2)}`)

        const result = placeTrade({
          symbol: selectedMarket.symbol,
          contractType: botContract,
          direction: botDirection,
          stake: currentBotStake,
          expirySeconds: parseInt(expirySeconds || "15", 10),
          isDemo: !testBinarySystem && activeAccount === "demo",
        })

        if (result.ok && result.tradeId) {
          activeBotTradeIdRef.current = result.tradeId
          setBotTradesCount((c) => c + 1)
          if (!testBinarySystem && activeAccount === "demo") {
            setDemoBalance((prev) => prev - currentBotStake)
          }
        } else {
          isExecutingTradeRef.current = false
          setBotStatus("scanning")
          addBotLog(`Failed to place trade: ${result.error || "Unknown error"}`)
        }
      }
    }
  }, [botRunning, livePrice, rsiValue, currentDigit, recentTrades, botTradesCount, maxTrades, targetProfit, stopLoss, botSessionProfit, botBaseStake, botCurrentStake, botLosses, botStrategy, contractType, expirySeconds, martingaleEnabled, martingaleMultiplier, placeTrade, selectedMarket.symbol, setDemoBalance, testBinarySystem, activeAccount, safeHistory, addBotLog])

  // Filtered markets for Watchlist
  const filteredMarkets = useMemo(() => {
    return marketList.filter((m) => {
      const matchesCat = watchlistCategory === "all" || m.category === watchlistCategory
      const matchesSearch =
        m.symbol.toLowerCase().includes(watchlistSearch.toLowerCase()) ||
        m.name.toLowerCase().includes(watchlistSearch.toLowerCase())
      return matchesCat && matchesSearch
    })
  }, [marketList, watchlistCategory, watchlistSearch])

  // Super Admin Console
  if (simulationMode && role === "super_admin") {
    return (
      <div className="flex flex-col h-full bg-[#09090F] p-5 gap-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-display text-2xl font-bold text-white">Super Admin Control Console</div>
            <div className="text-xs text-zinc-400 mt-1">
              Simulation controls for AdminSim accounts. Trading controls disabled in this view.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-amber-500 border border-amber-500/40 rounded-full px-2.5 py-1">
              SIMULATION
            </span>
            <span className="text-[10px] font-bold text-purple-400 border border-purple-500/40 rounded-full px-2.5 py-1">
              ROLE SUPER_ADMIN
            </span>
          </div>
        </div>

        <div className="grid grid-cols-[minmax(360px,520px)] gap-4">
          <div className="p-4 rounded-xl bg-[#12121A] border border-amber-500/30">
            <div className="text-xs font-bold text-amber-500 tracking-wider uppercase mb-3">AdminSim Policy</div>
            <div className="grid gap-3">
              <div>
                <div className="field-label">Force next AdminSim outcome</div>
                <select
                  className="field-input"
                  value={forcedOutcome}
                  onChange={(e) => setForcedOutcome(e.target.value as "none" | "won" | "lost")}
                >
                  <option value="none">No override</option>
                  <option value="won">Force win</option>
                  <option value="lost">Force loss</option>
                </select>
              </div>

              <button
                className="btn-primary w-full py-2.5 rounded-lg text-xs"
                onClick={applyAdminPolicy}
                disabled={!capabilities.canViewAdminPanel}
              >
                Apply policy to AdminSim
              </button>

              <div className="text-xs text-zinc-400 p-3 rounded-lg bg-white/5 border border-white/10 space-y-1">
                <div>Pending override: {adminPolicy.forceNextOutcome ? adminPolicy.forceNextOutcome.toUpperCase() : "NONE"}</div>
                <div>Updated by: {adminPolicy.updatedBy ?? "N/A"}</div>
                <div>Last updated: {adminPolicy.updatedAt ? new Date(adminPolicy.updatedAt).toLocaleString() : "Never"}</div>
                <div>Last applied: {adminPolicy.lastAppliedAt ? new Date(adminPolicy.lastAppliedAt).toLocaleString() : "Never"}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col w-full h-full bg-[#09090F] text-white select-none overflow-y-auto lg:overflow-hidden">
      
      {/* ======================================================== */}
      {/* MOBILE VIEW (MATCHING SPURTRADE LAYOUT & SIMPLICITY)    */}
      {/* ======================================================== */}
      <div className={`lg:hidden flex flex-col w-full min-h-full ${footerCollapsed ? "pb-8" : "pb-20"} px-3 pt-2 relative`}>
        {/* 1. Horizontal Contract Type Selector */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1 flex-shrink-0">
          {CONTRACT_TABS.map((tab) => {
            const isSelected = tab.contractType === contractType
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setContractType(tab.contractType)
                  setPrediction(tab.defaultPrediction)
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  isSelected
                    ? "bg-purple-600/30 text-white border-2 border-purple-500 shadow-sm shadow-purple-900/50"
                    : "bg-[#130E26] text-zinc-400 border border-purple-500/15 hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* 2. Chart Sub-header Bar (Dropdowns for Markets, Real/Demo, Stats) */}
        <div className="flex items-center justify-between py-2 relative flex-shrink-0 z-20">
          {/* Left: Market Dropdown Button */}
          <div className="relative">
            <button
              onClick={() => {
                setMarketDropdownOpen((v) => !v)
                setStatsDropdownOpen(false)
                setAccountDropdownOpen(false)
              }}
              className="flex items-center gap-1.5 bg-[#140E2A] hover:bg-[#1B1338] border border-purple-500/30 rounded-xl px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-all"
            >
              <span className="text-purple-400 text-xs">◆</span>
              <span>{selectedMarket.symbol}</span>
              <span className="text-zinc-400 text-[10px]">⌄</span>
            </button>
          </div>

          {/* Right: Stats & Real/Demo Dropdowns */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setStatsDropdownOpen((v) => !v)
                setMarketDropdownOpen(false)
                setAccountDropdownOpen(false)
              }}
              className="flex items-center gap-1 bg-[#140E2A] hover:bg-[#1B1338] border border-purple-500/30 rounded-xl px-2.5 py-1.5 text-xs font-bold text-zinc-300 shadow-sm transition-all"
            >
              <span className="text-purple-400 text-[11px] font-mono">{timeframe}</span>
              <span className="text-zinc-500 text-[10px]">⌄</span>
            </button>

            <button
              onClick={() => {
                setAccountDropdownOpen((v) => !v)
                setMarketDropdownOpen(false)
                setStatsDropdownOpen(false)
              }}
              className="flex items-center gap-1.5 bg-[#140E2A] hover:bg-[#1B1338] border border-purple-500/30 rounded-xl px-3 py-1.5 text-xs font-bold shadow-sm transition-all"
            >
              <span className={`w-2 h-2 rounded-full ${activeAccount === "real" ? "bg-emerald-400" : "bg-purple-400"} animate-pulse`} />
              <span className={activeAccount === "real" ? "text-emerald-400" : "text-purple-300"}>
                {activeAccount === "real" ? "Real" : "Demo"}
              </span>
              <span className="text-zinc-500 text-[10px]">⌄</span>
            </button>

            {/* Collapse / Fullscreen Focus Toggle Button */}
            <button
              onClick={() => toggleBarsCollapsed()}
              className="flex items-center gap-1 bg-[#140E2A] hover:bg-[#1B1338] border border-purple-500/30 rounded-xl px-2.5 py-1.5 text-[11px] font-bold text-purple-300 shadow-sm transition-all active:scale-95"
              title={headerCollapsed && footerCollapsed ? "Expand Header & Footer" : "Collapse Header & Footer"}
            >
              {headerCollapsed && footerCollapsed ? (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span>Expand</span>
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span>Focus</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* DROPDOWN 1: Market Selector Modal / Popover */}
        {marketDropdownOpen && (
          <div className="absolute top-20 left-2.5 right-2.5 z-40 bg-[#120D26] border-2 border-purple-500/40 rounded-2xl p-3 shadow-2xl shadow-purple-950/80">
            <div className="flex items-center justify-between pb-2 border-b border-purple-500/20">
              <div className="text-xs font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                <span>◆</span> Select Market
              </div>
              <button
                onClick={() => setMarketDropdownOpen(false)}
                className="text-zinc-400 hover:text-white text-xs px-2 py-0.5 rounded bg-white/5"
              >
                ✕
              </button>
            </div>

            <div className="pt-2 space-y-2">
              <input
                type="text"
                placeholder="Search markets..."
                value={watchlistSearch}
                onChange={(e) => setWatchlistSearch(e.target.value)}
                className="w-full bg-[#1A1233] border border-purple-500/30 rounded-xl px-3 py-1.5 text-xs text-white placeholder-zinc-500 outline-none focus:border-purple-400 font-mono"
              />
              <div className="flex gap-1 overflow-x-auto pb-1 text-[10px]">
                {["all", "volatility", "boom", "crash"].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setWatchlistCategory(cat)}
                    className={`px-2.5 py-1 rounded-lg capitalize font-bold transition-all ${
                      watchlistCategory === cat
                        ? "bg-purple-600 text-white"
                        : "bg-purple-900/20 text-zinc-400 hover:text-white"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-56 overflow-y-auto divide-y divide-purple-500/10 mt-1">
              {filteredMarkets.map((m) => {
                const live = markets[m.symbol] ?? m
                const isSelected = selectedMarket.symbol === m.symbol
                const isUp = (live.changePct ?? 0) >= 0

                return (
                  <div
                    key={m.symbol}
                    onClick={() => {
                      selectMarket(m.symbol)
                      setMarketDropdownOpen(false)
                    }}
                    className={`p-2.5 cursor-pointer rounded-xl transition-all flex items-center justify-between ${
                      isSelected ? "bg-purple-600/30 border border-purple-500" : "hover:bg-purple-900/20"
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>{m.symbol}</span>
                        <span className="text-[10px] text-zinc-400 font-normal">· {m.name}</span>
                      </div>
                      <div className="text-[10px] text-purple-400 font-mono">Vol: {m.volatilityLabel}</div>
                    </div>
                    <div className="text-right font-mono">
                      <div className="text-xs font-bold text-white">{live.price.toFixed(2)}</div>
                      <div className={`text-[10px] font-bold ${isUp ? "text-emerald-400" : "text-rose-400"}`}>
                        {isUp ? "+" : ""}{(live.changePct ?? 0).toFixed(2)}%
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-2 pt-2 border-t border-purple-500/20 grid grid-cols-4 gap-1 text-center font-mono text-[10px] text-zinc-400 bg-[#0E0A1E] rounded-xl p-2">
              <div>O: <span className="text-white font-bold">{sessionOpen.toFixed(1)}</span></div>
              <div>H: <span className="text-white font-bold">{sessionHigh.toFixed(1)}</span></div>
              <div>L: <span className="text-white font-bold">{sessionLow.toFixed(1)}</span></div>
              <div>VOL: <span className="text-purple-400 font-bold">{liveMarket.volatilityLabel}</span></div>
            </div>
          </div>
        )}

        {/* DROPDOWN 2: Stats & Timeframe Popover */}
        {statsDropdownOpen && (
          <div className="absolute top-20 right-2.5 left-2.5 z-40 bg-[#120D26] border-2 border-purple-500/40 rounded-2xl p-3 shadow-2xl shadow-purple-950/80">
            <div className="flex items-center justify-between pb-2 border-b border-purple-500/20">
              <div className="text-xs font-bold text-purple-300 uppercase tracking-wider">
                Statistics & Timeframe
              </div>
              <button
                onClick={() => setStatsDropdownOpen(false)}
                className="text-zinc-400 hover:text-white text-xs px-2 py-0.5 rounded bg-white/5"
              >
                ✕
              </button>
            </div>

            <div className="pt-2">
              <div className="text-[10px] text-zinc-400 uppercase font-bold mb-1">Timeframe</div>
              <div className="flex items-center gap-1.5 bg-[#0E0A1E] p-1 rounded-xl border border-purple-500/20">
                {(["1m", "5m", "15m", "1h"] as TimeFrame[]).map((tf) => (
                  <button
                    key={tf}
                    onClick={() => {
                      setTimeframe(tf)
                      setStatsDropdownOpen(false)
                    }}
                    className={`flex-1 py-1.5 text-xs font-mono font-bold rounded-lg transition-all ${
                      timeframe === tf
                        ? "bg-purple-600 text-white shadow-sm shadow-purple-900/60"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-purple-500/15 text-xs font-mono">
              <div className="bg-[#160F2E] p-2 rounded-xl border border-purple-500/15 flex justify-between">
                <span className="text-zinc-400">Open</span>
                <span className="text-white font-bold">{sessionOpen.toFixed(2)}</span>
              </div>
              <div className="bg-[#160F2E] p-2 rounded-xl border border-purple-500/15 flex justify-between">
                <span className="text-zinc-400">High</span>
                <span className="text-emerald-400 font-bold">{sessionHigh.toFixed(2)}</span>
              </div>
              <div className="bg-[#160F2E] p-2 rounded-xl border border-purple-500/15 flex justify-between">
                <span className="text-zinc-400">Low</span>
                <span className="text-rose-400 font-bold">{sessionLow.toFixed(2)}</span>
              </div>
              <div className="bg-[#160F2E] p-2 rounded-xl border border-purple-500/15 flex justify-between">
                <span className="text-zinc-400">RSI(14)</span>
                <span className="text-purple-300 font-bold">{rsiValue.toFixed(1)}</span>
              </div>
            </div>

            <div className="flex items-center justify-between mt-2 pt-2 border-t border-purple-500/15 text-xs">
              <div className="flex items-center gap-1.5 text-zinc-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="font-semibold text-purple-300">
                  {backendOnline ? "LIVE FEED" : "SIMULATED"}
                </span>
              </div>
              <div className="font-mono font-bold text-xs">
                Signal: <span className={rsiSignal.includes("BUY") ? "text-emerald-400" : rsiSignal.includes("SELL") ? "text-rose-400" : "text-amber-400"}>{rsiSignal}</span>
              </div>
            </div>
          </div>
        )}

        {/* DROPDOWN 3: Account Selector Popover */}
        {accountDropdownOpen && (
          <div className="absolute top-20 right-2.5 z-40 w-64 bg-[#120D26] border-2 border-purple-500/40 rounded-2xl p-3 shadow-2xl shadow-purple-950/80">
            <div className="flex items-center justify-between pb-2 border-b border-purple-500/20">
              <div className="text-xs font-bold text-purple-300 uppercase tracking-wider">
                Account Type
              </div>
              <button
                onClick={() => setAccountDropdownOpen(false)}
                className="text-zinc-400 hover:text-white text-xs px-2 py-0.5 rounded bg-white/5"
              >
                ✕
              </button>
            </div>
            <div className="pt-2 space-y-2">
              <button
                onClick={() => {
                  setActiveAccount("real")
                  setAccountDropdownOpen(false)
                }}
                className={`w-full p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                  activeAccount === "real"
                    ? "bg-purple-600/30 border-purple-500 text-white font-bold"
                    : "bg-[#160F2E] border-purple-500/15 text-zinc-300 hover:bg-purple-900/20"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>Real Account</span>
                </div>
                <span className="font-mono font-bold">{formatUsdValue(balances.real)}</span>
              </button>
              <button
                onClick={() => {
                  setActiveAccount("demo")
                  setAccountDropdownOpen(false)
                }}
                className={`w-full p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                  activeAccount === "demo"
                    ? "bg-purple-600/30 border-purple-500 text-white font-bold"
                    : "bg-[#160F2E] border-purple-500/15 text-zinc-300 hover:bg-purple-900/20"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-400" />
                  <span>Demo Account</span>
                </div>
                <span className="font-mono font-bold">{formatUsdValue(balances.demo)}</span>
              </button>
            </div>
          </div>
        )}

        {/* 3. The Clean Line Chart (with pinned right price badge & floating zoom controls) */}
        <div
          className="w-full relative bg-[#070512] rounded-2xl border border-purple-500/20 overflow-hidden my-1 shadow-lg shadow-purple-950/20 flex-shrink-0"
          style={{ height: "260px", minHeight: "240px" }}
        >
          <LineChart history={safeHistory} livePrice={livePrice} zoomFactor={zoomFactor} />

          {/* Floating stacked zoom controls (matching SpurTrade screenshot) */}
          <div className="absolute right-2.5 bottom-3.5 flex flex-col gap-1 z-10">
            <button
              onClick={() => setZoomFactor((z) => Math.max(0.5, z - 0.2))}
              title="Zoom In"
              className="w-8 h-8 rounded-lg bg-[#140E2A]/85 backdrop-blur-md border border-purple-500/30 text-white font-bold flex items-center justify-center text-sm shadow-md hover:bg-purple-600/40 active:scale-95 transition-all"
            >
              +
            </button>
            <button
              onClick={() => setZoomFactor((z) => Math.min(2.0, z + 0.2))}
              title="Zoom Out"
              className="w-8 h-8 rounded-lg bg-[#140E2A]/85 backdrop-blur-md border border-purple-500/30 text-white font-bold flex items-center justify-center text-sm shadow-md hover:bg-purple-600/40 active:scale-95 transition-all"
            >
              −
            </button>
          </div>
        </div>

        {/* 4. Last Digit Statistics (Digit Tracker with Arrow) */}
        <div className="w-full flex-shrink-0 my-1">
          <LastDigitStatistics lastDigit={currentDigit} tickValue={livePrice} maxTicks={1000} />
        </div>

        {/* 5. Trading Mode Segmented Control: [ Manual ] [ Bot ] */}
        <div className="grid grid-cols-2 bg-[#0C0818] p-1 rounded-xl border border-purple-500/20 my-1 flex-shrink-0">
          <button
            onClick={() => setTradingMode("manual")}
            className={`py-2 text-xs font-bold rounded-lg transition-all font-display ${
              tradingMode === "manual"
                ? "bg-[#181136] text-white border border-purple-500/40 shadow-sm"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Manual
          </button>
          <button
            onClick={() => setTradingMode("bot")}
            className={`py-2 text-xs font-bold rounded-lg transition-all font-display ${
              tradingMode === "bot"
                ? "bg-[#251806] text-amber-400 border border-amber-500/40 shadow-sm"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Bot
          </button>
        </div>

        {/* 6. Trading Controls & Action Buttons */}
        {mobileNavTab === "trade" && (
          tradingMode === "manual" ? (
            <div className="space-y-2 flex-shrink-0 pt-0.5">
              {/* Base Stake Stepper */}
              <div className="bg-[#100B22] border border-purple-500/20 rounded-xl p-2.5 flex items-center justify-between shadow-sm">
                <button
                  onClick={() => stepStake(-1)}
                  className="w-10 h-10 rounded-lg bg-[#181136] border border-purple-500/30 flex items-center justify-center text-lg font-bold text-zinc-300 hover:text-white active:scale-95 transition-transform"
                >
                  −
                </button>
                <div className="text-center">
                  <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">Base Stake</div>
                  <div className="font-mono text-xl font-bold text-white tracking-tight flex items-center justify-center gap-1">
                    <span className="text-purple-400 text-sm font-semibold">$</span>
                    <input
                      type="number"
                      value={stake}
                      onChange={(e) => setStake(e.target.value)}
                      className="w-20 bg-transparent text-center font-mono font-bold text-white text-xl outline-none"
                    />
                  </div>
                </div>
                <button
                  onClick={() => stepStake(1)}
                  className="w-10 h-10 rounded-lg bg-[#181136] border border-purple-500/30 flex items-center justify-center text-lg font-bold text-zinc-300 hover:text-white active:scale-95 transition-transform"
                >
                  +
                </button>
              </div>

              {/* Target Profit & Stop Loss (2 columns) */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[#100B22] border border-emerald-500/25 rounded-xl p-2.5 flex flex-col justify-center">
                  <div className="text-[10px] text-zinc-400 uppercase font-semibold">Target Profit</div>
                  <div className="font-mono text-base font-bold text-emerald-400 flex items-center gap-1 mt-0.5">
                    <span className="text-emerald-500 text-xs">$</span>
                    <input
                      type="number"
                      value={targetProfit}
                      onChange={(e) => setTargetProfit(e.target.value)}
                      className="w-full bg-transparent font-mono font-bold text-emerald-400 outline-none"
                    />
                  </div>
                </div>
                <div className="bg-[#100B22] border border-rose-500/25 rounded-xl p-2.5 flex flex-col justify-center">
                  <div className="text-[10px] text-zinc-400 uppercase font-semibold">Stop Loss</div>
                  <div className="font-mono text-base font-bold text-rose-400 flex items-center gap-1 mt-0.5">
                    <span className="text-rose-500 text-xs">$</span>
                    <input
                      type="number"
                      value={stopLoss}
                      onChange={(e) => setStopLoss(e.target.value)}
                      className="w-full bg-transparent font-mono font-bold text-rose-400 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Martingale Card with Switch */}
              <div className="bg-[#100B22] border border-purple-500/20 rounded-xl p-3 flex items-center justify-between shadow-sm">
                <div>
                  <div className="text-xs font-bold text-zinc-200 uppercase tracking-wider">Martingale</div>
                  <div className="text-[11px] text-zinc-500">Multiply stake after loss</div>
                </div>
                <button
                  onClick={() => setMartingaleEnabled((v) => !v)}
                  className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ${
                    martingaleEnabled ? "bg-purple-600 justify-end" : "bg-zinc-700 justify-start"
                  }`}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow-md transform transition-transform" />
                </button>
              </div>

              {/* Big Execution Action Buttons for Every Trade Type */}
              {contractType === "rise-fall" && (
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <button
                    onClick={() => placeManualTrade("rise")}
                    className="py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 active:scale-98 text-white font-black text-base shadow-lg shadow-emerald-950/40 transition-all font-display flex flex-col items-center justify-center gap-0.5"
                  >
                    <div className="flex items-center gap-1.5">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span>Rise</span>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-100/90 font-semibold">+82% Payout</span>
                  </button>
                  <button
                    onClick={() => placeManualTrade("fall")}
                    className="py-3.5 px-4 rounded-2xl bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-400 hover:to-rose-500 active:scale-98 text-white font-black text-base shadow-lg shadow-rose-950/40 transition-all font-display flex flex-col items-center justify-center gap-0.5"
                  >
                    <div className="flex items-center gap-1.5">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="M12 5v14M5 12l7 7 7-7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span>Fall</span>
                    </div>
                    <span className="text-[10px] font-mono text-rose-100/90 font-semibold">+82% Payout</span>
                  </button>
                </div>
              )}

              {contractType === "even-odd" && (
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <button
                    onClick={() => placeManualTrade("even")}
                    className="py-3.5 px-4 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:scale-98 text-white font-black text-base shadow-lg shadow-purple-950/40 transition-all font-display flex flex-col items-center justify-center gap-0.5 border border-purple-400/30"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">⚖️</span>
                      <span>Even</span>
                    </div>
                    <span className="text-[10px] font-mono text-purple-200 font-semibold">1.80x Payout</span>
                  </button>
                  <button
                    onClick={() => placeManualTrade("odd")}
                    className="py-3.5 px-4 rounded-2xl bg-gradient-to-r from-fuchsia-600 to-purple-800 hover:from-fuchsia-500 hover:to-purple-700 active:scale-98 text-white font-black text-base shadow-lg shadow-purple-950/40 transition-all font-display flex flex-col items-center justify-center gap-0.5 border border-purple-400/30"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">⚡</span>
                      <span>Odd</span>
                    </div>
                    <span className="text-[10px] font-mono text-purple-200 font-semibold">1.80x Payout</span>
                  </button>
                </div>
              )}

              {contractType === "match-differ" && (
                <div className="space-y-2 pt-1">
                  <div className="bg-[#100B22] border border-purple-500/25 rounded-xl p-2.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] text-zinc-400 uppercase font-semibold">Target Digit</span>
                      <span className="text-xs font-mono font-bold text-purple-300">Selected: {predictionDigit}</span>
                    </div>
                    <div className="grid grid-cols-10 gap-1">
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                        <button
                          key={d}
                          onClick={() => setPredictionDigit(d)}
                          className={`py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                            predictionDigit === d
                              ? "bg-purple-600 text-white shadow-md shadow-purple-900/60 scale-105 border border-purple-400"
                              : "bg-[#181136] text-zinc-400 hover:text-white border border-purple-500/20"
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      onClick={() => placeManualTrade("match")}
                      className="py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 active:scale-98 text-white font-black text-base shadow-lg shadow-emerald-950/40 transition-all font-display flex flex-col items-center justify-center gap-0.5"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">🎯</span>
                        <span>Matches {predictionDigit}</span>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-100 font-semibold">2.15x (+115%)</span>
                    </button>
                    <button
                      onClick={() => placeManualTrade("differ")}
                      className="py-3.5 px-4 rounded-2xl bg-gradient-to-r from-rose-500 to-purple-700 hover:from-rose-400 hover:to-purple-600 active:scale-98 text-white font-black text-base shadow-lg shadow-purple-950/40 transition-all font-display flex flex-col items-center justify-center gap-0.5"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">≠</span>
                        <span>Differs {predictionDigit}</span>
                      </div>
                      <span className="text-[10px] font-mono text-purple-200 font-semibold">1.82x (+82%)</span>
                    </button>
                  </div>
                </div>
              )}

              {contractType === "over-under" && (
                <div className="space-y-2 pt-1">
                  <div className="bg-[#100B22] border border-purple-500/25 rounded-xl p-2.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] text-zinc-400 uppercase font-semibold">Prediction Digit Barrier</span>
                      <span className="text-xs font-mono font-bold text-purple-300">Digit: {predictionDigit}</span>
                    </div>
                    <div className="grid grid-cols-10 gap-1">
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                        <button
                          key={d}
                          onClick={() => setPredictionDigit(d)}
                          className={`py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                            predictionDigit === d
                              ? "bg-purple-600 text-white shadow-md shadow-purple-900/60 scale-105 border border-purple-400"
                              : "bg-[#181136] text-zinc-400 hover:text-white border border-purple-500/20"
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      onClick={() => placeManualTrade("over")}
                      className="py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 active:scale-98 text-white font-black text-base shadow-lg shadow-emerald-950/40 transition-all font-display flex flex-col items-center justify-center gap-0.5"
                    >
                      <div className="flex items-center gap-1.5">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span>Over {predictionDigit}</span>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-100 font-semibold">+82% Payout</span>
                    </button>
                    <button
                      onClick={() => placeManualTrade("under")}
                      className="py-3.5 px-4 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-400 hover:to-pink-500 active:scale-98 text-white font-black text-base shadow-lg shadow-rose-950/40 transition-all font-display flex flex-col items-center justify-center gap-0.5"
                    >
                      <div className="flex items-center gap-1.5">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <path d="M12 5v14M5 12l7 7 7-7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span>Under {predictionDigit}</span>
                      </div>
                      <span className="text-[10px] font-mono text-rose-100 font-semibold">+82% Payout</span>
                    </button>
                  </div>
                </div>
              )}

              {contractType === "higher-lower" && (
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <button
                    onClick={() => placeManualTrade("higher")}
                    className="py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 active:scale-98 text-white font-black text-base shadow-lg shadow-emerald-950/40 transition-all font-display flex flex-col items-center justify-center gap-0.5"
                  >
                    <div className="flex items-center gap-1.5">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span>Higher</span>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-100/90 font-semibold">+82% Payout</span>
                  </button>
                  <button
                    onClick={() => placeManualTrade("lower")}
                    className="py-3.5 px-4 rounded-2xl bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-400 hover:to-rose-500 active:scale-98 text-white font-black text-base shadow-lg shadow-rose-950/40 transition-all font-display flex flex-col items-center justify-center gap-0.5"
                  >
                    <div className="flex items-center gap-1.5">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="M12 5v14M5 12l7 7 7-7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span>Lower</span>
                    </div>
                    <span className="text-[10px] font-mono text-rose-100/90 font-semibold">+82% Payout</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2 flex-shrink-0 pt-0.5">
              {/* Bot Strategy Selector */}
              <div className="bg-[#100B22] border border-amber-500/25 rounded-xl p-2.5">
                <div className="text-[10px] text-zinc-400 uppercase font-semibold mb-1">Bot Strategy</div>
                <select
                  value={botStrategy}
                  onChange={(e) => setBotStrategy(e.target.value as typeof botStrategy)}
                  className="w-full bg-[#181136] border border-purple-500/30 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white outline-none cursor-pointer"
                >
                  <option value="rsi">RSI Extremes (Buy &lt;30, Sell &gt;70)</option>
                  <option value="even-odd">Digit Parity Run (Even/Odd)</option>
                  <option value="momentum">Price Momentum Trend</option>
                  <option value="match-differ">Digit Hunter (Differ Prediction)</option>
                </select>
              </div>

              {/* Base Stake Stepper */}
              <div className="bg-[#100B22] border border-purple-500/20 rounded-xl p-2.5 flex items-center justify-between shadow-sm">
                <button
                  onClick={() => stepBotStake(-0.5)}
                  className="w-10 h-10 rounded-lg bg-[#181136] border border-purple-500/30 flex items-center justify-center text-lg font-bold text-zinc-300 hover:text-white active:scale-95 transition-transform"
                >
                  −
                </button>
                <div className="text-center">
                  <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">Bot Base Stake</div>
                  <div className="font-mono text-xl font-bold text-white tracking-tight flex items-center justify-center gap-1">
                    <span className="text-amber-400 text-sm font-semibold">$</span>
                    <input
                      type="number"
                      value={botBaseStake}
                      onChange={(e) => setBotBaseStake(e.target.value)}
                      className="w-20 bg-transparent text-center font-mono font-bold text-white text-xl outline-none"
                    />
                  </div>
                </div>
                <button
                  onClick={() => stepBotStake(0.5)}
                  className="w-10 h-10 rounded-lg bg-[#181136] border border-purple-500/30 flex items-center justify-center text-lg font-bold text-zinc-300 hover:text-white active:scale-95 transition-transform"
                >
                  +
                </button>
              </div>

              {/* Live Metrics Row */}
              <div className="grid grid-cols-4 gap-1.5 text-center text-xs font-mono bg-[#140E2A] p-2 rounded-xl border border-purple-500/20">
                <div>
                  <div className="text-[9px] text-zinc-500 uppercase">Trades</div>
                  <div className="font-bold text-white">{botTradesCount}</div>
                </div>
                <div>
                  <div className="text-[9px] text-zinc-500 uppercase">Wins</div>
                  <div className="font-bold text-emerald-400">{botWins}</div>
                </div>
                <div>
                  <div className="text-[9px] text-zinc-500 uppercase">Losses</div>
                  <div className="font-bold text-rose-400">{botLosses}</div>
                </div>
                <div>
                  <div className="text-[9px] text-zinc-500 uppercase">Profit</div>
                  <div className={`font-bold ${botSessionProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {botSessionProfit >= 0 ? "+" : ""}${botSessionProfit.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Start / Stop Bot Button */}
              <div className="pt-1">
                <button
                  onClick={() => {
                    if (botRunning) {
                      setBotRunning(false)
                      setBotStatus("stopped")
                    } else {
                      setBotRunning(true)
                      setBotStatus("scanning")
                      setBotCurrentStake(parseFloat(botBaseStake) || 1.0)
                    }
                  }}
                  className={`w-full py-3.5 px-4 rounded-2xl font-black text-base shadow-lg transition-all font-display active:scale-98 ${
                    botRunning
                      ? "bg-gradient-to-r from-rose-600 to-rose-700 text-white shadow-rose-950/50 hover:from-rose-500 hover:to-rose-600"
                      : "bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-amber-950/50 hover:from-amber-400 hover:to-amber-500"
                  }`}
                >
                  {botRunning ? "🛑 Stop Automated Bot" : "🚀 Start Automated Bot"}
                </button>
              </div>
            </div>
          )
        )}

        {/* 7. Positions Screen (When positions tab is active) */}
        {mobileNavTab === "positions" && (
          <div className="flex-1 flex flex-col pt-1 space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-purple-500/20">
              <div className="text-xs font-bold text-purple-300 uppercase tracking-wider">
                Positions & Recent Trades
              </div>
              <button
                onClick={() => setMobileNavTab("trade")}
                className="text-[11px] text-purple-400 font-bold px-2 py-0.5 rounded bg-purple-900/30"
              >
                ← Return to Chart
              </button>
            </div>

            <div>
              <div className="text-[10px] text-zinc-400 uppercase font-semibold mb-1">
                Open Contracts ({openTrades.length})
              </div>
              {openTrades.length === 0 ? (
                <div className="p-4 bg-[#100B22] rounded-xl border border-purple-500/20 text-center text-xs text-zinc-500">
                  No open positions. Select Rise or Fall to enter a trade.
                </div>
              ) : (
                <div className="space-y-2">
                  {openTrades.map((t) => {
                    const remaining = Math.max(0, Math.ceil((t.expiryAt - Date.now()) / 1000))

                    return (
                      <div
                        key={t.id}
                        className="bg-[#120D26] border border-purple-500/25 rounded-xl p-3 flex items-center justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-xs">{t.symbol}</span>
                            <span className="px-1.5 py-0.5 rounded bg-purple-900/40 text-purple-300 text-[10px] font-bold">
                              {t.direction.toUpperCase()}
                            </span>
                          </div>
                          <div className="text-[11px] text-zinc-400 font-mono mt-0.5">
                            Stake: <span className="text-white">${t.stake.toFixed(2)}</span> · Entry: {t.entryPrice.toFixed(2)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-mono font-bold text-amber-400">{remaining}s left</div>
                          <button
                            onClick={() => forceCloseTrade(t.id)}
                            className="mt-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500 hover:text-white"
                          >
                            Close
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div>
              <div className="text-[10px] text-zinc-400 uppercase font-semibold mb-1">
                Recent History ({recentTrades.length})
              </div>
              {recentTrades.length === 0 ? (
                <div className="p-4 bg-[#100B22] rounded-xl border border-purple-500/20 text-center text-xs text-zinc-500">
                  No trade history recorded in this session.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                  {recentTrades.slice(0, 10).map((t) => {
                    const isWin = t.result === "won"
                    return (
                      <div
                        key={t.id}
                        className="bg-[#100B22] border border-purple-500/15 rounded-xl p-2.5 flex items-center justify-between text-xs font-mono"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              isWin ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"
                            }`}
                          >
                            {t.result?.toUpperCase()}
                          </span>
                          <span className="font-bold text-white">{t.symbol}</span>
                        </div>
                        <div
                          className={`font-bold ${
                            (t.profit ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {(t.profit ?? 0) >= 0 ? "+" : ""}${((t.profit ?? 0)).toFixed(2)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 8. Fixed Bottom Navigation Bar */}
        <div
          className={`fixed bottom-0 left-0 right-0 z-30 bg-[#0C0818]/95 backdrop-blur-md border-t border-purple-500/20 px-4 py-2 flex items-center justify-around transition-all duration-300 ${
            footerCollapsed ? "translate-y-full opacity-0 pointer-events-none" : "translate-y-0 opacity-100 pointer-events-auto"
          }`}
        >
          <button
            onClick={() => setMobileNavTab("trade")}
            className={`flex flex-col items-center gap-1 transition-colors relative py-1 px-3 ${
              mobileNavTab === "trade" && tradingMode === "manual" ? "text-purple-400 font-bold" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {mobileNavTab === "trade" && tradingMode === "manual" && (
              <span className="absolute -top-2 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-purple-400 rounded-full" />
            )}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M3 3v18h18M18 9l-5 5-4-4-3 3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-[10px]">Trade</span>
          </button>

          <button
            onClick={() => {
              setMobileNavTab("trade")
              setTradingMode("bot")
            }}
            className={`flex flex-col items-center gap-1 transition-colors relative py-1 px-3 ${
              mobileNavTab === "trade" && tradingMode === "bot" ? "text-amber-400 font-bold" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {mobileNavTab === "trade" && tradingMode === "bot" && (
              <span className="absolute -top-2 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-500 to-amber-400 rounded-full" />
            )}
            <div className="w-5 h-5 rounded bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 text-[10px]">
              ★
            </div>
            <span className="text-[10px]">Scanner</span>
          </button>

          <button
            onClick={() => setMobileNavTab("positions")}
            className={`flex flex-col items-center gap-1 transition-colors relative py-1 px-3 ${
              mobileNavTab === "positions" ? "text-purple-400 font-bold" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {mobileNavTab === "positions" && (
              <span className="absolute -top-2 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-purple-400 rounded-full" />
            )}
            <div className="relative">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {openTrades.length > 0 && (
                <span className="absolute -top-1 -right-2 bg-purple-600 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {openTrades.length}
                </span>
              )}
            </div>
            <span className="text-[10px]">Positions</span>
          </button>

          <button
            onClick={() => setFooterCollapsed(true)}
            className="flex flex-col items-center gap-1 text-zinc-500 hover:text-purple-300 transition-colors py-1 px-2"
            title="Collapse Navigation"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-[9px]">Hide</span>
          </button>
        </div>

        {/* Floating Bottom Nav Expand Pill when footer is collapsed */}
        {footerCollapsed && (
          <div className="fixed bottom-2 left-1/2 -translate-x-1/2 z-30 pointer-events-auto">
            <button
              onClick={() => setFooterCollapsed(false)}
              className="px-3.5 py-1.5 rounded-full bg-[#120D26]/95 border border-purple-500/35 text-purple-300 text-[11px] font-bold flex items-center gap-1.5 shadow-xl shadow-purple-950/80 backdrop-blur-md hover:bg-purple-900/40 active:scale-95 transition-all"
              title="Tap to show navigation bar"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 15l-6-6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>Nav Menu</span>
              {openTrades.length > 0 && (
                <span className="px-1.5 py-0.2 bg-purple-600 text-[9px] font-bold text-white rounded-full">
                  {openTrades.length}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Floating Live Chat FAB */}
        <button
          onClick={() => setPanel("chat")}
          className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-600 to-indigo-500 text-white shadow-xl shadow-purple-900/60 flex items-center justify-center fixed bottom-18 right-4 z-40 active:scale-95 transition-transform"
          title="Live Chat"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* ======================================================== */}
      {/* DESKTOP VIEW (FULL DUAL-COLUMN WORKSPACE) */}
      {/* ======================================================== */}
      <div className="hidden lg:flex flex-row flex-1 overflow-hidden min-h-0 relative">

        {/* WATCHLIST DRAWER/PANEL (COLLAPSIBLE) */}
        {showWatchlist && (
          <div className="w-full lg:w-[220px] bg-[#0E0A1E] border-r border-purple-500/15 flex flex-col flex-shrink-0 z-20 overflow-hidden">
            <div className="p-2.5 border-b border-purple-500/15 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-300 uppercase tracking-wider">
                  Watchlist
                </span>
                <button
                  onClick={() => setShowWatchlist(false)}
                  className="text-zinc-500 hover:text-white text-sm px-1"
                >
                  ✕
                </button>
              </div>
              <input
                type="text"
                placeholder="Search markets..."
                value={watchlistSearch}
                onChange={(e) => setWatchlistSearch(e.target.value)}
                className="w-full bg-[#160F2E] border border-purple-500/20 rounded-md px-2 py-1 text-xs text-white placeholder-zinc-500 outline-none focus:border-purple-500 font-mono"
              />
              <div className="flex gap-1 overflow-x-auto pb-1 text-[10px]">
                {["all", "volatility", "boom", "crash"].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setWatchlistCategory(cat)}
                    className={`px-2 py-0.5 rounded capitalize font-semibold ${
                      watchlistCategory === cat
                        ? "bg-purple-600 text-white"
                        : "bg-purple-900/20 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-purple-500/10">
              {filteredMarkets.map((m) => {
                const live = markets[m.symbol] ?? m
                const isSelected = selectedMarket.symbol === m.symbol
                const isUp = (live.changePct ?? 0) >= 0

                return (
                  <div
                    key={m.symbol}
                    onClick={() => selectMarket(m.symbol)}
                    className={`p-2.5 cursor-pointer transition-colors flex items-center justify-between ${
                      isSelected
                        ? "bg-purple-600/25 border-l-2 border-purple-500"
                        : "hover:bg-purple-900/15"
                    }`}
                  >
                    <div>
                      <div className={`text-xs font-bold ${isSelected ? "text-purple-300" : "text-zinc-200"}`}>
                        {m.symbol}
                      </div>
                      <div className="text-[10px] text-zinc-500 truncate max-w-[100px]">{m.name}</div>
                    </div>
                    <div className="text-right font-mono">
                      <div className="text-xs font-semibold text-white">{live.price.toFixed(2)}</div>
                      <div className={`text-[10px] font-bold ${isUp ? "text-emerald-400" : "text-rose-400"}`}>
                        {isUp ? "+" : ""}{(live.changePct ?? 0).toFixed(2)}%
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* LEFT / CENTER: THE CHART BOX (WITH SCREENSHOT INFO WITHIN CHART BOX) + ANALYTICS + DIGIT TRACKER + HISTORY */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#09090F] lg:overflow-y-auto">

          {/* 3. THE CHART BOX - CONTAINS ALL SCREENSHOT INFO IN HEADER + THE GRAPH CHART */}
          <div className="p-2 sm:p-2.5 w-full flex-shrink-0">
            <div className="w-full bg-[#0B0718] rounded-xl border border-purple-500/25 shadow-lg shadow-purple-950/20 overflow-hidden flex flex-col">
              
              {/* CHART BOX HEADER - EXACTLY MATCHING THE USER SCREENSHOT */}
              <div className="bg-[#120D26] border-b border-purple-500/20 p-2 sm:px-3 sm:py-2.5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2.5">
                
                {/* Left Side: Market Dropdown, Live Price, Change %, O/H/L/Vol/Simulated */}
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap min-w-0">
                  {/* Market Dropdown within chart box */}
                  <div className="relative inline-flex items-center">
                    <select
                      value={selectedMarket.symbol}
                      onChange={(e) => selectMarket(e.target.value)}
                      className="appearance-none bg-[#160E33] hover:bg-[#1E1344] border-2 border-purple-500/50 hover:border-purple-400 text-white rounded-xl pl-3 pr-7 py-1.5 text-xs sm:text-sm font-bold font-display cursor-pointer outline-none transition-all shadow-sm shadow-purple-950/40"
                    >
                      {marketList.map((m) => (
                        <option key={m.symbol} value={m.symbol} className="bg-[#120D26] text-white">
                          {m.symbol} · {m.name}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-purple-300">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </div>

                  {/* Pulsing Live Dot + Live Price + Change % */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </span>
                    <span className="font-mono text-base sm:text-lg font-extrabold text-white tracking-tight">
                      {livePrice.toFixed(2)}
                    </span>
                    <span
                      className={`font-mono text-xs sm:text-sm font-bold ${
                        pctChange >= 0 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {pctChange >= 0 ? "+" : ""}
                      {pctChange.toFixed(3)}%
                    </span>
                  </div>

                  {/* Stats: O, H, L, VOL, SIMULATED */}
                  <div className="flex items-center gap-2 sm:gap-2.5 text-[11px] font-mono text-zinc-400 flex-wrap">
                    <span className="text-zinc-600 hidden sm:inline">|</span>
                    <div className="flex items-center">
                      <span className="text-zinc-500 font-semibold mr-1">O</span>
                      <span className="text-zinc-200">{sessionOpen.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="text-zinc-500 font-semibold mr-1">H</span>
                      <span className="text-zinc-200">{sessionHigh.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="text-zinc-500 font-semibold mr-1">L</span>
                      <span className="text-zinc-200">{sessionLow.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="text-zinc-500 font-semibold mr-1">VOL</span>
                      <span className="text-purple-400 font-bold">{liveMarket.volatilityLabel ?? "High"}</span>
                    </div>
                    <span className="text-[10px] font-bold text-purple-300 bg-purple-900/40 border border-purple-500/40 px-2 py-0.5 rounded-full uppercase tracking-wider">
                      {backendOnline ? "LIVE FEED" : "SIMULATED"}
                    </span>
                  </div>
                </div>

                {/* Right Side: Timeframes (1m, 5m, 15m, 1h), Zoom (+ - ⟲), Watchlist */}
                <div className="flex items-center justify-between sm:justify-end gap-2 flex-wrap">
                  {/* Timeframes */}
                  <div className="flex items-center bg-[#170F33] rounded-xl p-0.5 border border-purple-500/25">
                    {(["1m", "5m", "15m", "1h"] as TimeFrame[]).map((tf) => (
                      <button
                        key={tf}
                        onClick={() => setTimeframe(tf)}
                        className={`px-2.5 py-1 text-xs font-mono font-bold rounded-lg transition-all ${
                          timeframe === tf
                            ? "bg-purple-600 text-white shadow-sm shadow-purple-900/60"
                            : "text-zinc-400 hover:text-white"
                        }`}
                      >
                        {tf}
                      </button>
                    ))}
                  </div>

                  {/* Zoom Controls */}
                  <div className="flex items-center bg-[#170F33] rounded-xl p-0.5 border border-purple-500/25 gap-0.5">
                    <button
                      onClick={() => setZoomFactor((z) => Math.max(0.5, z - 0.2))}
                      title="Zoom In"
                      className="w-7 h-7 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-purple-600/30 rounded-lg text-xs font-bold transition-colors"
                    >
                      +
                    </button>
                    <button
                      onClick={() => setZoomFactor((z) => Math.min(2.0, z + 0.2))}
                      title="Zoom Out"
                      className="w-7 h-7 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-purple-600/30 rounded-lg text-xs font-bold transition-colors"
                    >
                      −
                    </button>
                    <button
                      onClick={() => setZoomFactor(1.0)}
                      title="Reset Zoom"
                      className="w-7 h-7 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-purple-600/30 rounded-lg text-[10px] transition-colors"
                    >
                      ⟲
                    </button>
                  </div>

                  {/* Watchlist Button */}
                  <button
                    onClick={() => setShowWatchlist((prev) => !prev)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all flex items-center gap-1.5 ${
                      showWatchlist
                        ? "bg-purple-600/30 text-purple-300 border-purple-500"
                        : "bg-[#170F33] text-zinc-300 border-purple-500/25 hover:text-white hover:border-purple-400/40"
                    }`}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M3 12h18M3 6h18M3 18h18" strokeLinecap="round" />
                    </svg>
                    <span>Watchlist</span>
                  </button>
                </div>
              </div>

              {/* GRAPH CANVAS (GUARANTEED VISIBLE ON BOTH MOBILE & DESKTOP) */}
              <div
                className="w-full relative bg-[#070510] overflow-hidden"
                style={{
                  width: "100%",
                  height: "320px",
                  minHeight: "260px",
                }}
              >
                <LineChart history={safeHistory} livePrice={livePrice} zoomFactor={zoomFactor} />
              </div>
            </div>
          </div>

          {/* 5. ANALYTICS / CARDS (IMMEDIATELY BELOW CHART BOX) */}
          <div className="px-2 pb-2 grid grid-cols-3 gap-2 flex-shrink-0">
            {/* Card 1: RSI */}
            <div className="bg-[#120D26] border border-purple-500/20 rounded-xl p-2.5 sm:p-3 flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-bold text-zinc-400 tracking-wider">
                <span>RSI(14)</span>
                <span
                  className={`text-[8px] sm:text-[9px] px-1.5 py-0.5 rounded font-extrabold uppercase ${
                    rsiBadge === "OVERSOLD"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      : rsiBadge === "OVERBOUGHT"
                        ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                        : "bg-purple-900/30 text-purple-300 border border-purple-500/30"
                  }`}
                >
                  {rsiBadge}
                </span>
              </div>
              <div className="font-mono text-xl sm:text-2xl font-bold text-white mt-1">
                {rsiValue.toFixed(1)}
              </div>
              <div className="text-[9px] sm:text-[10px] text-zinc-500 mt-0.5 truncate">Relative Strength</div>
            </div>

            {/* Card 2: SIGNAL */}
            <div className="bg-[#120D26] border border-purple-500/20 rounded-xl p-2.5 sm:p-3 flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-bold text-zinc-400 tracking-wider">
                <span>SIGNAL</span>
                <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
              </div>
              <div
                className={`font-mono text-lg sm:text-xl font-bold mt-1 truncate ${
                  rsiSignal.includes("BUY")
                    ? "text-emerald-400"
                    : rsiSignal.includes("SELL")
                      ? "text-rose-400"
                      : "text-amber-400"
                }`}
              >
                {rsiSignal}
              </div>
              <div className="text-[9px] sm:text-[10px] text-zinc-500 mt-0.5 truncate">Based on RSI</div>
            </div>

            {/* Card 3: CHANGE */}
            <div className="bg-[#120D26] border border-purple-500/20 rounded-xl p-2.5 sm:p-3 flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-bold text-zinc-400 tracking-wider">
                <span>CHANGE</span>
                <span className="text-[9px] sm:text-[10px] text-zinc-400">Session</span>
              </div>
              <div
                className={`font-mono text-xl sm:text-2xl font-bold mt-1 ${
                  pctChange >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {pctChange >= 0 ? "+" : ""}
                {pctChange.toFixed(3)}%
              </div>
              <div className="text-[9px] sm:text-[10px] text-zinc-500 mt-0.5 truncate">
                {priceChange >= 0 ? "+" : ""}{priceChange.toFixed(2)} pts
              </div>
            </div>
          </div>

          {/* 6. DIGIT TRACKER (DIRECTLY BELOW ANALYTICS) */}
          <div className="px-2 flex-shrink-0">
            <LastDigitStatistics lastDigit={currentDigit} tickValue={livePrice} maxTicks={1000} />
          </div>

          {/* 7. BOTTOM TABS: OPEN, ORDERS, HISTORY, LOGS */}
          <div className="bg-[#100B20] border-t border-purple-500/15 flex flex-col flex-shrink-0 mt-1">
            <div className="flex items-center border-b border-purple-500/15 px-2 bg-[#0E0A1E]">
              {[
                { id: "positions", label: `Open (${openTrades.length})` },
                { id: "orders", label: "Orders" },
                { id: "history", label: `History (${recentTrades.length})` },
                { id: "logs", label: "Logs" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setBottomTab(tab.id as typeof bottomTab)}
                  className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 font-display ${
                    bottomTab === tab.id
                      ? "border-purple-500 text-purple-300 bg-purple-600/10"
                      : "border-transparent text-zinc-400 hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="h-44 overflow-y-auto">
              {bottomTab === "positions" && (
                openTrades.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-zinc-500 text-xs">
                    No open positions. Select a trade direction in the panel to execute.
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-purple-500/15 text-[10px] text-zinc-500 uppercase tracking-wider bg-[#0C0818]">
                        <th className="py-2 px-3">ID</th>
                        <th className="py-2 px-3">Market</th>
                        <th className="py-2 px-3">Contract</th>
                        <th className="py-2 px-3">Stake</th>
                        <th className="py-2 px-3">Entry</th>
                        <th className="py-2 px-3">Current</th>
                        <th className="py-2 px-3">Expiry</th>
                        <th className="py-2 px-3">Payout</th>
                        <th className="py-2 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-purple-500/10 font-mono">
                      {openTrades.map((t) => {
                        const market = markets[t.symbol] ?? selectedMarket
                        const remaining = Math.max(0, Math.ceil((t.expiryAt - Date.now()) / 1000))

                        return (
                          <tr key={t.id} className="hover:bg-purple-900/10">
                            <td className="py-2 px-3 text-zinc-500">{t.id}</td>
                            <td className="py-2 px-3 font-bold text-white">{t.symbol}</td>
                            <td className="py-2 px-3">
                              <span className="px-1.5 py-0.5 rounded bg-purple-900/40 text-purple-300 text-[10px] font-bold">
                                {t.direction.toUpperCase()}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-zinc-300">${t.stake.toFixed(2)}</td>
                            <td className="py-2 px-3 text-zinc-400">{t.entryPrice.toFixed(2)}</td>
                            <td className="py-2 px-3 text-white font-bold">{market.price.toFixed(2)}</td>
                            <td className="py-2 px-3 text-amber-400">{remaining}s</td>
                            <td className="py-2 px-3 text-emerald-400">${(t.stake * t.payoutMultiplier).toFixed(2)}</td>
                            <td className="py-2 px-3 text-right">
                              <button
                                onClick={() => forceCloseTrade(t.id)}
                                className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500 hover:text-white transition-colors"
                              >
                                Close
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )
              )}

              {bottomTab === "history" && (
                recentTrades.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-zinc-500 text-xs">
                    No closed trades recorded in this session.
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-purple-500/15 text-[10px] text-zinc-500 uppercase tracking-wider bg-[#0C0818]">
                        <th className="py-2 px-3">ID</th>
                        <th className="py-2 px-3">Market</th>
                        <th className="py-2 px-3">Result</th>
                        <th className="py-2 px-3">Stake</th>
                        <th className="py-2 px-3">Entry</th>
                        <th className="py-2 px-3">Exit</th>
                        <th className="py-2 px-3 text-right">Profit/Loss</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-purple-500/10 font-mono">
                      {recentTrades.map((t) => {
                        const isWin = t.result === "won"
                        return (
                          <tr key={t.id} className="hover:bg-purple-900/10">
                            <td className="py-2 px-3 text-zinc-500">{t.id}</td>
                            <td className="py-2 px-3 font-bold text-white">{t.symbol}</td>
                            <td className="py-2 px-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  isWin
                                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                    : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                }`}
                              >
                                {t.result?.toUpperCase()}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-zinc-300">${t.stake.toFixed(2)}</td>
                            <td className="py-2 px-3 text-zinc-400">{t.entryPrice.toFixed(2)}</td>
                            <td className="py-2 px-3 text-white">{(t.exitPrice ?? t.entryPrice).toFixed(2)}</td>
                            <td
                              className={`py-2 px-3 text-right font-bold ${
                                (t.profit ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"
                              }`}
                            >
                              {(t.profit ?? 0) >= 0 ? "+" : ""}
                              ${(t.profit ?? 0).toFixed(2)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )
              )}

              {bottomTab === "orders" && (
                <div className="flex items-center justify-center h-full text-zinc-500 text-xs">
                  Pending orders are not used in binary options. Contracts execute instantly.
                </div>
              )}

              {bottomTab === "logs" && (
                <div className="p-3 font-mono text-xs text-zinc-400 space-y-1">
                  <div>[System] Feed connected: {backendOnline ? "Production WebSocket" : "Local Engine"}</div>
                  <div>[Market] Active asset: {selectedMarket.symbol} (Price: {livePrice.toFixed(2)})</div>
                  {lastAction && <div className="text-purple-300">[Action] {lastAction}</div>}
                  {lastError && <div className="text-rose-400">[Error] {lastError}</div>}
                  {botLogs.slice(0, 8).map((log, i) => (
                    <div key={i} className="text-zinc-400">{log}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 8. RIGHT TRADING PANEL */}
        <div className="w-full lg:w-[350px] bg-[#120D26] border-t lg:border-t-0 lg:border-l border-purple-500/20 flex flex-col flex-shrink-0 z-10 lg:overflow-y-auto">
          
          {/* Desktop Panel Header */}
          <div className="hidden lg:block p-3 border-b border-purple-500/15 bg-[#140E2A]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-base text-white">Trade</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live
                </span>
              </div>

              {/* Mode Toggle: Real / Demo */}
              <div className="flex items-center bg-[#0C0818] rounded-lg p-0.5 border border-purple-500/20">
                <button
                  onClick={() => setActiveAccount("real")}
                  className={`px-2 py-1 text-[11px] font-bold rounded-md transition-all ${
                    activeAccount === "real"
                      ? "bg-purple-600 text-white shadow"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  Real
                </button>
                <button
                  onClick={() => setActiveAccount("demo")}
                  className={`px-2 py-1 text-[11px] font-bold rounded-md transition-all ${
                    activeAccount === "demo"
                      ? "bg-purple-600 text-white shadow"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  Demo
                </button>
              </div>
            </div>

            {/* Balance Card */}
            <div className="flex items-baseline justify-between bg-[#0A0716] p-2.5 rounded-xl border border-purple-500/20">
              <span className="text-xs text-zinc-400 font-medium">Balance</span>
              <span className="font-mono text-xl font-bold text-white">
                {formatUsdValue(activeAccount === "real" ? balances.real : balances.demo)}
              </span>
            </div>
          </div>

          {/* Segmented Control: MANUAL | BOT */}
          <div className="p-3 border-b border-purple-500/15">
            <div className="grid grid-cols-2 bg-[#0C0818] rounded-xl p-1 border border-purple-500/25">
              <button
                onClick={() => setTradingMode("manual")}
                className={`py-2 text-xs font-bold rounded-lg transition-all font-display ${
                  tradingMode === "manual"
                    ? "bg-gradient-to-r from-purple-700 to-purple-600 text-white shadow-md shadow-purple-900/50"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Manual
              </button>
              <button
                onClick={() => setTradingMode("bot")}
                className={`py-2 text-xs font-bold rounded-lg transition-all font-display flex items-center justify-center gap-1.5 ${
                  tradingMode === "bot"
                    ? "bg-gradient-to-r from-purple-700 to-purple-600 text-white shadow-md shadow-purple-900/50"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <span>Bot</span>
                {botRunning && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />}
              </button>
            </div>
          </div>

          {/* ================= MANUAL MODE ================= */}
          {tradingMode === "manual" && (
            <div className="p-3 space-y-4">
              {/* TRADE TYPE REFERENCE GRID */}
              <div>
                <div className="field-label flex items-center justify-between">
                  <span>Trade Type</span>
                  <span className="text-[10px] text-purple-400">{contractType.toUpperCase()}</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: "rise-fall", label: "Rise/Fall", contractType: "rise-fall" as const, defaultPrediction: "rise" as const },
                    { id: "even-odd", label: "Even/Odd", contractType: "even-odd" as const, defaultPrediction: "even" as const },
                    { id: "match-differ", label: "Matches", contractType: "match-differ" as const, defaultPrediction: "match" as const },
                    { id: "over-under", label: "Over/Under", contractType: "over-under" as const, defaultPrediction: "over" as const },
                    { id: "higher-lower", label: "Higher/Lower", contractType: "higher-lower" as const, defaultPrediction: "higher" as const },
                  ].map((item) => {
                    const isSelected = item.contractType === contractType

                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setContractType(item.contractType)
                          setPrediction(item.defaultPrediction)
                        }}
                        className={`p-2 rounded-xl text-center border transition-all ${
                          isSelected
                            ? "bg-purple-600/30 border-purple-500 text-white shadow-sm shadow-purple-900/40"
                            : "bg-[#160F2E] border-purple-500/15 text-zinc-300 hover:border-purple-500/40"
                        }`}
                      >
                        <div className="text-[11px] font-bold">{item.label}</div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* DURATION / EXPIRY */}
              <div>
                <div className="field-label">Expiry Duration</div>
                <div className="grid grid-cols-4 gap-1.5">
                  {["10", "30", "60", "120"].map((sec) => (
                    <button
                      key={sec}
                      onClick={() => setExpirySeconds(sec)}
                      className={`py-1.5 rounded-lg text-xs font-mono font-bold border transition-all ${
                        expirySeconds === sec
                          ? "bg-purple-600 text-white border-purple-400"
                          : "bg-[#160F2E] border-purple-500/15 text-zinc-400 hover:text-white"
                      }`}
                    >
                      {sec}s
                    </button>
                  ))}
                </div>
              </div>

              {/* BASE STAKE (LARGE STEPPER & QUICK CHIPS) */}
              <div>
                <div className="field-label flex items-center justify-between">
                  <span>Base Stake</span>
                  <span className="text-[10px] text-zinc-400">USD</span>
                </div>
                <div className="flex items-center gap-2 bg-[#160F2E] border border-purple-500/25 rounded-xl p-1 mb-2">
                  <button
                    onClick={() => stepStake(-5)}
                    className="w-10 h-10 rounded-lg bg-[#0C0818] border border-purple-500/20 text-white text-lg font-bold hover:bg-purple-900/30 active:scale-95 transition-all flex items-center justify-center"
                  >
                    −
                  </button>
                  <div className="flex-1 text-center font-mono text-xl font-bold text-white">
                    <span className="text-purple-400 mr-1">$</span>
                    <input
                      type="number"
                      value={stake}
                      onChange={(e) => setStake(e.target.value)}
                      className="bg-transparent text-center font-mono text-xl font-bold text-white w-24 outline-none"
                    />
                  </div>
                  <button
                    onClick={() => stepStake(5)}
                    className="w-10 h-10 rounded-lg bg-[#0C0818] border border-purple-500/20 text-white text-lg font-bold hover:bg-purple-900/30 active:scale-95 transition-all flex items-center justify-center"
                  >
                    +
                  </button>
                </div>

                <div className="grid grid-cols-6 gap-1">
                  {[1, 5, 10, 25, 50, 100].map((val) => (
                    <button
                      key={val}
                      onClick={() => setQuickStake(val)}
                      className={`py-1 rounded-md text-[11px] font-mono font-bold border transition-all ${
                        parseFloat(stake) === val
                          ? "bg-purple-600 text-white border-purple-400"
                          : "bg-[#160F2E] border-purple-500/15 text-zinc-400 hover:text-white"
                      }`}
                    >
                      ${val}
                    </button>
                  ))}
                </div>
              </div>

              {/* MARTINGALE TOGGLE */}
              <div className="bg-[#160F2E] border border-purple-500/20 rounded-xl p-2.5 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white">Martingale</div>
                  <div className="text-[10px] text-zinc-400">Multiply stake after loss</div>
                </div>
                <div className="flex items-center gap-2">
                  {martingaleEnabled && (
                    <select
                      value={martingaleMultiplier}
                      onChange={(e) => setMartingaleMultiplier(parseFloat(e.target.value))}
                      className="bg-[#0C0818] border border-purple-500/30 text-purple-300 rounded px-1.5 py-0.5 text-xs font-mono font-bold outline-none"
                    >
                      <option value="1.5">1.5x</option>
                      <option value="2.0">2.0x</option>
                      <option value="2.5">2.5x</option>
                    </select>
                  )}
                  <button
                    onClick={() => setMartingaleEnabled((m) => !m)}
                    className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                      martingaleEnabled ? "bg-purple-600" : "bg-zinc-700"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white transition-transform ${
                        martingaleEnabled ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* TARGET PROFIT & STOP LOSS */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[#160F2E] border border-purple-500/20 rounded-xl p-2.5">
                  <div className="text-[10px] text-zinc-400 uppercase font-semibold">Target Profit</div>
                  <div className="flex items-center gap-1 mt-1 font-mono">
                    <span className="text-emerald-400 font-bold">$</span>
                    <input
                      type="number"
                      value={targetProfit}
                      onChange={(e) => setTargetProfit(e.target.value)}
                      className="bg-transparent text-sm font-bold text-white w-full outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="bg-[#160F2E] border border-purple-500/20 rounded-xl p-2.5">
                  <div className="text-[10px] text-zinc-400 uppercase font-semibold">Stop Loss</div>
                  <div className="flex items-center gap-1 mt-1 font-mono">
                    <span className="text-rose-400 font-bold">$</span>
                    <input
                      type="number"
                      value={stopLoss}
                      onChange={(e) => setStopLoss(e.target.value)}
                      className="bg-transparent text-sm font-bold text-white w-full outline-none font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* MAX TRADES / SESSION */}
              <div className="bg-[#160F2E] border border-purple-500/20 rounded-xl p-2.5 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400">Max Trades / Session</span>
                  <span className="font-mono font-bold text-purple-300">{maxTrades}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="50"
                  value={maxTrades}
                  onChange={(e) => setMaxTrades(parseInt(e.target.value, 10))}
                  className="w-full accent-purple-500 cursor-pointer"
                />
              </div>

              {/* DIRECTION TRADE BUTTONS */}
              <div className="space-y-2 pt-1">
                {contractType === "rise-fall" && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => placeManualTrade("rise")}
                      className="p-3.5 rounded-xl font-display font-bold text-sm bg-gradient-to-br from-emerald-600 to-emerald-700 text-white hover:from-emerald-500 hover:to-emerald-600 active:scale-[0.98] transition-all shadow-lg shadow-emerald-950/50 flex flex-col items-center justify-center gap-1"
                    >
                      <div className="flex items-center gap-1.5">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span>RISE</span>
                      </div>
                      <span className="text-[11px] font-mono text-emerald-200 font-semibold">+82% Payout</span>
                    </button>

                    <button
                      onClick={() => placeManualTrade("fall")}
                      className="p-3.5 rounded-xl font-display font-bold text-sm bg-gradient-to-br from-rose-600 to-rose-700 text-white hover:from-rose-500 hover:to-rose-600 active:scale-[0.98] transition-all shadow-lg shadow-rose-950/50 flex flex-col items-center justify-center gap-1"
                    >
                      <div className="flex items-center gap-1.5">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <path d="M12 5v14M5 12l7 7 7-7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span>FALL</span>
                      </div>
                      <span className="text-[11px] font-mono text-rose-200 font-semibold">+82% Payout</span>
                    </button>
                  </div>
                )}

                {contractType === "even-odd" && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => placeManualTrade("even")}
                      className="p-3.5 rounded-xl font-display font-bold text-sm bg-gradient-to-br from-purple-600 to-purple-800 text-white hover:from-purple-500 hover:to-purple-700 active:scale-[0.98] transition-all shadow-lg shadow-purple-950/50 flex flex-col items-center justify-center gap-1"
                    >
                      <span>EVEN</span>
                      <span className="text-[11px] font-mono text-purple-200 font-semibold">1.80x Payout</span>
                    </button>

                    <button
                      onClick={() => placeManualTrade("odd")}
                      className="p-3.5 rounded-xl font-display font-bold text-sm bg-gradient-to-br from-purple-800 to-purple-950 border border-purple-500/30 text-white hover:bg-purple-900 active:scale-[0.98] transition-all shadow-lg shadow-purple-950/50 flex flex-col items-center justify-center gap-1"
                    >
                      <span>ODD</span>
                      <span className="text-[11px] font-mono text-purple-200 font-semibold">1.80x Payout</span>
                    </button>
                  </div>
                )}

                {contractType === "match-differ" && (
                  <div className="space-y-2">
                    <div className="bg-[#120B24] border border-purple-500/20 rounded-xl p-2">
                      <div className="flex justify-between text-[10px] text-zinc-400 mb-1 font-semibold uppercase">
                        <span>Target Digit</span>
                        <span className="text-purple-300 font-mono font-bold">Selected: {predictionDigit}</span>
                      </div>
                      <div className="grid grid-cols-10 gap-1">
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                          <button
                            key={d}
                            onClick={() => setPredictionDigit(d)}
                            className={`py-1 rounded text-xs font-mono font-bold ${
                              predictionDigit === d
                                ? "bg-purple-600 text-white shadow-sm shadow-purple-900 border border-purple-400"
                                : "bg-[#181136] text-zinc-400 hover:text-white"
                            }`}
                          >
                            {d}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => placeManualTrade("match")}
                        className="p-3.5 rounded-xl font-display font-bold text-sm bg-gradient-to-br from-purple-600 to-purple-800 text-white hover:from-purple-500 hover:to-purple-700 active:scale-[0.98] transition-all shadow-lg shadow-purple-950/50 flex flex-col items-center justify-center gap-1"
                      >
                        <span>MATCH {predictionDigit}</span>
                        <span className="text-[11px] font-mono text-purple-200 font-semibold">2.15x Payout</span>
                      </button>

                      <button
                        onClick={() => placeManualTrade("differ")}
                        className="p-3.5 rounded-xl font-display font-bold text-sm bg-gradient-to-br from-purple-800 to-purple-950 border border-purple-500/30 text-white hover:bg-purple-900 active:scale-[0.98] transition-all shadow-lg shadow-purple-950/50 flex flex-col items-center justify-center gap-1"
                      >
                        <span>DIFFER {predictionDigit}</span>
                        <span className="text-[11px] font-mono text-purple-200 font-semibold">1.82x Payout</span>
                      </button>
                    </div>
                  </div>
                )}

                {contractType === "over-under" && (
                  <div className="space-y-2">
                    <div className="bg-[#120B24] border border-purple-500/20 rounded-xl p-2">
                      <div className="flex justify-between text-[10px] text-zinc-400 mb-1 font-semibold uppercase">
                        <span>Prediction Digit Barrier</span>
                        <span className="text-purple-300 font-mono font-bold">Barrier: {predictionDigit}</span>
                      </div>
                      <div className="grid grid-cols-10 gap-1">
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                          <button
                            key={d}
                            onClick={() => setPredictionDigit(d)}
                            className={`py-1 rounded text-xs font-mono font-bold ${
                              predictionDigit === d
                                ? "bg-purple-600 text-white shadow-sm shadow-purple-900 border border-purple-400"
                                : "bg-[#181136] text-zinc-400 hover:text-white"
                            }`}
                          >
                            {d}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => placeManualTrade("over")}
                        className="p-3.5 rounded-xl font-display font-bold text-sm bg-gradient-to-br from-emerald-600 to-emerald-700 text-white hover:from-emerald-500 hover:to-emerald-600 active:scale-[0.98] transition-all shadow-lg shadow-emerald-950/50 flex flex-col items-center justify-center gap-1"
                      >
                        <div className="flex items-center gap-1.5">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          <span>OVER {predictionDigit}</span>
                        </div>
                        <span className="text-[11px] font-mono text-emerald-200 font-semibold">+82% Payout</span>
                      </button>

                      <button
                        onClick={() => placeManualTrade("under")}
                        className="p-3.5 rounded-xl font-display font-bold text-sm bg-gradient-to-br from-rose-600 to-rose-700 text-white hover:from-rose-500 hover:to-rose-600 active:scale-[0.98] transition-all shadow-lg shadow-rose-950/50 flex flex-col items-center justify-center gap-1"
                      >
                        <div className="flex items-center gap-1.5">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <path d="M12 5v14M5 12l7 7 7-7" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          <span>UNDER {predictionDigit}</span>
                        </div>
                        <span className="text-[11px] font-mono text-rose-200 font-semibold">+82% Payout</span>
                      </button>
                    </div>
                  </div>
                )}

                {contractType === "higher-lower" && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => placeManualTrade("higher")}
                      className="p-3.5 rounded-xl font-display font-bold text-sm bg-gradient-to-br from-emerald-600 to-emerald-700 text-white hover:from-emerald-500 hover:to-emerald-600 active:scale-[0.98] transition-all shadow-lg shadow-emerald-950/50 flex flex-col items-center justify-center gap-1"
                    >
                      <div className="flex items-center gap-1.5">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span>HIGHER</span>
                      </div>
                      <span className="text-[11px] font-mono text-emerald-200 font-semibold">+82% Payout</span>
                    </button>

                    <button
                      onClick={() => placeManualTrade("lower")}
                      className="p-3.5 rounded-xl font-display font-bold text-sm bg-gradient-to-br from-rose-600 to-rose-700 text-white hover:from-rose-500 hover:to-rose-600 active:scale-[0.98] transition-all shadow-lg shadow-rose-950/50 flex flex-col items-center justify-center gap-1"
                    >
                      <div className="flex items-center gap-1.5">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <path d="M12 5v14M5 12l7 7 7-7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span>LOWER</span>
                      </div>
                      <span className="text-[11px] font-mono text-rose-200 font-semibold">+82% Payout</span>
                    </button>
                  </div>
                )}
              </div>

              {/* SUMMARY ROW */}
              <div className="bg-[#140E2A] p-3 rounded-xl border border-purple-500/20 text-xs space-y-2">
                <div className="flex justify-between text-zinc-400">
                  <span>Stake Amount</span>
                  <span className="font-mono text-white font-semibold">${parseFloat(stake || "0").toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Potential Payout</span>
                  <span className="font-mono text-emerald-400 font-bold">
                    ${(parseFloat(stake || "0") * payoutMultiplier).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Entry Digit</span>
                  <span className="font-mono text-purple-300 font-bold">{currentDigit}</span>
                </div>
              </div>
            </div>
          )}

          {/* ================= BOT MODE ================= */}
          {tradingMode === "bot" && (
            <div className="p-3 space-y-4">
              {/* BOT STATUS HEADER */}
              <div className="p-3 rounded-xl bg-[#160F2E] border border-purple-500/25 flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-zinc-400 uppercase font-semibold">Bot Status</div>
                  <div className="font-display font-bold text-sm text-white capitalize flex items-center gap-2 mt-0.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        botRunning ? "bg-emerald-400 animate-ping" : "bg-zinc-500"
                      }`}
                    />
                    <span>{botStatus.replace("-", " ").toUpperCase()}</span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[10px] text-zinc-400">Session P&L</div>
                  <div
                    className={`font-mono text-sm font-bold ${
                      botSessionProfit >= 0 ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {botSessionProfit >= 0 ? "+" : ""}${botSessionProfit.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* STRATEGY SELECTOR */}
              <div>
                <div className="field-label">Trading Strategy</div>
                <select
                  value={botStrategy}
                  onChange={(e) => setBotStrategy(e.target.value as typeof botStrategy)}
                  disabled={botRunning}
                  className="field-input cursor-pointer"
                >
                  <option value="rsi">RSI Extremes (Buy &lt;32, Sell &gt;68)</option>
                  <option value="even-odd">Digit Parity Run (Even/Odd)</option>
                  <option value="momentum">Price Momentum Trend</option>
                  <option value="match-differ">Digit Hunter (Differ Prediction)</option>
                </select>
              </div>

              {/* BASE STAKE */}
              <div>
                <div className="field-label">Base Stake</div>
                <div className="flex items-center gap-2 bg-[#160F2E] border border-purple-500/25 rounded-xl p-1 mb-2">
                  <button
                    onClick={() => stepBotStake(-0.5)}
                    disabled={botRunning}
                    className="w-9 h-9 rounded-lg bg-[#0C0818] border border-purple-500/20 text-white text-base font-bold hover:bg-purple-900/30 disabled:opacity-50 flex items-center justify-center"
                  >
                    −
                  </button>
                  <div className="flex-1 text-center font-mono text-lg font-bold text-white">
                    <span className="text-purple-400 mr-1">$</span>
                    <input
                      type="number"
                      value={botBaseStake}
                      onChange={(e) => setBotBaseStake(e.target.value)}
                      disabled={botRunning}
                      className="bg-transparent text-center font-mono text-lg font-bold text-white w-20 outline-none"
                    />
                  </div>
                  <button
                    onClick={() => stepBotStake(0.5)}
                    disabled={botRunning}
                    className="w-9 h-9 rounded-lg bg-[#0C0818] border border-purple-500/20 text-white text-base font-bold hover:bg-purple-900/30 disabled:opacity-50 flex items-center justify-center"
                  >
                    +
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-1">
                  {[0.5, 1, 5, 10].map((v) => (
                    <button
                      key={v}
                      onClick={() => setBotBaseStake(v.toFixed(2))}
                      disabled={botRunning}
                      className={`py-1 rounded text-xs font-mono font-bold border transition-all ${
                        parseFloat(botBaseStake) === v
                          ? "bg-purple-600 text-white border-purple-400"
                          : "bg-[#160F2E] border-purple-500/15 text-zinc-400 hover:text-white"
                      }`}
                    >
                      ${v}
                    </button>
                  ))}
                </div>
              </div>

              {/* MARTINGALE */}
              <div className="bg-[#160F2E] border border-purple-500/20 rounded-xl p-2.5 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white">Martingale</div>
                  <div className="text-[10px] text-zinc-400">Multiply stake after loss</div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={martingaleMultiplier}
                    onChange={(e) => setMartingaleMultiplier(parseFloat(e.target.value))}
                    disabled={botRunning}
                    className="bg-[#0C0818] border border-purple-500/30 text-purple-300 rounded px-1.5 py-0.5 text-xs font-mono font-bold outline-none"
                  >
                    <option value="1.5">1.5x</option>
                    <option value="2.0">2.0x</option>
                    <option value="2.5">2.5x</option>
                  </select>
                  <button
                    onClick={() => setMartingaleEnabled((m) => !m)}
                    disabled={botRunning}
                    className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                      martingaleEnabled ? "bg-purple-600" : "bg-zinc-700"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white transition-transform ${
                        martingaleEnabled ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* TARGET PROFIT & STOP LOSS */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[#160F2E] border border-purple-500/20 rounded-xl p-2.5">
                  <div className="text-[10px] text-zinc-400 uppercase font-semibold">Target Profit</div>
                  <div className="flex items-center gap-1 mt-1 font-mono">
                    <span className="text-emerald-400 font-bold">$</span>
                    <input
                      type="number"
                      value={targetProfit}
                      onChange={(e) => setTargetProfit(e.target.value)}
                      disabled={botRunning}
                      className="bg-transparent text-sm font-bold text-white w-full outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="bg-[#160F2E] border border-purple-500/20 rounded-xl p-2.5">
                  <div className="text-[10px] text-zinc-400 uppercase font-semibold">Stop Loss</div>
                  <div className="flex items-center gap-1 mt-1 font-mono">
                    <span className="text-rose-400 font-bold">$</span>
                    <input
                      type="number"
                      value={stopLoss}
                      onChange={(e) => setStopLoss(e.target.value)}
                      disabled={botRunning}
                      className="bg-transparent text-sm font-bold text-white w-full outline-none font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* MAX TRADES */}
              <div className="bg-[#160F2E] border border-purple-500/20 rounded-xl p-2.5 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400">Maximum Trades</span>
                  <span className="font-mono font-bold text-purple-300">{maxTrades}</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="50"
                  value={maxTrades}
                  onChange={(e) => setMaxTrades(parseInt(e.target.value, 10))}
                  disabled={botRunning}
                  className="w-full accent-purple-500 cursor-pointer"
                />
              </div>

              {/* BOT PERFORMANCE DASHBOARD */}
              <div className="bg-[#140E2A] border border-purple-500/20 rounded-xl p-3 text-xs space-y-2">
                <div className="flex justify-between text-zinc-400">
                  <span>Trades Completed</span>
                  <span className="font-mono text-white font-bold">{botTradesCount} / {maxTrades}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Win / Loss</span>
                  <span className="font-mono font-bold">
                    <span className="text-emerald-400">{botWins}W</span> - <span className="text-rose-400">{botLosses}L</span>
                  </span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Next Stake</span>
                  <span className="font-mono text-purple-300 font-bold">${botCurrentStake.toFixed(2)}</span>
                </div>
              </div>

              {/* BOT START / STOP BUTTON */}
              <button
                onClick={toggleBot}
                className={`w-full py-3.5 rounded-xl font-display font-bold text-sm tracking-wide transition-all shadow-lg ${
                  botRunning
                    ? "bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white shadow-rose-950/50"
                    : "bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white shadow-purple-950/50"
                }`}
              >
                {botRunning ? "STOP BOT" : "START BOT AUTO-TRADING"}
              </button>

              {/* Bot activity log */}
              {botLogs.length > 0 && (
                <div className="bg-[#0A0716] border border-purple-500/15 rounded-xl p-2.5 max-h-32 overflow-y-auto font-mono text-[11px] text-zinc-400 space-y-1">
                  {botLogs.map((log, index) => (
                    <div key={index} className="leading-tight">{log}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SIMULATION POLICY CONTROLS (IF SUPER ADMIN & SIMULATION) */}
          {simulationMode && capabilities.canViewAdminPanel && (
            <div className="p-3 border-t border-amber-500/30 bg-amber-950/15 space-y-2">
              <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                AdminSim Override
              </div>
              <div className="flex gap-2">
                <select
                  value={forcedOutcome}
                  onChange={(e) => setForcedOutcome(e.target.value as typeof forcedOutcome)}
                  className="bg-[#120D26] border border-amber-500/40 text-xs rounded px-2 py-1 text-white font-mono flex-1 outline-none"
                >
                  <option value="none">No override</option>
                  <option value="won">Force WIN</option>
                  <option value="lost">Force LOSS</option>
                </select>
                <button
                  onClick={applyAdminPolicy}
                  className="px-3 py-1 bg-amber-500 text-black text-xs font-bold rounded hover:bg-amber-400 transition-colors"
                >
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

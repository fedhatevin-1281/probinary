import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"

export type MarketCategory = "volatility" | "boom" | "crash" | "step"

export type ContractType = "rise-fall" | "even-odd" | "match-differ"

export type TradeDirection = "rise" | "fall" | "even" | "odd" | "match" | "differ"

export type TradeStatus = "open" | "won" | "lost"

export type UserRole = "user" | "admin" | "super_admin"

export interface RoleCapabilities {
  canAdjustBalance: boolean

  canForceClose: boolean

  canViewAdminPanel: boolean
}

export interface AdminSimPolicy {
  forceNextOutcome: "won" | "lost" | null

  updatedAt: number | null

  updatedBy: string | null

  lastAppliedAt: number | null
}

export interface MarketSeed {
  symbol: string

  name: string

  category: MarketCategory

  basePrice: number

  volatility: number

  drift: number

  volatilityLabel: string
}

export interface MarketSnapshot extends MarketSeed {
  price: number

  changePct: number

  history: number[]

  lastDigit: number
}

export interface BinaryTrade {
  id: string

  symbol: string

  marketName: string

  contractType: ContractType

  direction: TradeDirection

  stake: number

  entryPrice: number

  entryDigit: number

  expiryAt: number

  expirySeconds: number

  payoutMultiplier: number

  status: TradeStatus

  createdAt: number

  settledAt?: number

  exitPrice?: number

  exitDigit?: number

  payout?: number

  profit?: number

  result?: "won" | "lost"
}

interface TradingState {
  markets: Record<string, MarketSnapshot>

  balance: number

  realizedPnl: number

  openTrades: BinaryTrade[]

  closedTrades: BinaryTrade[]

  selectedSymbol: string

  lastError: string | null

  lastAction: string | null
}

interface TradeInput {
  symbol: string

  contractType: ContractType

  direction: TradeDirection

  stake: number

  expirySeconds: number
}

interface TradingContextValue {
  connectionMode: "connecting" | "server" | "local"

  simulationMode: boolean

  role: UserRole

  capabilities: RoleCapabilities

  adminPolicy: AdminSimPolicy

  marketList: MarketSnapshot[]

  markets: Record<string, MarketSnapshot>

  selectedMarket: MarketSnapshot

  selectedSymbol: string

  balance: number

  equity: number

  realizedPnl: number

  winRate: number

  openTrades: BinaryTrade[]

  closedTrades: BinaryTrade[]

  recentTrades: BinaryTrade[]

  lastError: string | null

  lastAction: string | null

  selectMarket: (symbol: string) => void

  placeTrade: (
    input: TradeInput,
  ) => { ok: boolean tradeId?: string error?: string }

  forceCloseTrade: (tradeId: string) => { ok: boolean error?: string }

  adjustBalance: (
    amount: number,
    reason: string,
  ) => { ok: boolean error?: string }

  setAdminPolicy: (
    forceNextOutcome: "won" | "lost" | null,
  ) => { ok: boolean error?: string }
}

const STARTING_BALANCE = 25000

const HISTORY_LIMIT = 120

const DEFAULT_CAPABILITIES: RoleCapabilities = {
  canAdjustBalance: false,

  canForceClose: false,

  canViewAdminPanel: false,
}

const ROLE_CAPABILITIES: Record<UserRole, RoleCapabilities> = {
  user: {
    canAdjustBalance: false,
    canForceClose: false,
    canViewAdminPanel: false,
  },

  admin: {
    canAdjustBalance: true,
    canForceClose: true,
    canViewAdminPanel: false,
  },

  super_admin: {
    canAdjustBalance: true,
    canForceClose: true,
    canViewAdminPanel: true,
  },
}

function resolveLocalAuth(): {
  simulationMode: boolean
  role: UserRole
  capabilities: RoleCapabilities
} {
  const token =
    typeof window !== "undefined"
      ? (window.localStorage.getItem("pb.auth.token") ?? "")
      : ""

  if (token === "sim-super-admin") {
    return {
      simulationMode: true,
      role: "super_admin",
      capabilities: ROLE_CAPABILITIES.super_admin,
    }
  }

  if (token === "sim-admin") {
    return {
      simulationMode: true,
      role: "admin",
      capabilities: ROLE_CAPABILITIES.admin,
    }
  }

  return {
    simulationMode: false,
    role: "user",
    capabilities: ROLE_CAPABILITIES.user,
  }
}

const DEFAULT_ADMIN_POLICY: AdminSimPolicy = {
  forceNextOutcome: null,

  updatedAt: null,

  updatedBy: null,

  lastAppliedAt: null,
}

type TransportMode = "connecting" | "server" | "local"

type ServerMessage = { type: "STATE" state: TradingState } | {
  type: "ACK"
  ok: boolean
  action?: string
  error?: string
  tradeId?: string
} | {
  type: "AUTH_STATE"
  simulationMode: boolean
  role: UserRole
  capabilities: RoleCapabilities
} | { type: "SIM_POLICY_STATE" policy: AdminSimPolicy } | {
  type: "ERROR"
  error: string
}

function resolveWebSocketUrl() {
  const configured = import.meta.env.VITE_WS_URL

  if (configured) {
    return configured
  }

  if (typeof window !== "undefined") {
    const hostname = window.location.hostname
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
      return `${protocol}//${window.location.host}`
    }
    return "ws://localhost:8080"
  }

  return "ws://localhost:8080"
}

export const MARKET_SEEDS: MarketSeed[] = [
  {
    symbol: "VOL-10",
    name: "Volatility 10 Index",
    category: "volatility",
    basePrice: 3891.77,
    volatility: 0.0019,
    drift: 0.0001,
    volatilityLabel: "Low",
  },

  {
    symbol: "VOL-25",
    name: "Volatility 25 Index",
    category: "volatility",
    basePrice: 5234.44,
    volatility: 0.0021,
    drift: 0.00012,
    volatilityLabel: "Low",
  },

  {
    symbol: "VOL-50",
    name: "Volatility 50 Index",
    category: "volatility",
    basePrice: 6789.31,
    volatility: 0.0026,
    drift: 0.0001,
    volatilityLabel: "Medium",
  },

  {
    symbol: "VOL-75",
    name: "Volatility 75 Index",
    category: "volatility",
    basePrice: 8243.12,
    volatility: 0.0031,
    drift: 0.00008,
    volatilityLabel: "High",
  },

  {
    symbol: "VOL-100",
    name: "Volatility 100 Index",
    category: "volatility",
    basePrice: 15420.33,
    volatility: 0.0038,
    drift: 0.00008,
    volatilityLabel: "Very High",
  },

  {
    symbol: "BOOM-300",
    name: "Boom 300 Index",
    category: "boom",
    basePrice: 7841.2,
    volatility: 0.0028,
    drift: 0.0006,
    volatilityLabel: "Medium",
  },

  {
    symbol: "BOOM-500",
    name: "Boom 500 Index",
    category: "boom",
    basePrice: 12891.44,
    volatility: 0.0036,
    drift: 0.0009,
    volatilityLabel: "High",
  },

  {
    symbol: "BOOM-1000",
    name: "Boom 1000 Index",
    category: "boom",
    basePrice: 22104.55,
    volatility: 0.0043,
    drift: 0.0013,
    volatilityLabel: "Very High",
  },

  {
    symbol: "CRASH-300",
    name: "Crash 300 Index",
    category: "crash",
    basePrice: 5674.8,
    volatility: 0.0028,
    drift: -0.0005,
    volatilityLabel: "Medium",
  },

  {
    symbol: "CRASH-500",
    name: "Crash 500 Index",
    category: "crash",
    basePrice: 4312.2,
    volatility: 0.0034,
    drift: -0.0008,
    volatilityLabel: "High",
  },

  {
    symbol: "CRASH-1000",
    name: "Crash 1000 Index",
    category: "crash",
    basePrice: 2891.66,
    volatility: 0.0042,
    drift: -0.0012,
    volatilityLabel: "Very High",
  },

  {
    symbol: "STEP-UP",
    name: "Step Index (Up)",
    category: "step",
    basePrice: 9122.64,
    volatility: 0.0023,
    drift: 0.00035,
    volatilityLabel: "Low",
  },

  {
    symbol: "JUMP-10",
    name: "Jump 10 Index",
    category: "step",
    basePrice: 18934,
    volatility: 0.003,
    drift: 0.00045,
    volatilityLabel: "High",
  },

  {
    symbol: "JUMP-25",
    name: "Jump 25 Index",
    category: "step",
    basePrice: 44211.8,
    volatility: 0.0036,
    drift: 0.00065,
    volatilityLabel: "Very High",
  },

  {
    symbol: "JUMP-50",
    name: "Jump 50 Index",
    category: "step",
    basePrice: 91234,
    volatility: 0.0042,
    drift: 0.0008,
    volatilityLabel: "Extreme",
  },
]

const PAYOUTS: Record<ContractType, number> = {
  "rise-fall": 1.82,

  "even-odd": 1.8,

  "match-differ": 2.15,
}

const SAMPLE_CLOSED_TRADES: BinaryTrade[] = [
  makeSampleTrade(
    "TRD-8821",
    "VOL-75",
    "Volatility 75 Index",
    "rise-fall",
    "rise",
    50,
    8120.44,
    8243.12,
    8,
    30,
    1.82,
    "won",
    41,
    0,
  ),

  makeSampleTrade(
    "TRD-8820",
    "BOOM-500",
    "Boom 500 Index",
    "rise-fall",
    "fall",
    40,
    13201,
    12891.44,
    5,
    30,
    1.82,
    "won",
    32.8,
    1,
  ),

  makeSampleTrade(
    "TRD-8819",
    "CRASH-300",
    "Crash 300 Index",
    "even-odd",
    "odd",
    35,
    5890.2,
    5674.8,
    2,
    20,
    1.8,
    "lost",
    -35,
    2,
  ),

  makeSampleTrade(
    "TRD-8818",
    "VOL-100",
    "Volatility 100 Index",
    "match-differ",
    "differ",
    60,
    15100,
    15420.33,
    0,
    45,
    2.15,
    "won",
    69,
    3,
  ),
]

const TradingContext = createContext<TradingContextValue | null>(null)

export function TradingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TradingState>(() => createInitialState())

  const [connectionMode, setConnectionMode] =
    useState<TransportMode>("connecting")

  const [simulationMode, setSimulationMode] = useState(false)

  const [role, setRole] = useState<UserRole>("user")

  const [capabilities, setCapabilities] =
    useState<RoleCapabilities>(DEFAULT_CAPABILITIES)

  const [adminPolicy, setAdminPolicyState] =
    useState<AdminSimPolicy>(DEFAULT_ADMIN_POLICY)

  const stateRef = useRef(state)

  const socketRef = useRef<WebSocket | null>(null)

  const localTimerRef = useRef<number | null>(null)

  const reconnectTimerRef = useRef<number | null>(null)

  const reconnectAllowedRef = useRef(true)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  // Sync wallet balance to DB when it changes (for serverless Vercel deploy)
  useEffect(() => {
    const token =
      typeof window !== "undefined"
        ? window.localStorage.getItem("pb.auth.token")
        : null
    if (!token || token.startsWith("sim-") || token === "demo-auth-token") {
      return
    }
    fetch("/api/trading/sync-wallet", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ balance: state.balance }),
    }).catch((err) => console.error("Balance sync error:", err))
  }, [state.balance])

  useEffect(() => {
    const startLocalFallback = () => {
      if (localTimerRef.current !== null) {
        return
      }

      if (connectionMode !== "server") {
        setConnectionMode("local")

        const auth = resolveLocalAuth()

        setSimulationMode(auth.simulationMode)

        setRole(auth.role)

        setCapabilities(auth.capabilities)
      }

      localTimerRef.current = window.setInterval(() => {
        setState((prev) => advanceState(prev, Date.now()))
      }, 1000)
    }

    const stopLocalFallback = () => {
      if (localTimerRef.current !== null) {
        window.clearInterval(localTimerRef.current)

        localTimerRef.current = null
      }
    }

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current)

        reconnectTimerRef.current = null
      }
    }

    const connect = () => {
      if (typeof window === "undefined") {
        const auth = resolveLocalAuth()

        setSimulationMode(auth.simulationMode)

        setRole(auth.role)

        setCapabilities(auth.capabilities)

        startLocalFallback()

        return
      }

      const socket = new WebSocket(resolveWebSocketUrl())

      socketRef.current = socket

      setConnectionMode("connecting")

      socket.onopen = () => {
        stopLocalFallback()

        setConnectionMode("server")

        const token =
          window.localStorage.getItem("pb.auth.token") || "demo-auth-token"

        socket.send(JSON.stringify({ type: "AUTH_INIT", token }))

        setState((prev) => ({
          ...prev,
          lastAction: "Connected to backend",
          lastError: null,
        }))
      }

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as ServerMessage

          if (message.type === "STATE") {
            setState(message.state)

            return
          }

          if (message.type === "ACK") {
            setState((prev) => ({
              ...prev,

              lastAction: message.action ?? prev.lastAction,

              lastError: message.ok ? null : (message.error ?? prev.lastError),
            }))

            return
          }

          if (message.type === "AUTH_STATE") {
            setSimulationMode(message.simulationMode)

            setRole(message.role)

            setCapabilities(message.capabilities)

            setState((prev) => ({
              ...prev,
              lastAction: `Authenticated as ${message.role}`,
            }))

            return
          }

          if (message.type === "SIM_POLICY_STATE") {
            setAdminPolicyState(message.policy)

            return
          }

          if (message.type === "ERROR") {
            setState((prev) => ({ ...prev, lastError: message.error }))
          }
        } catch {
          setState((prev) => ({
            ...prev,
            lastError: "Received malformed backend message",
          }))
        }
      }

      socket.onerror = () => {
        socket.close()
      }

      socket.onclose = () => {
        if (socketRef.current === socket) {
          socketRef.current = null
        }

        if (!reconnectAllowedRef.current) {
          return
        }

        setConnectionMode("local")

        startLocalFallback()

        clearReconnectTimer()

        reconnectTimerRef.current = window.setTimeout(() => {
          if (reconnectAllowedRef.current && socketRef.current === null) {
            connect()
          }
        }, 3000)
      }
    }

    reconnectAllowedRef.current = true

    connect()

    return () => {
      reconnectAllowedRef.current = false

      stopLocalFallback()

      clearReconnectTimer()

      socketRef.current?.close()

      socketRef.current = null
    }
  }, [])

  const selectMarket = (symbol: string) => {
    setState((prev) =>
      prev.selectedSymbol === symbol
        ? prev
        : { ...prev, selectedSymbol: symbol, lastAction: `Selected ${symbol}` },
    )

    const socket = socketRef.current

    if (connectionMode === "server" && socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "SELECT_MARKET", symbol }))
    }
  }

  const placeTrade = (input: TradeInput) => {
    const socket = socketRef.current

    if (connectionMode === "server" && socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "PLACE_TRADE", input }))

      setState((prev) => ({
        ...prev,

        selectedSymbol: input.symbol,

        lastAction: `Submitted ${input.contractType} trade on ${input.symbol}`,

        lastError: null,
      }))

      return { ok: true, tradeId: `pending-${Date.now()}` }
    }

    const current = stateRef.current

    const market = current.markets[input.symbol]

    if (!market) {
      const error = "Market is unavailable"

      setState((prev) => ({ ...prev, lastError: error }))

      return { ok: false, error }
    }

    const stake = round2(input.stake)

    if (!Number.isFinite(stake) || stake <= 0) {
      const error = "Stake must be greater than zero"

      setState((prev) => ({ ...prev, lastError: error }))

      return { ok: false, error }
    }

    if (stake > current.balance) {
      const error = "Insufficient balance"

      setState((prev) => ({ ...prev, lastError: error }))

      return { ok: false, error }
    }

    const expirySeconds = Math.max(10, Math.round(input.expirySeconds || 30))

    const trade: BinaryTrade = {
      id: `TRD-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 90 + 10)}`,

      symbol: market.symbol,

      marketName: market.name,

      contractType: input.contractType,

      direction: input.direction,

      stake,

      entryPrice: market.price,

      entryDigit: lastDigit(market.price),

      expiryAt: Date.now() + expirySeconds * 1000,

      expirySeconds,

      payoutMultiplier: PAYOUTS[input.contractType],

      status: "open",

      createdAt: Date.now(),
    }

    setState((prev) => ({
      ...prev,

      balance: round2(prev.balance - stake),

      openTrades: [trade, ...prev.openTrades],

      lastError: null,

      lastAction: `Opened ${trade.contractType} trade on ${trade.symbol}`,

      selectedSymbol: trade.symbol,
    }))

    return { ok: true, tradeId: trade.id }
  }

  const forceCloseTrade = (tradeId: string) => {
    const socket = socketRef.current

    if (connectionMode === "server" && socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "FORCE_CLOSE_TRADE", tradeId }))

      setState((prev) => ({
        ...prev,
        lastAction: `Requested close for ${tradeId}`,
        lastError: null,
      }))

      return { ok: true }
    }

    const current = stateRef.current

    const trade = current.openTrades.find((item) => item.id === tradeId)

    if (!trade) {
      const error = "Trade not found"

      setState((prev) => ({ ...prev, lastError: error }))

      return { ok: false, error }
    }

    const market = current.markets[trade.symbol]

    if (!market) {
      const error = "Market not available"

      setState((prev) => ({ ...prev, lastError: error }))

      return { ok: false, error }
    }

    setState((prev) => settleTrade(prev, trade.id, market.price, Date.now()))

    return { ok: true }
  }

  const adjustBalance = (amount: number, reason: string) => {
    const delta = round2(amount)

    if (!Number.isFinite(delta) || delta === 0) {
      const error = "Balance adjustment amount must be non-zero"

      setState((prev) => ({ ...prev, lastError: error }))

      return { ok: false, error }
    }

    const socket = socketRef.current

    if (connectionMode === "server" && socket?.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({ type: "ADJUST_BALANCE", amount: delta, reason }),
      )

      setState((prev) => ({
        ...prev,

        lastAction: `Submitted balance adjustment: ${reason}`,

        lastError: null,
      }))

      return { ok: true }
    }

    const current = stateRef.current

    const nextBalance = round2(current.balance + delta)

    if (nextBalance < 0) {
      const error = "Insufficient balance for adjustment"

      setState((prev) => ({ ...prev, lastError: error }))

      return { ok: false, error }
    }

    setState((prev) => ({
      ...prev,

      balance: nextBalance,

      lastAction: reason,

      lastError: null,
    }))

    return { ok: true }
  }

  const setAdminPolicy = (forceNextOutcome: "won" | "lost" | null) => {
    if (!simulationMode) {
      return { ok: false, error: "Simulation mode is disabled" }
    }

    if (!capabilities.canViewAdminPanel) {
      return { ok: false, error: "Not permitted to set admin policy" }
    }

    const socket = socketRef.current

    if (connectionMode === "server" && socket?.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({ type: "SIM_SET_ADMIN_POLICY", forceNextOutcome }),
      )

      setState((prev) => ({
        ...prev,

        lastAction: "Submitted admin simulation policy update",

        lastError: null,
      }))

      return { ok: true }
    }

    return { ok: false, error: "Backend connection required" }
  }

  const marketList = MARKET_SEEDS.map(
    (seed) => state.markets[seed.symbol],
  ).filter(Boolean)

  const selectedMarket = state.markets[state.selectedSymbol] ?? marketList[0]

  const closedTrades = state.closedTrades

  const wins = closedTrades.filter((trade) => trade.result === "won").length

  const winRate =
    closedTrades.length > 0 ? (wins / closedTrades.length) * 100 : 0

  const equity = round2(
    state.balance +
      state.openTrades.reduce((sum, trade) => sum + trade.stake * 0.35, 0),
  )

  const recentTrades = [...state.closedTrades]
    .sort((a, b) => (b.settledAt ?? b.createdAt) - (a.settledAt ?? a.createdAt))
    .slice(0, 8)

  return (
    <TradingContext.Provider
      value={{
        connectionMode,

        simulationMode,

        role,

        capabilities,

        adminPolicy,

        marketList,

        markets: state.markets,

        selectedMarket,

        selectedSymbol: state.selectedSymbol,

        balance: state.balance,

        equity,

        realizedPnl: state.realizedPnl,

        winRate,

        openTrades: state.openTrades,

        closedTrades,

        recentTrades,

        lastError: state.lastError,

        lastAction: state.lastAction,

        selectMarket,

        placeTrade,

        forceCloseTrade,

        adjustBalance,

        setAdminPolicy,
      }}
    >
      {children}
    </TradingContext.Provider>
  )
}

export function useTrading() {
  const context = useContext(TradingContext)

  if (!context) {
    throw new Error("useTrading must be used within a TradingProvider")
  }

  return context
}

export function buildSeriesShape(
  values: number[],
  width: number,
  height: number,
  padding = 10,
) {
  const series = values.length > 1 ? values : [values[0] ?? 0, values[0] ?? 0]

  const min = Math.min(...series)

  const max = Math.max(...series)

  const range = max - min || 1

  const points = series.map((value, index) => ({
    x: (index / (series.length - 1)) * width,

    y: height - ((value - min) / range) * (height - padding * 2) - padding,
  }))

  const line = points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`,
    )
    .join(" ")

  const area = `${line} L${width},${height} L0,${height} Z`

  return { points, line, area, min, max }
}

export function marketLabel(direction: TradeDirection) {
  switch (direction) {
    case "rise":
      return "RISE"

    case "fall":
      return "FALL"

    case "even":
      return "EVEN"

    case "odd":
      return "ODD"

    case "match":
      return "MATCH"

    case "differ":
      return "DIFFER"
  }
}

function createInitialState(): TradingState {
  const markets = Object.fromEntries(
    MARKET_SEEDS.map((seed) => [seed.symbol, createMarket(seed)]),
  ) as Record<string, MarketSnapshot>

  return {
    markets,

    balance: STARTING_BALANCE,

    realizedPnl: 1471.35,

    openTrades: [],

    closedTrades: SAMPLE_CLOSED_TRADES,

    selectedSymbol: "VOL-75",

    lastError: null,

    lastAction: "Simulation ready",
  }
}

function createMarket(seed: MarketSeed): MarketSnapshot {
  const history = createHistory(seed.basePrice, seed.volatility, seed.drift)

  const price = history[history.length - 1] ?? seed.basePrice

  return {
    ...seed,

    price,

    changePct: round2(((price - seed.basePrice) / seed.basePrice) * 100),

    history,

    lastDigit: lastDigit(price),
  }
}

function createHistory(basePrice: number, volatility: number, drift: number) {
  const history: number[] = [basePrice * 0.985]

  for (let index = 1; index < 90; index++) {
    const last = history[index - 1]

    history.push(nextPrice(last, volatility, drift, basePrice, index))
  }

  return history.map(round2)
}

function advanceState(prev: TradingState, now: number): TradingState {
  const markets: Record<string, MarketSnapshot> = {}

  for (const seed of MARKET_SEEDS) {
    const current = prev.markets[seed.symbol] ?? createMarket(seed)

    const price = nextPrice(
      current.price,
      seed.volatility,
      seed.drift,
      seed.basePrice,
    )

    const history = [...current.history, price].slice(-HISTORY_LIMIT)

    markets[seed.symbol] = {
      ...current,

      price,

      history,

      changePct: round2(((price - seed.basePrice) / seed.basePrice) * 100),

      lastDigit: lastDigit(price),
    }
  }

  let balance = prev.balance

  let realizedPnl = prev.realizedPnl

  const openTrades: BinaryTrade[] = []

  const closedTrades = [...prev.closedTrades]

  for (const trade of prev.openTrades) {
    if (trade.expiryAt > now) {
      openTrades.push(trade)

      continue
    }

    const market = markets[trade.symbol] ?? prev.markets[trade.symbol]

    const settled = resolveTrade(trade, market?.price ?? trade.entryPrice, now)

    balance = round2(balance + (settled.payout ?? 0))

    realizedPnl = round2(realizedPnl + (settled.profit ?? 0))

    closedTrades.unshift(settled)
  }

  return {
    ...prev,

    markets,

    balance,

    realizedPnl,

    openTrades,

    closedTrades: closedTrades.slice(0, 40),
  }
}

function settleTrade(
  prev: TradingState,
  tradeId: string,
  exitPrice: number,
  settledAt: number,
): TradingState {
  const trade = prev.openTrades.find((item) => item.id === tradeId)

  if (!trade) {
    return prev
  }

  const settled = resolveTrade(trade, exitPrice, settledAt)

  return {
    ...prev,

    balance: round2(prev.balance + (settled.payout ?? 0)),

    realizedPnl: round2(prev.realizedPnl + (settled.profit ?? 0)),

    openTrades: prev.openTrades.filter((item) => item.id !== tradeId),

    closedTrades: [settled, ...prev.closedTrades].slice(0, 40),

    lastAction: `Closed ${trade.symbol}`,

    lastError: null,
  }
}

function resolveTrade(
  trade: BinaryTrade,
  exitPrice: number,
  settledAt: number,
): BinaryTrade {
  const exitDigit = lastDigit(exitPrice)

  const won = isWinningTrade(trade, exitPrice, exitDigit)

  const payout = won ? round2(trade.stake * trade.payoutMultiplier) : 0

  const profit = won ? round2(payout - trade.stake) : round2(-trade.stake)

  return {
    ...trade,

    status: won ? "won" : "lost",

    result: won ? "won" : "lost",

    exitPrice: round2(exitPrice),

    exitDigit,

    settledAt,

    payout,

    profit,
  }
}

function isWinningTrade(
  trade: BinaryTrade,
  exitPrice: number,
  exitDigit: number,
) {
  switch (trade.contractType) {
    case "rise-fall":
      return trade.direction === "rise"
        ? exitPrice > trade.entryPrice
        : exitPrice < trade.entryPrice

    case "even-odd":
      return trade.direction === "even"
        ? exitDigit % 2 === 0
        : exitDigit % 2 === 1

    case "match-differ":
      return trade.direction === "match"
        ? exitDigit === trade.entryDigit
        : exitDigit !== trade.entryDigit
  }
}

function nextPrice(
  price: number,
  volatility: number,
  drift: number,
  mean: number,
  step = 0,
) {
  const gaussian = boxMuller()

  const meanReversion = ((mean - price) / mean) * 0.02

  const marketPulse = Math.sin(step / 8) * volatility * 0.2

  const shock = gaussian * volatility

  const spikeChance = Math.random() < 0.06 ? gaussian * volatility * 3.5 : 0

  const delta =
    price * (drift + meanReversion + marketPulse + shock + spikeChance)

  return Math.max(0.01, round2(price + delta))
}

function boxMuller() {
  const u1 = Math.max(Math.random(), 1e-8)

  const u2 = Math.random()

  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}

function lastDigit(price: number) {
  return Number(price.toFixed(2).slice(-1))
}

function round2(value: number) {
  return Math.round(value * 100) / 100
}

function makeSampleTrade(
  id: string,

  symbol: string,

  marketName: string,

  contractType: ContractType,

  direction: TradeDirection,

  stake: number,

  entryPrice: number,

  exitPrice: number,

  entryDigit: number,

  expirySeconds: number,

  payoutMultiplier: number,

  result: "won" | "lost",

  profit: number,

  minuteOffset: number,
): BinaryTrade {
  return {
    id,

    symbol,

    marketName,

    contractType,

    direction,

    stake,

    entryPrice,

    entryDigit,

    expiryAt: Date.now() - minuteOffset * 60000,

    expirySeconds,

    payoutMultiplier,

    status: result,

    createdAt: Date.now() - minuteOffset * 60000,

    settledAt: Date.now() - minuteOffset * 60000 + 30000,

    exitPrice,

    exitDigit: lastDigit(exitPrice),

    payout: result === "won" ? round2(stake * payoutMultiplier) : 0,

    profit,

    result,
  }
}

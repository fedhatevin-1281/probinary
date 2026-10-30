import {
  createContext,
  useContext,
  useCallback,
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

export interface TestBinaryAccount {
  userId: string

  initialBalance: number

  winRate: number
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

  isDemo?: boolean
}

interface TradingState {
  markets: Record<string, MarketSnapshot>

  balance: number

  demoBalance: number

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

  isDemo?: boolean
}

interface TradingContextValue {
  connectionMode: "connecting" | "server" | "offline"

  simulationMode: boolean

  role: UserRole

  capabilities: RoleCapabilities

  adminPolicy: AdminSimPolicy

  testBinaryAvailable: boolean

  testBinarySystem: boolean

  testBinaryWinRate: number | null

  testBinaryAccounts: TestBinaryAccount[]

  marketList: MarketSnapshot[]

  markets: Record<string, MarketSnapshot>

  selectedMarket: MarketSnapshot

  selectedSymbol: string

  balance: number

  demoBalance: number

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
  ) => { ok: boolean; tradeId?: string; error?: string }

  forceCloseTrade: (tradeId: string) => { ok: boolean; error?: string }

  adjustBalance: (
    amount: number,

    reason: string,
  ) => { ok: boolean; error?: string }

  syncBalanceFromServer: (balance: number) => void

  setAdminPolicy: (
    forceNextOutcome: "won" | "lost" | null,
  ) => { ok: boolean; error?: string }

  setTestBinaryAccount: (
    userId: string,

    enabled: boolean,

    initialBalance: number,
  ) => { ok: boolean; error?: string }
}

const STARTING_BALANCE = 0

const DEMO_BALANCE_CACHE_PREFIX = "pb.demo-balance.v1:"

function readCachedDemoBalance() {
  if (typeof window === "undefined") return 0

  const token = window.localStorage.getItem("pb.auth.token") || "demo-auth-token"
  const value = Number(
    window.localStorage.getItem(
      `${DEMO_BALANCE_CACHE_PREFIX}${encodeURIComponent(token)}`,
    ),
  )

  return Number.isFinite(value) && value >= 0 && value <= 100000000
    ? value
    : 0
}

const HISTORY_LIMIT = 120

const DEFAULT_CAPABILITIES: RoleCapabilities = {
  canAdjustBalance: false,

  canForceClose: false,

  canViewAdminPanel: false,
}

const DEFAULT_ADMIN_POLICY: AdminSimPolicy = {
  forceNextOutcome: null,

  updatedAt: null,

  updatedBy: null,

  lastAppliedAt: null,
}

type TransportMode = "connecting" | "server" | "offline"

type ServerMessage = { type: "STATE"; state: TradingState } | {
  type: "ACK"

  ok: boolean

  action?: string

  error?: string

  tradeId?: string
} | {
  type: "AUTH_STATE"

  userId: string | null

  simulationMode: boolean

  role: UserRole

  capabilities: RoleCapabilities

  testBinaryAvailable: boolean

  testBinarySystem: boolean

  testBinaryWinRate: number | null

  testBinaryAccounts: TestBinaryAccount[]
} | { type: "SIM_POLICY_STATE"; policy: AdminSimPolicy } | {
  type: "ERROR"

  error: string
}

function resolveWebSocketUrl(): string | null {
  const configured = import.meta.env.VITE_WS_URL

  if (configured) {
    return configured
  }

  if (typeof window !== "undefined") {
    const hostname = window.location.hostname

    if (hostname === "localhost" || hostname === "127.0.0.1") {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"

      return `${protocol}//${hostname}:8080`
    }

    return null
  }

  return null
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

  const [testBinarySystem, setTestBinarySystem] = useState(false)

  const [testBinaryAvailable, setTestBinaryAvailable] = useState(false)

  const [testBinaryWinRate, setTestBinaryWinRate] = useState<number | null>(
    null,
  )

  const [testBinaryAccounts, setTestBinaryAccounts] =
    useState<TestBinaryAccount[]>([])

  const socketRef = useRef<WebSocket | null>(null)

  const reconnectTimerRef = useRef<number | null>(null)

  const reconnectAllowedRef = useRef(true)

  const [serverAuthReady, setServerAuthReady] = useState(false)

  const [serverUserId, setServerUserId] = useState<string | null>(null)

  const authenticatedStateRef = useRef(false)

  const demoBalanceCacheKeyRef = useRef<string | null>(null)

  useEffect(() => {
    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current)

        reconnectTimerRef.current = null
      }
    }

    const connect = () => {
      if (typeof window === "undefined") {
        setConnectionMode("offline")

        return
      }

      const socketUrl = resolveWebSocketUrl()

      if (!socketUrl) {
        setConnectionMode("offline")

        setState((prev) => ({
          ...prev,

          lastError:
            "Trading server is not configured. Set VITE_WS_URL to enable server simulation.",
        }))

        return
      }

      const socket = new WebSocket(socketUrl)

      socketRef.current = socket

      setConnectionMode("connecting")

      socket.onopen = () => {
        setConnectionMode("server")

        setServerAuthReady(false)

        setServerUserId(null)

        authenticatedStateRef.current = false

        demoBalanceCacheKeyRef.current = null

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
            if (!authenticatedStateRef.current) return

            const cacheKey = demoBalanceCacheKeyRef.current
            if (cacheKey && Number.isFinite(message.state.demoBalance)) {
              try {
                const cachedValue = String(message.state.demoBalance)
                window.localStorage.setItem(
                  cacheKey,
                  cachedValue,
                )
                const token =
                  window.localStorage.getItem("pb.auth.token") ||
                  "demo-auth-token"
                window.localStorage.setItem(
                  `${DEMO_BALANCE_CACHE_PREFIX}${encodeURIComponent(token)}`,
                  cachedValue,
                )
              } catch {
                setState((prev) => ({
                  ...prev,
                  lastError: "Could not save this browser's demo balance cache.",
                }))
              }
            }

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
            const token =
              window.localStorage.getItem("pb.auth.token") || "demo-auth-token"
            const requiresDatabaseUser =
              token !== "demo-auth-token" && !token.startsWith("sim-")
            const authenticated = !requiresDatabaseUser || message.userId !== null

            authenticatedStateRef.current = authenticated
            setServerAuthReady(authenticated)
            setServerUserId(authenticated ? message.userId : null)

            const cacheIdentity = message.userId || token
            const cacheKey = `${DEMO_BALANCE_CACHE_PREFIX}${encodeURIComponent(cacheIdentity)}`
            demoBalanceCacheKeyRef.current = message.testBinarySystem
              || !authenticated
              ? null
              : cacheKey

            if (authenticated && !message.testBinarySystem) {
              try {
                const cachedBalance =
                  window.localStorage.getItem(cacheKey) ??
                  window.localStorage.getItem(
                    `${DEMO_BALANCE_CACHE_PREFIX}${encodeURIComponent(token)}`,
                  )
                if (cachedBalance !== null) {
                  const balance = Number(cachedBalance)
                  if (Number.isFinite(balance) && balance >= 0 && balance <= 100000000) {
                    socket.send(
                      JSON.stringify({
                        type: "RESTORE_DEMO_BALANCE",
                        balance,
                      }),
                    )
                  }
                }
              } catch {
                setState((prev) => ({
                  ...prev,
                  lastError: "Could not restore this browser's demo balance cache.",
                }))
              }
            }

            if (!authenticated) {
              setState((prev) => ({
                ...prev,
                lastError:
                  "Trading server could not authenticate this account. Check that JWT_SECRET matches the auth API.",
              }))
              return
            }

            setSimulationMode(message.simulationMode)

            setRole(message.role)

            setCapabilities(message.capabilities)

            setTestBinaryAvailable(message.testBinaryAvailable)

            setTestBinarySystem(message.testBinarySystem)

            setTestBinaryWinRate(message.testBinaryWinRate)

            setTestBinaryAccounts(message.testBinaryAccounts)

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

        setConnectionMode("offline")

        setServerAuthReady(false)

        setServerUserId(null)

        authenticatedStateRef.current = false

        demoBalanceCacheKeyRef.current = null

        setState((prev) => ({
          ...prev,

          lastError: "Trading server disconnected. Reconnecting...",
        }))

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

    if (
      connectionMode !== "server" ||
      socket?.readyState !== WebSocket.OPEN ||
      !serverAuthReady ||
      (!input.isDemo && !serverUserId)
    ) {
      const error =
        "Trading simulation requires an authenticated server connection."

      setState((prev) => ({ ...prev, lastError: error }))

      return { ok: false, error }
    }

    socket.send(JSON.stringify({ type: "PLACE_TRADE", input }))

    setState((prev) => ({
      ...prev,

      selectedSymbol: input.symbol,

      lastAction: `Submitted ${input.contractType} trade on ${input.symbol}`,

      lastError: null,
    }))

    return { ok: true, tradeId: `pending-${Date.now()}` }
  }

  const forceCloseTrade = (tradeId: string) => {
    const socket = socketRef.current

    if (
      connectionMode !== "server" ||
      socket?.readyState !== WebSocket.OPEN ||
      !serverAuthReady
    ) {
      const error =
        "Trading server is unavailable; trades cannot be settled locally."

      setState((prev) => ({ ...prev, lastError: error }))

      return { ok: false, error }
    }

    socket.send(JSON.stringify({ type: "FORCE_CLOSE_TRADE", tradeId }))

    setState((prev) => ({
      ...prev,

      lastAction: `Requested close for ${tradeId}`,

      lastError: null,
    }))

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

    if (
      connectionMode !== "server" ||
      socket?.readyState !== WebSocket.OPEN ||
      !serverAuthReady
    ) {
      const error =
        "Balance adjustments require an authenticated trading server."

      setState((prev) => ({ ...prev, lastError: error }))

      return { ok: false, error }
    }

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

  const syncBalanceFromServer = useCallback(
    (balance: number) => {
      if (!Number.isFinite(balance) || balance < 0) return

      const socket = socketRef.current

      if (
        connectionMode === "server" &&
        socket?.readyState === WebSocket.OPEN
      ) {
        setState((prev) => ({ ...prev, balance: round2(balance) }))

        socket.send(JSON.stringify({ type: "REFRESH_BALANCE" }))

        return
      }

      setState((prev) => ({ ...prev, balance: round2(balance) }))
    },

    [connectionMode],
  )

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

  const setTestBinaryAccount = (
    userId: string,

    enabled: boolean,

    initialBalance: number,
  ) => {
    if (!simulationMode || !testBinaryAvailable || role !== "super_admin") {
      return { ok: false, error: "Simulation super-admin access required" }
    }

    const socket = socketRef.current

    if (connectionMode !== "server" || socket?.readyState !== WebSocket.OPEN) {
      return { ok: false, error: "Backend connection required" }
    }

    socket.send(
      JSON.stringify({
        type: "SIM_SET_TEST_ACCOUNT",

        userId,

        enabled,

        initialBalance,
      }),
    )

    setState((prev) => ({
      ...prev,

      lastAction: `Submitted test system assignment for user ${userId}`,

      lastError: null,
    }))

    return { ok: true }
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

        testBinaryAvailable,

        testBinarySystem,

        testBinaryWinRate,

        testBinaryAccounts,

        marketList,

        markets: state.markets,

        selectedMarket,

        selectedSymbol: state.selectedSymbol,

        balance: state.balance,

        demoBalance: state.demoBalance,

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

        syncBalanceFromServer,

        setAdminPolicy,

        setTestBinaryAccount,
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

    demoBalance: readCachedDemoBalance(),

    realizedPnl: 0,

    openTrades: [],

    closedTrades: [],

    selectedSymbol: "VOL-75",

    lastError: null,

    lastAction: "Connecting to trading server",
  }
}

function createMarket(seed: MarketSeed): MarketSnapshot {
  const history = Array.from({ length: 90 }, () => round2(seed.basePrice))

  const price = history[history.length - 1] ?? seed.basePrice

  return {
    ...seed,

    price,

    changePct: round2(((price - seed.basePrice) / seed.basePrice) * 100),

    history,

    lastDigit: lastDigit(price),
  }
}

function lastDigit(price: number) {
  return Number(price.toFixed(2).slice(-1))
}

function round2(value: number) {
  return Math.round(value * 100) / 100
}

import http from "node:http"

import { WebSocketServer, WebSocket } from "ws"

import jwt from "jsonwebtoken"

import fs from "node:fs"

import path from "node:path"

// Load environment variables manually

function loadEnv() {
  try {
    const envPath = path.resolve(".env")

    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf8")

      for (const line of content.split("\n")) {
        const trimmed = line.trim()

        if (!trimmed || trimmed.startsWith("#")) continue

        const index = trimmed.indexOf("=")

        if (index > 0) {
          const key = trimmed.slice(0, index).trim()

          let val = trimmed.slice(index + 1).trim()

          if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
          ) {
            val = val.slice(1, -1)
          }

          if (!process.env[key]) {
            process.env[key] = val
          }
        }
      }
    }
  } catch (e) {
    console.error("Failed to load .env file:", e)
  }
}

loadEnv()

const PORT = Number(process.env.PORT || 8080)

const SIMULATION_MODE = process.env.SIMULATION_MODE === "true"

const MARKET_SEEDS = [
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

const PAYOUTS = {
  "rise-fall": 1.82,

  "even-odd": 1.8,

  "match-differ": 2.15,
}

const STARTING_BALANCE = 25000

const HISTORY_LIMIT = 120

const ROLE_CAPABILITIES = {
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

const adminSimPolicy = {
  forceNextOutcome: null,

  updatedAt: null,

  updatedBy: null,

  lastAppliedAt: null,
}

const state = createInitialState()

const clients = new Set()

const sessions = new WeakMap()

const server = http.createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "Content-Type": "application/json" })

    response.end(JSON.stringify({ ok: true }))

    return
  }

  response.writeHead(200, { "Content-Type": "text/plain" })

  response.end("Binary trading websocket backend is running")
})

const wss = new WebSocketServer({ server })

wss.on("connection", (socket) => {
  clients.add(socket)

  sessions.set(socket, createSession("demo-auth-token"))

  sendAuthState(socket)

  sendPolicyState(socket)

  socket.send(JSON.stringify({ type: "STATE", state }))

  socket.on("message", (raw) => {
    try {
      const message = JSON.parse(raw.toString())

      if (
        message.type === "SELECT_MARKET" &&
        typeof message.symbol === "string"
      ) {
        state.selectedSymbol = message.symbol

        state.lastAction = `Selected ${message.symbol}`

        broadcastState()

        socket.send(
          JSON.stringify({ type: "ACK", ok: true, action: state.lastAction }),
        )

        return
      }

      if (message.type === "AUTH_INIT" && typeof message.token === "string") {
        syncUserSession(socket, message.token).catch((err) => {
          console.error("Auth synchronization failed:", err)
        })

        return
      }

      if (message.type === "PLACE_TRADE" && message.input) {
        const session = sessions.get(socket) || createSession("demo-auth-token")

        const result = placeTrade(state, message.input, session)

        if (result.error) {
          socket.send(
            JSON.stringify({ type: "ACK", ok: false, error: result.error }),
          )

          state.lastError = result.error

          broadcastState()

          return
        }

        state.lastAction = `Opened ${result.trade.contractType} trade on ${result.trade.symbol}`

        broadcastState()

        socket.send(
          JSON.stringify({
            type: "ACK",
            ok: true,
            action: state.lastAction,
            tradeId: result.trade.id,
          }),
        )

        return
      }

      if (
        message.type === "FORCE_CLOSE_TRADE" &&
        typeof message.tradeId === "string"
      ) {
        const session = sessions.get(socket) || createSession("demo-auth-token")

        if (!session.capabilities.canForceClose) {
          socket.send(
            JSON.stringify({
              type: "ACK",
              ok: false,
              error: "Not permitted to force-close trades",
            }),
          )

          return
        }

        const result = forceCloseTrade(state, message.tradeId)

        if (result.error) {
          socket.send(
            JSON.stringify({ type: "ACK", ok: false, error: result.error }),
          )

          state.lastError = result.error

          broadcastState()

          return
        }

        state.lastAction = `Closed ${message.tradeId}`

        broadcastState()

        socket.send(
          JSON.stringify({ type: "ACK", ok: true, action: state.lastAction }),
        )

        return
      }

      if (
        message.type === "ADJUST_BALANCE" &&
        typeof message.amount === "number" &&
        typeof message.reason === "string"
      ) {
        const session = sessions.get(socket) || createSession("demo-auth-token")

        if (!session.capabilities.canAdjustBalance) {
          socket.send(
            JSON.stringify({
              type: "ACK",
              ok: false,
              error: "Not permitted to adjust balances",
            }),
          )

          return
        }

        const result = adjustBalance(state, message.amount, message.reason)

        if (result.error) {
          socket.send(
            JSON.stringify({ type: "ACK", ok: false, error: result.error }),
          )

          state.lastError = result.error

          broadcastState()

          return
        }

        state.lastAction = message.reason

        state.lastError = null

        broadcastState()

        socket.send(
          JSON.stringify({ type: "ACK", ok: true, action: state.lastAction }),
        )

        return
      }

      if (message.type === "SIM_SET_ADMIN_POLICY") {
        const session = sessions.get(socket) || createSession("demo-auth-token")

        if (!SIMULATION_MODE) {
          socket.send(
            JSON.stringify({
              type: "ACK",
              ok: false,
              error: "Simulation mode is disabled",
            }),
          )

          return
        }

        if (!session.capabilities.canViewAdminPanel) {
          socket.send(
            JSON.stringify({
              type: "ACK",
              ok: false,
              error: "Not permitted to set admin simulation policy",
            }),
          )

          return
        }

        const nextOutcome = message.forceNextOutcome

        if (
          nextOutcome !== null &&
          nextOutcome !== "won" &&
          nextOutcome !== "lost"
        ) {
          socket.send(
            JSON.stringify({
              type: "ACK",
              ok: false,
              error: "Invalid forceNextOutcome value",
            }),
          )

          return
        }

        adminSimPolicy.forceNextOutcome = nextOutcome

        adminSimPolicy.updatedAt = Date.now()

        adminSimPolicy.updatedBy = session.role

        broadcastPolicyState()

        socket.send(
          JSON.stringify({
            type: "ACK",
            ok: true,
            action: "Admin simulation policy updated",
          }),
        )
      }
    } catch (error) {
      socket.send(
        JSON.stringify({
          type: "ERROR",
          error: error instanceof Error ? error.message : "Malformed message",
        }),
      )
    }
  })

  socket.on("close", () => {
    clients.delete(socket)
  })
})

setInterval(() => {
  state.markets = advanceMarkets(state.markets)

  settleExpiredTrades()

  broadcastState("Live market tick")
}, 1000)

server.listen(PORT, () => {
  console.log(
    `Binary trading websocket backend listening on ws://localhost:${PORT}`,
  )
})

function createSession(token) {
  const normalized = (token || "").toLowerCase()

  let role = "user"

  if (SIMULATION_MODE && normalized === "sim-super-admin") {
    role = "super_admin"
  } else if (SIMULATION_MODE && normalized === "sim-admin") {
    role = "admin"
  }

  return {
    role,

    capabilities: ROLE_CAPABILITIES[role],
  }
}

async function createSessionAsync(token) {
  const normalized = (token || "").toLowerCase()

  let role = "user"

  let userId = null

  let username = null

  if (SIMULATION_MODE && normalized === "sim-super-admin") {
    role = "super_admin"
  } else if (SIMULATION_MODE && normalized === "sim-admin") {
    role = "admin"
  } else if (token && token !== "demo-auth-token") {
    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "change-me-in-production",
      )

      userId = decoded.id

      username = decoded.username

      role = decoded.role || "user"
    } catch (e) {
      console.warn(
        "[WS AUTH] Invalid JWT token received, defaulting to demo user session",
      )
    }
  }

  return {
    role,

    userId,

    username,

    capabilities: ROLE_CAPABILITIES[role],
  }
}

async function syncUserSession(socket, token) {
  const session = await createSessionAsync(token)

  sessions.set(socket, session)

  sendAuthState(socket)

  sendPolicyState(socket)

  if (session.userId && process.env.SUPABASE_URL) {
    try {
      const walletUrl = `${process.env.SUPABASE_URL}/rest/v1/wallets?user_id=eq.${session.userId}`

      const headers = {
        apikey: process.env.SUPABASE_SECRET_KEY,

        Authorization: `Bearer ${process.env.SUPABASE_SECRET_KEY}`,
      }

      const walletRes = await fetch(walletUrl, { headers })

      if (walletRes.ok) {
        const wallets = await walletRes.json()

        if (wallets && wallets.length > 0) {
          state.balance = wallets[0].current_balance

          console.log(
            `[WS AUTH] Synchronized balance for user ${session.username} to ${state.balance} USD`,
          )
        }
      }
    } catch (e) {
      console.error("[WS AUTH] Failed to fetch user wallet balance:", e)
    }
  }

  socket.send(
    JSON.stringify({
      type: "ACK",
      ok: true,
      action: `Authenticated as ${session.role}`,
    }),
  )

  broadcastState()
}

async function syncBalanceToDb() {
  let activeUserId = null

  for (const client of clients) {
    const session = sessions.get(client)

    if (session && session.userId) {
      activeUserId = session.userId

      break
    }
  }

  if (activeUserId && process.env.SUPABASE_URL) {
    try {
      const walletUrl = `${process.env.SUPABASE_URL}/rest/v1/wallets?user_id=eq.${activeUserId}`

      const headers = {
        apikey: process.env.SUPABASE_SECRET_KEY,

        Authorization: `Bearer ${process.env.SUPABASE_SECRET_KEY}`,

        "Content-Type": "application/json",
      }

      await fetch(walletUrl, {
        method: "PATCH",

        headers,

        body: JSON.stringify({
          current_balance: state.balance,

          last_updated: new Date().toISOString(),

          updated_at: new Date().toISOString(),
        }),
      })
    } catch (e) {
      console.error("[WS AUTH] Failed to sync balance to database:", e)
    }
  }
}

function sendAuthState(socket) {
  const session = sessions.get(socket) || createSession("demo-auth-token")

  socket.send(
    JSON.stringify({
      type: "AUTH_STATE",

      simulationMode: SIMULATION_MODE,

      role: session.role,

      capabilities: session.capabilities,
    }),
  )
}

function sendPolicyState(socket) {
  socket.send(
    JSON.stringify({ type: "SIM_POLICY_STATE", policy: adminSimPolicy }),
  )
}

function broadcastPolicyState() {
  const payload = JSON.stringify({
    type: "SIM_POLICY_STATE",
    policy: adminSimPolicy,
  })

  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload)
    }
  }
}

function createInitialState() {
  return {
    markets: Object.fromEntries(
      MARKET_SEEDS.map((seed) => [seed.symbol, createMarket(seed)]),
    ),

    balance: STARTING_BALANCE,

    realizedPnl: 1471.35,

    openTrades: [],

    closedTrades: [
      sampleTrade(
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

      sampleTrade(
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

      sampleTrade(
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
    ],

    selectedSymbol: "VOL-75",

    lastError: null,

    lastAction: "Backend ready",
  }
}

function createMarket(seed) {
  const history = [seed.basePrice * 0.985]

  for (let index = 1; index < 90; index++) {
    const last = history[index - 1]

    history.push(
      nextPrice(last, seed.volatility, seed.drift, seed.basePrice, index),
    )
  }

  const price = round2(history[history.length - 1] || seed.basePrice)

  return {
    ...seed,

    price,

    history: history.map(round2),

    changePct: round2(((price - seed.basePrice) / seed.basePrice) * 100),

    lastDigit: lastDigit(price),
  }
}

function advanceMarkets(markets) {
  const nextMarkets = {}

  for (const seed of MARKET_SEEDS) {
    const current = markets[seed.symbol] || createMarket(seed)

    const price = nextPrice(
      current.price,
      seed.volatility,
      seed.drift,
      seed.basePrice,
    )

    const history = [...current.history, price].slice(-HISTORY_LIMIT)

    nextMarkets[seed.symbol] = {
      ...current,

      price,

      history,

      changePct: round2(((price - seed.basePrice) / seed.basePrice) * 100),

      lastDigit: lastDigit(price),
    }
  }

  return nextMarkets
}

function settleExpiredTrades() {
  const now = Date.now()

  const remaining = []

  for (const trade of state.openTrades) {
    if (trade.expiryAt > now) {
      remaining.push(trade)

      continue
    }

    const market = state.markets[trade.symbol]

    const settled = resolveTrade(trade, market.price, now)

    state.balance = round2(state.balance + (settled.payout || 0))

    state.realizedPnl = round2(state.realizedPnl + (settled.profit || 0))

    state.closedTrades.unshift(settled)
  }

  state.openTrades = remaining

  state.closedTrades = state.closedTrades.slice(0, 40)
}

function placeTrade(currentState, input, session) {
  const market = currentState.markets[input.symbol]

  if (!market) {
    return { error: "Market is unavailable" }
  }

  const stake = round2(Number(input.stake || 0))

  if (!Number.isFinite(stake) || stake <= 0) {
    return { error: "Stake must be greater than zero" }
  }

  if (stake > currentState.balance) {
    return { error: "Insufficient balance" }
  }

  const expirySeconds = Math.max(
    10,
    Math.round(Number(input.expirySeconds || 30)),
  )

  const trade = {
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

    traderRole: session?.role || "user",

    status: "open",

    createdAt: Date.now(),
  }

  currentState.balance = round2(currentState.balance - stake)

  currentState.openTrades.unshift(trade)

  currentState.selectedSymbol = trade.symbol

  currentState.lastError = null

  return { trade }
}

function forceCloseTrade(currentState, tradeId) {
  const index = currentState.openTrades.findIndex((item) => item.id === tradeId)

  if (index === -1) {
    return { error: "Trade not found" }
  }

  const trade = currentState.openTrades[index]

  const market = currentState.markets[trade.symbol]

  const settled = resolveTrade(trade, market.price, Date.now())

  currentState.balance = round2(currentState.balance + (settled.payout || 0))

  currentState.realizedPnl = round2(
    currentState.realizedPnl + (settled.profit || 0),
  )

  currentState.closedTrades.unshift(settled)

  currentState.openTrades.splice(index, 1)

  return { trade: settled }
}

function adjustBalance(currentState, amount, reason) {
  const delta = round2(Number(amount || 0))

  if (!Number.isFinite(delta) || delta === 0) {
    return { error: "Balance adjustment amount must be non-zero" }
  }

  const nextBalance = round2(currentState.balance + delta)

  if (nextBalance < 0) {
    return { error: "Insufficient balance for adjustment" }
  }

  currentState.balance = nextBalance

  currentState.lastAction = reason

  currentState.lastError = null

  return { ok: true }
}

function resolveTrade(trade, exitPrice, settledAt) {
  const exitDigit = lastDigit(exitPrice)

  const forcedOutcome = consumeForcedOutcomeForTrade(trade)

  const won =
    forcedOutcome === null
      ? isWinningTrade(trade, exitPrice, exitDigit)
      : forcedOutcome === "won"

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

function isWinningTrade(trade, exitPrice, exitDigit) {
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

    default:
      return false
  }
}

function broadcastState(note) {
  if (note) {
    state.lastAction = note
  }

  const payload = JSON.stringify({ type: "STATE", state })

  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload)
    }
  }

  syncBalanceToDb().catch((err) => {
    console.error("[WS AUTH] Error syncing balance to DB:", err)
  })
}

function nextPrice(price, volatility, drift, mean, step = 0) {
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

function lastDigit(price) {
  return Number(price.toFixed(2).slice(-1))
}

function round2(value) {
  return Math.round(value * 100) / 100
}

function sampleTrade(
  id,
  symbol,
  marketName,
  contractType,
  direction,
  stake,
  entryPrice,
  exitPrice,
  entryDigit,
  expirySeconds,
  payoutMultiplier,
  result,
  profit,
  minuteOffset,
) {
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

function consumeForcedOutcomeForTrade(trade) {
  if (!SIMULATION_MODE) {
    return null
  }

  if (trade.traderRole !== "admin") {
    return null
  }

  if (
    adminSimPolicy.forceNextOutcome !== "won" &&
    adminSimPolicy.forceNextOutcome !== "lost"
  ) {
    return null
  }

  const nextOutcome = adminSimPolicy.forceNextOutcome

  adminSimPolicy.forceNextOutcome = null

  adminSimPolicy.lastAppliedAt = Date.now()

  broadcastPolicyState()

  return nextOutcome
}

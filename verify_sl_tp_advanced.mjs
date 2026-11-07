import fs from "node:fs"
import WebSocket from "ws"
import dns from "node:dns"

dns.setDefaultResultOrder("ipv4first")

// Load env
const envContent = fs.readFileSync(".env", "utf8")
let supabaseUrl = ""
let supabaseKey = ""
for (const line of envContent.split("\n")) {
  const trimmed = line.trim()
  if (trimmed.startsWith("SUPABASE_URL=")) {
    supabaseUrl = trimmed.split("=")[1].replace(/^['"]|['"]$/g, "").trim()
  }
  if (trimmed.startsWith("SUPABASE_SECRET_KEY=")) {
    supabaseKey = trimmed.split("=")[1].replace(/^['"]|['"]$/g, "").trim()
  }
}

const AUTH_URL = "http://localhost:8090"
const WS_URL = "ws://localhost:8085"

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`)
    process.exit(1)
  }
  console.log(`✅ ${message}`)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function run() {
  console.log("=== ADVANCED STOP LOSS & TAKE PROFIT SYSTEM VERIFICATION ===")
  const testUsername = `trader_sltp_${Date.now().toString().slice(-5)}`
  const testEmail = `${testUsername}@probinary.test`
  const testPassword = "Password123!"

  // 1. Admin login
  console.log("\n[1/7] Logging in as superadmin...")
  const adminLoginRes = await fetch(`${AUTH_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "superadmin", password: "superadmin123" }),
  })
  const adminLoginData = await adminLoginRes.json()
  assert(adminLoginRes.ok && adminLoginData.token, "Super admin logged in successfully")
  const adminToken = adminLoginData.token

  // 2. Register new test client
  console.log(`\n[2/7] Registering client: ${testUsername}...`)
  const regRes = await fetch(`${AUTH_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: testUsername, email: testEmail, password: testPassword }),
  })
  const regData = await regRes.json()
  assert(regRes.ok && regData.token, "Test client registered successfully")
  const clientToken = regData.token
  const userId = regData.user.id

  // 3. Deposit funds (KES 2,000)
  console.log("\n[3/7] Depositing initial balance of KES 2,000...")
  const depRes = await fetch(`${AUTH_URL}/auth/admin/manual-deposit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      userId: String(userId),
      amount: "2000",
      reference: `DEP-SLTP-${Date.now()}`,
      note: "SL/TP Test Deposit",
    }),
  })
  assert(depRes.ok, "Deposit of KES 2,000 confirmed")

  // 4. Connect WebSocket client
  console.log("\n[4/7] Connecting to WebSocket trading server...")
  const ws = new WebSocket(WS_URL)
  const incomingMessages = []

  await new Promise((resolve, reject) => {
    ws.on("open", resolve)
    ws.on("error", reject)
  })

  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString())
      incomingMessages.push(msg)
    } catch {
      // ignore
    }
  })

  // Authenticate socket session
  ws.send(JSON.stringify({ type: "AUTH_INIT", token: clientToken }))

  // Wait for initial state with balance of 2000
  let stateMsg = null
  for (let i = 0; i < 20; i++) {
    stateMsg = incomingMessages.find((m) => m.type === "STATE" && m.state && m.state.balance === 2000)
    if (stateMsg) break
    await sleep(100)
  }
  assert(stateMsg, `WebSocket session authenticated with balance of KES 2,000 (actual: ${stateMsg?.state?.balance})`)

  // 5. Test Manual Stop Trade with SL/TP configured
  console.log("\n[5/7] Testing Manual STOP_TRADE with configured SL/TP...")
  incomingMessages.length = 0

  ws.send(
    JSON.stringify({
      type: "PLACE_TRADE",
      input: {
        symbol: "VOL-75",
        contractType: "rise-fall",
        direction: "rise",
        stake: 50,
        expirySeconds: 120,
        stopLoss: 50,
        takeProfit: 100,
        stopLossEnabled: true,
        takeProfitEnabled: true,
        isDemo: false,
      },
    }),
  )

  let ackOpen = null
  for (let i = 0; i < 20; i++) {
    ackOpen = incomingMessages.find((m) => m.type === "ACK" && m.ok && m.trade)
    if (ackOpen) break
    await sleep(100)
  }
  assert(ackOpen && ackOpen.trade, "Trade opened with SL/TP")
  assert(ackOpen.trade.stopLoss === 50, "Trade has stopLoss: 50")
  assert(ackOpen.trade.takeProfit === 100, "Trade has takeProfit: 100")
  const tradeId = ackOpen.trade.id
  console.log(`Active trade ID: ${tradeId}, Entry Price: ${ackOpen.trade.entryPrice}`)

  // Execute manual STOP_TRADE
  ws.send(
    JSON.stringify({
      type: "STOP_TRADE",
      tradeId,
    }),
  )

  let ackStop = null
  for (let i = 0; i < 25; i++) {
    ackStop = incomingMessages.find(
      (m) =>
        (m.type === "ACK" && m.trade && m.trade.id === tradeId && m.trade.status !== "open") ||
        (m.type === "TRADE_SETTLED" && m.trade && m.trade.id === tradeId),
    )
    if (ackStop) break
    await sleep(100)
  }
  if (!ackStop) {
    console.error("Messages received while waiting for STOP_TRADE:", JSON.stringify(incomingMessages, null, 2))
  }
  assert(ackStop && ackStop.trade, "STOP_TRADE settled trade immediately")
  assert(
    ackStop.trade.closureReason === "Manual Stop" || ackStop.trade.closedBy === "user_stop",
    `Trade closure reason verified: ${ackStop.trade.closureReason} (${ackStop.trade.closedBy})`,
  )
  console.log(`Trade settled: result=${ackStop.trade.result}, P&L=${ackStop.trade.profit}, payout=${ackStop.trade.payout}`)

  // 6. Test CLOSE_ALL_TRADES / Force Stop All
  console.log("\n[6/8] Testing CLOSE_ALL_TRADES with multiple simultaneous active trades...")
  incomingMessages.length = 0

  ws.send(
    JSON.stringify({
      type: "PLACE_TRADE",
      input: {
        symbol: "VOL-100",
        contractType: "rise-fall",
        direction: "rise",
        stake: 25,
        expirySeconds: 120,
        stopLoss: 100,
        takeProfit: 200,
        stopLossEnabled: true,
        takeProfitEnabled: true,
        isDemo: false,
      },
    }),
  )

  await sleep(150)

  ws.send(
    JSON.stringify({
      type: "PLACE_TRADE",
      input: {
        symbol: "BOOM-500",
        contractType: "rise-fall",
        direction: "fall",
        stake: 25,
        expirySeconds: 120,
        stopLoss: 100,
        takeProfit: 200,
        stopLossEnabled: true,
        takeProfitEnabled: true,
        isDemo: false,
      },
    }),
  )

  let openCount = 0
  for (let i = 0; i < 25; i++) {
    openCount = incomingMessages.filter(
      (m) => m.type === "ACK" && m.ok && m.trade && m.trade.id !== tradeId,
    ).length
    if (openCount >= 2) break
    await sleep(100)
  }
  assert(openCount >= 2, "Both simultaneous trades opened")

  incomingMessages.length = 0
  ws.send(JSON.stringify({ type: "CLOSE_ALL_TRADES" }))

  let ackCloseAll = null
  for (let i = 0; i < 25; i++) {
    ackCloseAll = incomingMessages.find((m) => m.type === "ACK" && m.ok && Array.isArray(m.trades))
    if (ackCloseAll) break
    await sleep(100)
  }
  assert(ackCloseAll && ackCloseAll.trades.length >= 2, `Force closed ${ackCloseAll?.trades?.length} trades cleanly`)
  console.log(`Force closed all ${ackCloseAll.trades.length} active trades via CLOSE_ALL_TRADES`)

  // 7. Test Automatic Server-Side SL/TP Execution
  console.log("\n[7/8] Testing Automatic Stop Loss / Take Profit execution on market ticks...")
  incomingMessages.length = 0

  ws.send(
    JSON.stringify({
      type: "PLACE_TRADE",
      input: {
        symbol: "VOL-75",
        contractType: "rise-fall",
        direction: "rise",
        stake: 20,
        expirySeconds: 120,
        stopLoss: 0.5,
        takeProfit: 0.5,
        stopLossEnabled: true,
        takeProfitEnabled: true,
        isDemo: false,
      },
    }),
  )

  let autoTradeAck = null
  for (let i = 0; i < 20; i++) {
    autoTradeAck = incomingMessages.find((m) => m.type === "ACK" && m.ok && m.trade)
    if (autoTradeAck) break
    await sleep(100)
  }
  assert(autoTradeAck && autoTradeAck.trade, "Auto SL/TP test trade placed")
  const autoTradeId = autoTradeAck.trade.id
  console.log(`Placed auto SL/TP trade ${autoTradeId} with ±$0.50 threshold`)

  // Wait for market tick loop to trigger automatic closure
  let autoClosedTrade = null
  for (let i = 0; i < 40; i++) {
    await sleep(300)
    for (const msg of incomingMessages) {
      if (msg.type === "STATE" && msg.state?.closedTrades) {
        const found = msg.state.closedTrades.find((t) => t.id === autoTradeId)
        if (found && (found.closedBy === "stop_loss" || found.closedBy === "take_profit")) {
          autoClosedTrade = found
          break
        }
      }
    }
    if (autoClosedTrade) break
  }
  assert(
    autoClosedTrade,
    `Automatic SL/TP executed by server: ${autoClosedTrade?.closureReason} (${autoClosedTrade?.closedBy}) with profit: ${autoClosedTrade?.profit}`,
  )
  console.log(
    `✅ Automatic closure verified: closed by "${autoClosedTrade.closedBy}" with reason "${autoClosedTrade.closureReason}", P&L: ${autoClosedTrade.profit}`,
  )

  // 8. Verify Database Persistence in Supabase
  console.log("\n[8/8] Verifying database schema & column persistence in Supabase...")
  await sleep(1500)
  const tradesRes = await fetch(`${AUTH_URL}/auth/trading/trades`, {
    headers: { Authorization: `Bearer ${clientToken}` },
  })
  assert(tradesRes.ok, "Successfully queried /auth/trading/trades")
  const tradesData = await tradesRes.json()
  assert(tradesData.ok, "Response ok: true")
  assert(
    tradesData.trades && tradesData.trades.length >= 3,
    `Found ${tradesData.trades.length} persisted trade records in Supabase`,
  )

  const stoppedRow = tradesData.trades.find((r) => r.trade_id === tradeId)
  assert(stoppedRow, "Stopped trade record found in database")
  assert(Number(stoppedRow.stop_loss) === 50, `DB persisted stop_loss: ${stoppedRow.stop_loss}`)
  assert(Number(stoppedRow.take_profit) === 100, `DB persisted take_profit: ${stoppedRow.take_profit}`)
  assert(
    stoppedRow.closure_reason === "Manual Stop" ||
      stoppedRow.closed_by === "user_stop" ||
      stoppedRow.closed_by === "manual",
    `DB persisted closure_reason: ${stoppedRow.closure_reason}, closed_by: ${stoppedRow.closed_by}`,
  )

  console.log("\nSample Persisted Database Record:")
  console.log(JSON.stringify(stoppedRow, null, 2))

  ws.close()
  console.log("\n🎉 ALL ADVANCED STOP LOSS & TAKE PROFIT SCENARIOS PASSED!")
}

run().catch((err) => {
  console.error("Test execution failed:", err)
  process.exit(1)
})

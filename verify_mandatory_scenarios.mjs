import fs from "node:fs"
import WebSocket from "ws"

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

async function run() {
  console.log("=== MANDATORY TEST SUITE: TRADING BALANCE PERSISTENCE ===")
  const testUsername = `trader_kes_${Date.now().toString().slice(-5)}`
  const testEmail = `${testUsername}@probinary.test`
  const testPassword = "Password123!"

  // 1. Admin login to have admin credentials
  console.log("\n[Setup] Logging in as super_admin...")
  const adminLoginRes = await fetch(`${AUTH_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "superadmin", password: "superadmin123" }),
  })
  const adminLoginData = await adminLoginRes.json()
  assert(adminLoginRes.ok && adminLoginData.token, "Super admin logged in successfully")
  const adminToken = adminLoginData.token

  // 2. Register new test client
  console.log(`\n[Setup] Registering client: ${testUsername}...`)
  const regRes = await fetch(`${AUTH_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: testUsername,
      email: testEmail,
      password: testPassword,
    }),
  })
  const regData = await regRes.json()
  assert(regRes.ok && regData.token, "Client registered successfully")
  let clientToken = regData.token
  const userId = regData.user.id

  // SCENARIO 1: Client deposits KES 1,000. Balance displays KES 1,000.
  console.log("\n--- SCENARIO 1: Client deposits KES 1,000 ---")
  const depRes = await fetch(`${AUTH_URL}/auth/admin/manual-deposit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      userId: String(userId),
      amount: "1000",
      reference: `TILL-KES-${Date.now()}`,
      note: "Customer payment at M-Pesa Till 445566 (KES 1,000)",
    }),
  })
  const depData = await depRes.json()
  assert(depRes.ok, "Deposit of KES 1,000 accepted")
  assert(depData.currentBalance === 1000, `Balance displays KES 1,000 (actual: ${depData.currentBalance})`)

  // Verify DB wallet
  const w1Res = await fetch(`${supabaseUrl}/rest/v1/wallets?user_id=eq.${userId}`, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
  })
  const w1 = await w1Res.json()
  assert(Number(w1[0]?.current_balance) === 1000, `Database wallet has KES 1,000 (actual: ${w1[0]?.current_balance})`)

  // SCENARIO 2: Client wins a trade worth KES 200 profit. Balance updates to KES 1,200.
  console.log("\n--- SCENARIO 2: Client wins trade with KES 200 profit ---")
  const tradeWinId = `TRD-WIN-${Date.now()}`
  const tradeWinPayload = {
    id: tradeWinId,
    symbol: "VOL-75",
    marketName: "Volatility 75 Index",
    contractType: "rise-fall",
    direction: "rise",
    stake: 200,
    entryPrice: 8200.5,
    entryDigit: 5,
    expirySeconds: 30,
    payoutMultiplier: 2.0,
    status: "won",
    result: "won",
    exitPrice: 8245.8,
    exitDigit: 8,
    payout: 400,
    profit: 200,
    isDemo: false,
    createdAt: Date.now() - 30000,
    settledAt: Date.now(),
  }

  const winRes = await fetch(`${AUTH_URL}/auth/trading/record-trade`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${clientToken}`,
    },
    body: JSON.stringify(tradeWinPayload),
  })
  const winData = await winRes.json()
  assert(winRes.ok, "Trade recorded successfully")
  assert(winData.currentBalance === 1200, `Balance updates to KES 1,200 (actual: ${winData.currentBalance})`)

  // Verify DB wallet
  const w2Res = await fetch(`${supabaseUrl}/rest/v1/wallets?user_id=eq.${userId}`, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
  })
  const w2 = await w2Res.json()
  assert(Number(w2[0]?.current_balance) === 1200, `Database wallet permanently updated to KES 1,200 (actual: ${w2[0]?.current_balance})`)

  // SCENARIO 3: Client refreshes the website. Balance must remain KES 1,200.
  console.log("\n--- SCENARIO 3: Client refreshes website (page reload) ---")
  const refresh1Res = await fetch(`${AUTH_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${clientToken}` },
  })
  const refresh1Data = await refresh1Res.json()
  assert(refresh1Res.ok, "GET /auth/me succeeded on refresh")
  assert(refresh1Data.current_balance === 1200, `Balance on refresh remains KES 1,200 (actual: ${refresh1Data.current_balance})`)

  // Verify WebSocket receives KES 1,200 on connect
  const wsBalance1 = await new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL)
    const timeout = setTimeout(() => { ws.close(); reject(new Error("WS timeout")) }, 4000)
    ws.on("open", () => {
      ws.send(JSON.stringify({ type: "AUTH_INIT", token: clientToken }))
    })
    ws.on("message", (raw) => {
      const msg = JSON.parse(raw.toString())
      if (msg.type === "STATE" && msg.state && msg.state.balance === 1200) {
        clearTimeout(timeout)
        ws.close()
        resolve(msg.state.balance)
      }
    })
    ws.on("error", (err) => { clearTimeout(timeout); reject(err) })
  })
  assert(wsBalance1 === 1200, `WebSocket backend state on refresh is KES 1,200 (actual: ${wsBalance1})`)

  // SCENARIO 4: Client loses KES 300. Balance updates to KES 900.
  console.log("\n--- SCENARIO 4: Client loses trade worth KES 300 ---")
  const tradeLossId = `TRD-LOSS-${Date.now()}`
  const tradeLossPayload = {
    id: tradeLossId,
    symbol: "VOL-25",
    marketName: "Volatility 25 Index",
    contractType: "rise-fall",
    direction: "fall",
    stake: 300,
    entryPrice: 5200.0,
    entryDigit: 0,
    expirySeconds: 30,
    payoutMultiplier: 1.82,
    status: "lost",
    result: "lost",
    exitPrice: 5250.0,
    exitDigit: 0,
    payout: 0,
    profit: -300,
    isDemo: false,
    createdAt: Date.now() - 30000,
    settledAt: Date.now(),
  }

  const lossRes = await fetch(`${AUTH_URL}/auth/trading/record-trade`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${clientToken}`,
    },
    body: JSON.stringify(tradeLossPayload),
  })
  const lossData = await lossRes.json()
  assert(lossRes.ok, "Loss trade recorded successfully")
  assert(lossData.currentBalance === 900, `Balance updates to KES 900 (actual: ${lossData.currentBalance})`)

  // Verify DB wallet
  const w3Res = await fetch(`${supabaseUrl}/rest/v1/wallets?user_id=eq.${userId}`, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
  })
  const w3 = await w3Res.json()
  assert(Number(w3[0]?.current_balance) === 900, `Database wallet permanently updated to KES 900 (actual: ${w3[0]?.current_balance})`)

  // SCENARIO 5: Client refreshes again. Balance must remain KES 900.
  console.log("\n--- SCENARIO 5: Client refreshes website again ---")
  const refresh2Res = await fetch(`${AUTH_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${clientToken}` },
  })
  const refresh2Data = await refresh2Res.json()
  assert(refresh2Res.ok, "GET /auth/me succeeded on second refresh")
  assert(refresh2Data.current_balance === 900, `Balance remains KES 900 after second refresh (actual: ${refresh2Data.current_balance})`)

  // SCENARIO 6: Client logs out and logs back in. Balance must still be KES 900.
  console.log("\n--- SCENARIO 6: Client logs out and logs back in ---")
  const loginAgainRes = await fetch(`${AUTH_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: testUsername, password: testPassword }),
  })
  const loginAgainData = await loginAgainRes.json()
  assert(loginAgainRes.ok, "Client re-login succeeded")
  assert(loginAgainData.user.current_balance === 900, `Balance on login is KES 900 (actual: ${loginAgainData.user.current_balance})`)

  clientToken = loginAgainData.token
  const meAfterLoginRes = await fetch(`${AUTH_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${clientToken}` },
  })
  const meAfterLoginData = await meAfterLoginRes.json()
  assert(meAfterLoginData.current_balance === 900, `GET /auth/me after fresh login is KES 900 (actual: ${meAfterLoginData.current_balance})`)

  // SCENARIO 7: Admin manually adds KES 500. Balance becomes KES 1,400 and remains correct after refreshing.
  console.log("\n--- SCENARIO 7: Admin manually adds KES 500 ---")
  const adminAddRes = await fetch(`${AUTH_URL}/auth/admin/manual-deposit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      userId: String(userId),
      amount: "500",
      reference: `TILL-KES-${Date.now()}`,
      note: "Customer payment at M-Pesa Till 445566 (KES 500)",
    }),
  })
  const adminAddData = await adminAddRes.json()
  assert(adminAddRes.ok, "Admin adjustment of KES 500 accepted")
  assert(adminAddData.currentBalance === 1400, `Balance becomes KES 1,400 (actual: ${adminAddData.currentBalance})`)

  // Client refreshes after admin adjustment
  const refresh3Res = await fetch(`${AUTH_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${clientToken}` },
  })
  const refresh3Data = await refresh3Res.json()
  assert(refresh3Data.current_balance === 1400, `Balance remains KES 1,400 after page refresh (actual: ${refresh3Data.current_balance})`)

  // Verify trade history retrieval from DB
  console.log("\n--- Trade History Persistence Check ---")
  const tradesRes = await fetch(`${AUTH_URL}/auth/trading/trades`, {
    headers: { Authorization: `Bearer ${clientToken}` },
  })
  const tradesData = await tradesRes.json()
  assert(tradesRes.ok, "GET /auth/trading/trades succeeded")
  assert(tradesData.trades && tradesData.trades.length >= 2, `User trade history restored from DB (${tradesData.trades.length} trades found)`)
  const winFound = tradesData.trades.find((t) => t.trade_id === tradeWinId)
  const lossFound = tradesData.trades.find((t) => t.trade_id === tradeLossId)
  assert(winFound && winFound.result === "won", "Win trade record verified in binary_trade_records")
  assert(lossFound && lossFound.result === "lost", "Loss trade record verified in binary_trade_records")

  console.log("\n🎉 ALL 7 MANDATORY SCENARIOS PASSED WITH 100% SUCCESS!")
}

run().catch((err) => {
  console.error("Test execution failed:", err)
  process.exit(1)
})

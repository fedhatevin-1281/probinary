import fs from "node:fs"
import WebSocket from "ws"

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
  console.log("=== WEBSOCKET TRADE SETTLEMENT & PERSISTENCE TEST ===")
  const testUsername = `trader_ws_${Date.now().toString().slice(-5)}`
  const testEmail = `${testUsername}@probinary.test`
  const testPassword = "Password123!"

  // 1. Admin login
  const adminLoginRes = await fetch(`${AUTH_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "superadmin", password: "superadmin123" }),
  })
  const adminLoginData = await adminLoginRes.json()
  const adminToken = adminLoginData.token

  // 2. Register new test client
  const regRes = await fetch(`${AUTH_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: testUsername, email: testEmail, password: testPassword }),
  })
  const regData = await regRes.json()
  const clientToken = regData.token
  const userId = regData.user.id

  // 3. Deposit KES 1,000
  const depRes = await fetch(`${AUTH_URL}/auth/admin/manual-deposit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      userId: String(userId),
      amount: "1000",
      reference: `DEP-WS-${Date.now()}`,
      note: "WS Test Initial Deposit",
    }),
  })
  assert(depRes.ok, "Initial deposit of KES 1,000 credited")

  // 4. Connect WebSocket as client
  console.log("\n[WebSocket] Connecting client socket...")
  const ws = new WebSocket(WS_URL)

  await new Promise((resolve, reject) => {
    ws.on("open", resolve)
    ws.on("error", reject)
  })

  // Send AUTH_INIT
  ws.send(JSON.stringify({ type: "AUTH_INIT", token: clientToken }))

  // Wait for initial balance confirmation
  const initialBal = await new Promise((resolve) => {
    ws.on("message", (raw) => {
      const msg = JSON.parse(raw.toString())
      if (msg.type === "STATE" && msg.state && msg.state.balance === 1000) {
        resolve(msg.state.balance)
      }
    })
  })
  assert(initialBal === 1000, `WS client connected and confirmed initial balance of ${initialBal}`)

  // 5. Place trade via WebSocket
  console.log("\n[WebSocket] Placing trade: Stake 100 on VOL-10...")
  ws.send(JSON.stringify({
    type: "PLACE_TRADE",
    input: {
      symbol: "VOL-10",
      contractType: "rise-fall",
      direction: "rise",
      stake: 100,
      expirySeconds: 10,
      isDemo: false,
    },
  }))

  // Wait for trade to open and stake to be deducted
  const openTrade = await new Promise((resolve) => {
    const handler = (raw) => {
      const msg = JSON.parse(raw.toString())
      if (msg.type === "STATE" && msg.state && msg.state.openTrades && msg.state.openTrades.length > 0) {
        ws.off("message", handler)
        resolve(msg.state.openTrades[0])
      }
    }
    ws.on("message", handler)
  })
  assert(openTrade && openTrade.id, `Trade opened with ID: ${openTrade.id}`)

  // Verify stake was deducted from DB
  const wPostOpenRes = await fetch(`${supabaseUrl}/rest/v1/wallets?user_id=eq.${userId}`, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
  })
  const wPostOpen = await wPostOpenRes.json()
  assert(Number(wPostOpen[0]?.current_balance) === 900, `DB wallet balance immediately reflects stake deduction: KES 900 (actual: ${wPostOpen[0]?.current_balance})`)

  // 6. Force-close or wait for trade settlement
  console.log("\n[WebSocket] Force closing trade as admin/system to test settlement...")
  // Connect admin socket to force close
  const adminWs = new WebSocket(WS_URL)
  await new Promise((r) => adminWs.on("open", r))
  adminWs.send(JSON.stringify({ type: "AUTH_INIT", token: adminToken }))

  // Wait 1 second for auth
  await new Promise((r) => setTimeout(r, 1000))
  adminWs.send(JSON.stringify({ type: "FORCE_CLOSE_TRADE", tradeId: openTrade.id }))

  // Wait for settlement message on client ws
  const settledTrade = await new Promise((resolve) => {
    const handler = (raw) => {
      const msg = JSON.parse(raw.toString())
      if (msg.type === "STATE" && msg.state && msg.state.closedTrades && msg.state.closedTrades.some((t) => t.id === openTrade.id)) {
        ws.off("message", handler)
        resolve(msg.state.closedTrades.find((t) => t.id === openTrade.id))
      }
    }
    ws.on("message", handler)
  })
  assert(settledTrade && (settledTrade.result === "won" || settledTrade.result === "lost"), `Trade settled via WebSocket with result: ${settledTrade.result} (profit: ${settledTrade.profit})`)

  ws.close()
  adminWs.close()

  // Wait 500ms for DB write
  await new Promise((r) => setTimeout(r, 800))

  // 7. Verify database wallet has settled balance
  const wPostSettleRes = await fetch(`${supabaseUrl}/rest/v1/wallets?user_id=eq.${userId}`, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
  })
  const wPostSettle = await wPostSettleRes.json()
  const expectedDbBal = settledTrade.result === "won" ? Math.round((900 + settledTrade.payout) * 100) / 100 : 900
  assert(Number(wPostSettle[0]?.current_balance) === expectedDbBal, `DB wallet has expected settled balance: KES ${expectedDbBal} (actual: ${wPostSettle[0]?.current_balance})`)

  // 8. SIMULATE PAGE REFRESH (GET /auth/me)
  console.log("\n[Refresh] Simulating page refresh...")
  const refreshRes = await fetch(`${AUTH_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${clientToken}` },
  })
  const refreshData = await refreshRes.json()
  assert(refreshData.current_balance === expectedDbBal, `Page refresh retains settled balance: KES ${expectedDbBal} (actual: ${refreshData.current_balance})`)

  console.log("\n🎉 LIVE WEBSOCKET TRADE SETTLEMENT AND PERSISTENCE VERIFIED SUCCESSFULLY!")
}

run().catch((err) => {
  console.error("WS Test failed:", err)
  process.exit(1)
})

import { spawn } from "node:child_process"
import net from "node:net"

function waitForPort(port, timeoutMs = 8000) {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    function tryConnect() {
      const socket = net.createConnection({ port, host: "127.0.0.1" }, () => {
        socket.end()
        resolve(true)
      })
      socket.on("error", () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Timeout waiting for port ${port}`))
        } else {
          setTimeout(tryConnect, 200)
        }
      })
    }
    tryConnect()
  })
}

function runScript(scriptPath) {
  return new Promise((resolve, reject) => {
    const child = spawn("node", [scriptPath], { stdio: "inherit" })
    child.on("close", (code) => {
      if (code === 0) resolve()
      else reject(new Error(`Script ${scriptPath} exited with code ${code}`))
    })
    child.on("error", reject)
  })
}

async function main() {
  console.log("=== STARTING LOCAL SERVERS FOR TEST HARNESS ===")
  const authProc = spawn("node", ["authServer.js"], { stdio: "inherit" })
  const wsProc = spawn("node", ["server.js"], { stdio: "inherit" })

  try {
    console.log("Waiting for Auth server (port 8090)...")
    await waitForPort(8090)
    console.log("✅ Auth server ready on 8090")

    console.log("Waiting for WebSocket server (port 8085)...")
    await waitForPort(8085)
    console.log("✅ WebSocket server ready on 8085")

    console.log("\n==========================================")
    console.log("TEST 1: MANDATORY SCENARIOS SUITE")
    console.log("==========================================")
    await runScript("verify_mandatory_scenarios.mjs")

    console.log("\n==========================================")
    console.log("TEST 2: ADVANCED SL/TP & TRADE MANAGEMENT")
    console.log("==========================================")
    await runScript("verify_sl_tp_advanced.mjs")

    console.log("\n🎉 ALL TEST SUITES PASSED SUCCESSFULLY!")
  } catch (err) {
    console.error("Test execution failed:", err)
    process.exitCode = 1
  } finally {
    console.log("\nTearing down test servers...")
    authProc.kill()
    wsProc.kill()
  }
}

main()


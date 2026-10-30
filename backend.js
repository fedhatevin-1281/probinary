import { fork } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

console.log("[BACKEND] Launching ProBinary Backend Services...")

function startService(scriptName, name, port) {
  const scriptPath = path.resolve(__dirname, scriptName)
  const child = fork(scriptPath, [], {
    stdio: "inherit",
    env: { ...process.env },
  })

  child.on("error", (err) => {
    console.error(`[${name}] Failed to start:`, err)
  })

  child.on("exit", (code, signal) => {
    if (signal !== "SIGTERM" && signal !== "SIGINT") {
      console.warn(`[${name}] Exited with code ${code}. Restarting in 2s...`)
      setTimeout(() => startService(scriptName, name, port), 2000)
    }
  })

  return child
}

const authProcess = startService("authServer.js", "AUTH", 8090)
const tradingProcess = startService("server.js", "TRADING", 8085)

function cleanup() {
  console.log("\n[BACKEND] Stopping all backend services...")
  try {
    authProcess.kill("SIGTERM")
    tradingProcess.kill("SIGTERM")
  } catch (e) {
    // Ignore shutdown errors
  }
  process.exit(0)
}

process.on("SIGINT", cleanup)
process.on("SIGTERM", cleanup)

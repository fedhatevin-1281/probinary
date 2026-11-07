import { useEffect, useRef } from "react"
import type { BinaryTrade } from "../state/trading"

interface TradeResultModalProps {
  trade: BinaryTrade | null
  onClose: () => void
  onViewHistory: () => void
}

interface ConfettiParticle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  rotation: number
  rotationSpeed: number
  opacity: number
}

function ConfettiCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let animationFrameId: number
    const particles: ConfettiParticle[] = []
    const colors = [
      "#10B981", // Emerald
      "#34D399", // Light Emerald
      "#F59E0B", // Amber / Gold
      "#FBBF24", // Yellow
      "#8B5CF6", // Purple
      "#A855F7", // Fuchsia
      "#06B6D4", // Cyan
      "#EC4899", // Pink
    ]

    const width = (canvas.width = window.innerWidth)
    const height = (canvas.height = window.innerHeight)

    // Create 110 celebratory confetti particles bursting from center-top
    for (let i = 0; i < 110; i++) {
      const angle = Math.PI / 4 + Math.random() * (Math.PI / 2) // upward cone
      const speed = 4 + Math.random() * 11
      particles.push({
        x: width / 2 + (Math.random() - 0.5) * 120,
        y: height / 3 + (Math.random() - 0.5) * 60,
        vx: Math.cos(angle) * speed * (Math.random() < 0.5 ? 1 : -1),
        vy: -Math.sin(angle) * speed,
        size: 5 + Math.random() * 7,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.25,
        opacity: 1,
      })
    }

    let startTime = performance.now()

    function render(currentTime: number) {
      if (!ctx || !canvas) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const elapsed = currentTime - startTime
      const isDying = elapsed > 2500

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.24 // gravity
        p.vx *= 0.985 // drag
        p.rotation += p.rotationSpeed

        if (isDying) {
          p.opacity -= 0.02
        }

        if (p.opacity <= 0 || p.y > height + 20) {
          particles.splice(i, 1)
          continue
        }

        ctx.save()
        ctx.globalAlpha = Math.max(0, p.opacity)
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rotation)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6)
        ctx.restore()
      }

      if (particles.length > 0 && elapsed < 4000) {
        animationFrameId = requestAnimationFrame(render)
      }
    }

    animationFrameId = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(animationFrameId)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-[120] h-full w-full"
      style={{ pointerEvents: "none" }}
    />
  )
}

export default function TradeResultModal({
  trade,
  onClose,
  onViewHistory,
}: TradeResultModalProps) {
  if (!trade) return null

  const isWin = trade.result === "won" || (trade.profit !== undefined && trade.profit > 0)
  const isBreakEven = trade.result === "break_even" || (trade.profit === 0)
  const isLoss = !isWin && !isBreakEven

  const pnl = trade.profit ?? 0
  const stake = trade.stake
  const entryPrice = trade.entryPrice
  const exitPrice = trade.exitPrice ?? trade.currentPrice ?? entryPrice
  const payout = trade.payout ?? (isWin ? stake + pnl : isBreakEven ? stake : 0)
  const closureReason = trade.closureReason || (isWin ? "Take Profit" : isLoss ? "Stop Loss" : "Manual Stop")
  const directionUpper = String(trade.direction || "RISE").toUpperCase()
  const isBuy = directionUpper === "RISE" || directionUpper === "BUY" || directionUpper === "HIGHER"

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      {/* Background Dim Backdrop */}
      <div
        className="fixed inset-0 bg-black/85 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Confetti Animation for Winning Trades */}
      {isWin && <ConfettiCanvas />}

      {/* Modal Dialog Card */}
      <div
        className={`relative z-[125] w-full max-w-md overflow-hidden rounded-3xl border p-6 text-white shadow-2xl transition-all duration-300 font-sans ${
          isWin
            ? "border-emerald-500/40 bg-gradient-to-b from-[#142322] via-[#0D181A] to-[#080D11] shadow-emerald-950/60"
            : isLoss
              ? "border-rose-500/40 bg-gradient-to-b from-[#25101A] via-[#1A0B13] to-[#0E060A] shadow-rose-950/60"
              : "border-amber-500/35 bg-gradient-to-b from-[#1E1912] via-[#14100D] to-[#0A0807] shadow-amber-950/60"
        }`}
      >
        {/* Glow Halo behind header */}
        <div
          className={`pointer-events-none absolute -top-20 left-1/2 h-44 w-64 -translate-x-1/2 rounded-full blur-3xl opacity-35 ${
            isWin ? "bg-emerald-500" : isLoss ? "bg-rose-500" : "bg-amber-500"
          }`}
        />

        {/* Top Status Icon & Badge */}
        <div className="relative mb-3 flex flex-col items-center text-center">
          <div
            className={`mb-3 flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg border ${
              isWin
                ? "border-emerald-400/40 bg-emerald-500/20 text-emerald-400 shadow-emerald-500/20"
                : isLoss
                  ? "border-rose-400/40 bg-rose-500/20 text-rose-400 shadow-rose-500/20"
                  : "border-amber-400/40 bg-amber-500/20 text-amber-400 shadow-amber-500/20"
            }`}
          >
            {isWin ? (
              <span className="text-3xl">🎉</span>
            ) : isLoss ? (
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <span className="text-2xl">⚖️</span>
            )}
          </div>

          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-mono font-bold tracking-wider uppercase border ${
              isWin
                ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-300"
                : isLoss
                  ? "border-rose-400/40 bg-rose-500/15 text-rose-300"
                  : "border-amber-400/40 bg-amber-500/15 text-amber-300"
            }`}
          >
            Trade Result: {isWin ? "WIN" : isLoss ? "LOSS" : "BREAK EVEN"}
          </span>

          <h2 className="mt-2.5 text-xl font-black font-display tracking-tight text-white">
            {isWin
              ? "Congratulations! 🎉"
              : isLoss
                ? "Trade Closed"
                : "Position Closed"}
          </h2>
          <p className="mt-0.5 text-xs text-zinc-400">
            {isWin
              ? "You closed this trade successfully."
              : isLoss
                ? "The trade reached your risk threshold."
                : "Trade closed with neutral return."}
          </p>

          {/* Large P&L Amount */}
          <div
            className={`mt-4 font-mono text-4xl font-extrabold tracking-tight ${
              isWin
                ? "text-emerald-400 drop-shadow-[0_2px_12px_rgba(16,185,129,0.35)]"
                : isLoss
                  ? "text-rose-400 drop-shadow-[0_2px_12px_rgba(244,63,94,0.35)]"
                  : "text-amber-300"
            }`}
          >
            {isWin ? `+$${pnl.toFixed(2)}` : isLoss ? `-$${Math.abs(pnl).toFixed(2)}` : "$0.00"}
          </div>
        </div>

        {/* Detailed Stats Grid */}
        <div className="relative my-4 space-y-2 rounded-2xl border border-white/10 bg-black/40 p-4 font-mono text-xs backdrop-blur-sm">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <span className="text-zinc-400">Asset / Pair</span>
            <span className="font-bold text-white flex items-center gap-1.5">
              <span>{trade.symbol}</span>
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                  isBuy ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                }`}
              >
                {isBuy ? "BUY" : "SELL"}
              </span>
            </span>
          </div>

          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <span className="text-zinc-400">Original Stake</span>
            <span className="font-bold text-white">${stake.toFixed(2)}</span>
          </div>

          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <span className="text-zinc-400">Entry Price</span>
            <span className="text-zinc-300">{entryPrice.toFixed(2)}</span>
          </div>

          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <span className="text-zinc-400">Exit Price</span>
            <span className="font-bold text-white">{exitPrice.toFixed(2)}</span>
          </div>

          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <span className="text-zinc-400">Total Returned</span>
            <span className={`font-bold ${isWin ? "text-emerald-400" : "text-zinc-200"}`}>
              ${payout.toFixed(2)}
            </span>
          </div>

          <div className="flex items-center justify-between pt-0.5">
            <span className="text-zinc-400">Closed By</span>
            <span className="font-bold text-purple-300 bg-purple-900/30 px-2 py-0.5 rounded border border-purple-500/25">
              {closureReason}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="relative mt-5 flex flex-col gap-2.5">
          <button
            onClick={onClose}
            className={`w-full py-3 px-4 rounded-xl font-display font-bold text-sm text-white shadow-lg transition-all active:scale-98 flex items-center justify-center gap-2 ${
              isWin
                ? "bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 shadow-emerald-950/50"
                : isLoss
                  ? "bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 shadow-rose-950/50"
                  : "bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 shadow-amber-950/50"
            }`}
          >
            <span>Close & Trade Again</span>
          </button>

          <button
            onClick={() => {
              onClose()
              onViewHistory()
            }}
            className="w-full py-2.5 px-4 rounded-xl border border-purple-500/30 bg-[#160E2A]/70 hover:bg-[#1E1338] text-xs font-semibold text-purple-200 hover:text-white transition-colors flex items-center justify-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>View Trade History</span>
          </button>
        </div>
      </div>
    </div>
  )
}


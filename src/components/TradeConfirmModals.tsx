import { isBuyDirection, type BinaryTrade } from "../state/trading"

interface StopTradeConfirmModalProps {
  trade: BinaryTrade | null
  currentPrice?: number
  onConfirm: () => void
  onCancel: () => void
  isStopping?: boolean
}

export function StopTradeConfirmModal({
  trade,
  currentPrice,
  onConfirm,
  onCancel,
  isStopping = false,
}: StopTradeConfirmModalProps) {
  if (!trade) return null

  const livePrice = currentPrice ?? trade.currentPrice ?? trade.entryPrice
  const pnl = trade.unrealizedPnl ?? 0
  const isPositive = pnl > 0
  const isZero = pnl === 0
  const estPayout = Math.max(0, trade.stake + pnl)
  const isBuy = isBuyDirection(trade.direction)

  return (
    <div className="fixed inset-0 z-[115] flex items-center justify-center p-4">
      {/* Dim backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onCancel}
      />

      <div className="relative z-[120] w-full max-w-md overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-b from-[#191228] to-[#0E0919] p-6 text-white shadow-2xl shadow-purple-950/60 font-sans">
        {/* Glow */}
        <div className="pointer-events-none absolute -top-16 left-1/2 h-32 w-48 -translate-x-1/2 rounded-full bg-amber-500/20 blur-3xl" />

        <div className="relative flex items-center gap-3 border-b border-purple-500/15 pb-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-bold text-white font-display">Stop Active Trade?</h3>
            <p className="text-xs text-zinc-400">This will close your trade immediately at the current market price.</p>
          </div>
        </div>

        {/* Live Metrics Card */}
        <div className="my-4 space-y-2.5 rounded-2xl border border-purple-500/20 bg-[#120B22] p-4 font-mono text-xs">
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">Asset</span>
            <div className="flex items-center gap-1.5 font-bold">
              <span className="text-white">{trade.symbol}</span>
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] ${
                  isBuy ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                }`}
              >
                {trade.direction.toUpperCase()}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-zinc-400">Stake</span>
            <span className="font-bold text-white">${trade.stake.toFixed(2)}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-zinc-400">Entry Price</span>
            <span className="text-zinc-300">{trade.entryPrice.toFixed(2)}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-zinc-400">Current Price</span>
            <span className="font-bold text-white">{livePrice.toFixed(2)}</span>
          </div>

          <div className="flex items-center justify-between border-t border-purple-500/15 pt-2">
            <span className="text-zinc-400">Current P&L</span>
            <span
              className={`font-bold text-sm ${
                isPositive ? "text-emerald-400" : isZero ? "text-zinc-300" : "text-rose-400"
              }`}
            >
              {isPositive ? "+" : ""}
              ${pnl.toFixed(2)} ({((pnl / trade.stake) * 100).toFixed(1)}%)
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-zinc-400">Estimated Payout</span>
            <span className="font-bold text-emerald-400 text-sm">${estPayout.toFixed(2)}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            onClick={onCancel}
            disabled={isStopping}
            className="py-2.5 px-4 rounded-xl border border-purple-500/30 bg-[#150E28] hover:bg-[#1E1438] text-xs font-semibold text-zinc-300 hover:text-white transition-colors"
          >
            Keep Active
          </button>
          <button
            onClick={onConfirm}
            disabled={isStopping}
            className="py-2.5 px-4 rounded-xl font-display font-bold text-xs text-white bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 active:scale-98 shadow-lg shadow-amber-950/50 transition-all flex items-center justify-center gap-1.5"
          >
            {isStopping ? (
              <span>Stopping...</span>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="1.5" />
                </svg>
                <span>Confirm Stop</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

interface ForceStopAllConfirmModalProps {
  isOpen: boolean
  count: number
  onConfirm: () => void
  onCancel: () => void
  isStopping?: boolean
}

export function ForceStopAllConfirmModal({
  isOpen,
  count,
  onConfirm,
  onCancel,
  isStopping = false,
}: ForceStopAllConfirmModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[115] flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onCancel}
      />

      <div className="relative z-[120] w-full max-w-md overflow-hidden rounded-3xl border border-rose-500/40 bg-gradient-to-b from-[#220F1E] to-[#120810] p-6 text-white shadow-2xl shadow-rose-950/60 font-sans">
        <div className="pointer-events-none absolute -top-16 left-1/2 h-32 w-48 -translate-x-1/2 rounded-full bg-rose-500/20 blur-3xl" />

        <div className="relative flex items-center gap-3 border-b border-rose-500/15 pb-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-bold text-white font-display">Stop All Active Trades?</h3>
            <p className="text-xs text-zinc-400">
              Close all <span className="font-bold text-white">{count}</span> open positions immediately at current market prices.
            </p>
          </div>
        </div>

        <p className="my-4 text-xs text-zinc-300 leading-relaxed bg-black/30 p-3 rounded-xl border border-rose-500/20">
          ⚠️ This will calculate the executable P&L for each position and settle all remaining stakes back to your wallet atomically.
        </p>

        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            onClick={onCancel}
            disabled={isStopping}
            className="py-2.5 px-4 rounded-xl border border-purple-500/30 bg-[#160E28] hover:bg-[#201438] text-xs font-semibold text-zinc-300 hover:text-white transition-colors"
          >
            Keep Trades Open
          </button>
          <button
            onClick={onConfirm}
            disabled={isStopping}
            className="py-2.5 px-4 rounded-xl font-display font-bold text-xs text-white bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 active:scale-98 shadow-lg shadow-rose-950/50 transition-all flex items-center justify-center gap-1.5"
          >
            {isStopping ? "Stopping All..." : `Stop All (${count})`}
          </button>
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { marketLabel, useTrading } from '../state/trading'
import LastDigitStatistics from '../components/LastDigitStatistics'

type Candle = { open: number; close: number; high: number; low: number; volume: number }
type TimeFrame = '1m' | '5m' | '15m' | '1h'
type ChartMode = 'candles' | 'line'

function buildCandlesFromHistory(history: number[], count: number): Candle[] {
  const samples = history.slice(-count)

  return samples.map((close, index) => {
    const open = index === 0 ? samples[0] ?? close : samples[index - 1]
    const body = Math.abs(close - open)

    return {
      open,
      close,
      high: Math.max(open, close) + body * 0.6 + 0.5,
      low: Math.min(open, close) - body * 0.4 - 0.35,
      volume: 180000 + body * 14000 + index * 800,
    }
  })
}

function CandleChart({ candles, livePrice }: { candles: Candle[]; livePrice: number }) {
  const W = 800
  const H = 340
  const PADDING = { top: 16, right: 72, bottom: 32, left: 8 }
  const chartW = W - PADDING.left - PADDING.right
  const chartH = H - PADDING.top - PADDING.bottom

  const allLow = Math.min(...candles.map(c => c.low), livePrice)
  const allHigh = Math.max(...candles.map(c => c.high), livePrice)
  const range = allHigh - allLow || 1

  const toY = (price: number) => PADDING.top + chartH - ((price - allLow) / range) * chartH
  const candleW = Math.max(2, (chartW / candles.length) * 0.65)
  const spacing = chartW / candles.length
  const priceLabels = 5
  const priceStep = (allHigh - allLow) / priceLabels

  const currentY = toY(livePrice)
  const lastCandle = candles[candles.length - 1]
  const isUp = livePrice >= (lastCandle?.open ?? livePrice)

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block', height: '100%' }}>
      <defs>
        <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#7C3AED" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {Array.from({ length: priceLabels + 1 }, (_, i) => {
        const price = allLow + priceStep * i
        const y = toY(price)
        return (
          <g key={i}>
            <line x1={PADDING.left} y1={y} x2={W - PADDING.right} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
            <text x={W - PADDING.right + 6} y={y + 4} fontSize="10" fill="#3F3F46" fontFamily="'IBM Plex Mono', monospace">
              {price.toFixed(0)}
            </text>
          </g>
        )
      })}

      {Array.from({ length: 8 }, (_, i) => {
        const x = PADDING.left + (chartW / 7) * i
        return <line key={i} x1={x} y1={PADDING.top} x2={x} y2={H - PADDING.bottom} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
      })}

      {candles.map((c, i) => {
        const x = PADDING.left + spacing * i + spacing * 0.175
        const isGreen = c.close >= c.open
        const color = isGreen ? '#22C55E' : '#EF4444'
        const bodyTop = toY(Math.max(c.open, c.close))
        const bodyBot = toY(Math.min(c.open, c.close))
        const bodyH = Math.max(1, bodyBot - bodyTop)
        const wickX = x + candleW / 2

        return (
          <g key={i}>
            <line x1={wickX} y1={toY(c.high)} x2={wickX} y2={toY(c.low)} stroke={color} strokeWidth="1" opacity="0.8" />
            <rect x={x} y={bodyTop} width={candleW} height={bodyH} fill={color} opacity="0.9" rx="0.5" />
          </g>
        )
      })}

      <line x1={PADDING.left} y1={currentY} x2={W - PADDING.right} y2={currentY} stroke={isUp ? '#22C55E' : '#EF4444'} strokeWidth="1" strokeDasharray="4,3" opacity="0.7" />

      <rect x={W - PADDING.right + 1} y={currentY - 10} width={PADDING.right - 2} height={20} rx="4" fill={isUp ? '#22C55E' : '#EF4444'} />
      <text x={W - PADDING.right / 2} y={currentY + 4} textAnchor="middle" fontSize="10" fontWeight="600" fill="white" fontFamily="'IBM Plex Mono', monospace">
        {livePrice.toFixed(2)}
      </text>

      <circle cx={PADDING.left + chartW} cy={currentY} r="4" fill={isUp ? '#22C55E' : '#EF4444'} style={{ filter: `drop-shadow(0 0 5px ${isUp ? '#22C55E' : '#EF4444'})` }} />
    </svg>
  )
}

function VolumeChart({ candles }: { candles: Candle[] }) {
  const W = 800
  const H = 50
  const PADDING = { right: 72, left: 8 }
  const chartW = W - PADDING.left - PADDING.right
  const maxVol = Math.max(...candles.map(c => c.volume))
  const spacing = chartW / candles.length
  const barW = Math.max(1.5, spacing * 0.65)

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block', height: 50 }}>
      {candles.map((c, i) => {
        const barH = (c.volume / maxVol) * (H - 4)
        const x = PADDING.left + spacing * i + spacing * 0.175
        const isGreen = c.close >= c.open
        return (
          <rect key={i} x={x} y={H - barH} width={barW} height={barH} fill={isGreen ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)'} rx="0.5" />
        )
      })}
    </svg>
  )
}

function LineChart({ history, livePrice }: { history: number[]; livePrice: number }) {
  const W = 800
  const H = 340
  const PADDING = { top: 16, right: 72, bottom: 32, left: 8 }
  const chartW = W - PADDING.left - PADDING.right
  const chartH = H - PADDING.top - PADDING.bottom
  const series = history.slice(-90)

  const allLow = Math.min(...series, livePrice)
  const allHigh = Math.max(...series, livePrice)
  const range = allHigh - allLow || 1

  const toY = (price: number) => PADDING.top + chartH - ((price - allLow) / range) * chartH
  const toX = (index: number) => PADDING.left + (index / Math.max(1, series.length - 1)) * chartW
  const priceLabels = 5
  const priceStep = (allHigh - allLow) / priceLabels

  const points = series.map((price, index) => ({ x: toX(index), y: toY(price) }))
  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L${toX(series.length - 1).toFixed(1)},${(H - PADDING.bottom).toFixed(1)} L${PADDING.left},${(H - PADDING.bottom).toFixed(1)} Z`

  const currentY = toY(livePrice)
  const isUp = livePrice >= (series[0] ?? livePrice)

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block', height: '100%' }}>
      <defs>
        <linearGradient id="lineAreaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22C55E" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#22C55E" stopOpacity="0.01" />
        </linearGradient>
      </defs>

      {Array.from({ length: priceLabels + 1 }, (_, i) => {
        const price = allLow + priceStep * i
        const y = toY(price)
        return (
          <g key={i}>
            <line x1={PADDING.left} y1={y} x2={W - PADDING.right} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
            <text x={W - PADDING.right + 6} y={y + 4} fontSize="10" fill="#3F3F46" fontFamily="'IBM Plex Mono', monospace">
              {price.toFixed(0)}
            </text>
          </g>
        )
      })}

      {Array.from({ length: 8 }, (_, i) => {
        const x = PADDING.left + (chartW / 7) * i
        return <line key={i} x1={x} y1={PADDING.top} x2={x} y2={H - PADDING.bottom} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
      })}

      <path d={areaPath} fill="url(#lineAreaGrad)" />
      <path d={linePath} fill="none" stroke={isUp ? '#22C55E' : '#EF4444'} strokeWidth="2" />

      <line x1={PADDING.left} y1={currentY} x2={W - PADDING.right} y2={currentY} stroke={isUp ? '#22C55E' : '#EF4444'} strokeWidth="1" strokeDasharray="4,3" opacity="0.7" />
      <rect x={W - PADDING.right + 1} y={currentY - 10} width={PADDING.right - 2} height={20} rx="4" fill={isUp ? '#22C55E' : '#EF4444'} />
      <text x={W - PADDING.right / 2} y={currentY + 4} textAnchor="middle" fontSize="10" fontWeight="600" fill="white" fontFamily="'IBM Plex Mono', monospace">
        {livePrice.toFixed(2)}
      </text>

      <circle cx={toX(series.length - 1)} cy={toY(series[series.length - 1] ?? livePrice)} r="4" fill={isUp ? '#22C55E' : '#EF4444'} style={{ filter: `drop-shadow(0 0 5px ${isUp ? '#22C55E' : '#EF4444'})` }} />
    </svg>
  )
}

export default function Terminal() {
  const { marketList, markets, selectedMarket, selectMarket, openTrades, recentTrades, placeTrade, forceCloseTrade, lastError, lastAction } = useTrading()
  const [timeframe, setTimeframe] = useState<TimeFrame>('5m')
  const [chartMode, setChartMode] = useState<ChartMode>('candles')
  const [bottomTab, setBottomTab] = useState('positions')
  const [contractType, setContractType] = useState<'rise-fall' | 'even-odd' | 'match-differ'>('rise-fall')
  const [prediction, setPrediction] = useState<'rise' | 'fall' | 'even' | 'odd' | 'match' | 'differ'>('rise')
  const [stake, setStake] = useState('50')
  const [expirySeconds, setExpirySeconds] = useState('30')

  const liveMarket = markets[selectedMarket.symbol] ?? selectedMarket
  const candles = buildCandlesFromHistory(liveMarket.history, timeframe === '15m' ? 80 : timeframe === '5m' ? 70 : timeframe === '1m' ? 54 : 42)
  const livePrice = liveMarket.price
  const currentDigit = Number(livePrice.toFixed(2).slice(-1))
  const priceChange = livePrice - (candles[0]?.open ?? livePrice)
  const pctChange = (priceChange / (candles[0]?.open ?? 1)) * 100
  const feedback = lastError ?? lastAction ?? 'Binary contracts settle automatically at expiry.'
  const payoutMultiplier = contractType === 'match-differ' ? 2.15 : contractType === 'even-odd' ? 1.8 : 1.82

  const placeBinaryTrade = () => {
    const result = placeTrade({
      symbol: selectedMarket.symbol,
      contractType,
      direction: prediction,
      stake: parseFloat(stake || '0'),
      expirySeconds: parseInt(expirySeconds || '30', 10),
    })

    if (result.ok) {
      setBottomTab('positions')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#09090F' }}>
      <div style={{ background: '#12121A', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 20, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <select
            value={selectedMarket.symbol}
            onChange={e => selectMarket(e.target.value)}
            style={{ background: '#181822', border: '1px solid rgba(255,255,255,0.08)', color: '#FFFFFF', borderRadius: 10, padding: '7px 12px', fontSize: 14, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, cursor: 'pointer', outline: 'none' }}
          >
            {marketList.map(market => (
              <option key={market.symbol} value={market.symbol}>
                {market.symbol}
              </option>
            ))}
          </select>
          <div className="live-dot" />
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span className="font-mono-data" style={{ fontSize: 22, fontWeight: 600, color: '#FFFFFF', letterSpacing: '-0.5px' }}>
            {livePrice.toFixed(2)}
          </span>
          <span className="font-mono-data" style={{ fontSize: 13, color: pctChange >= 0 ? '#22C55E' : '#EF4444', fontWeight: 600 }}>
            {pctChange >= 0 ? '+' : ''}{pctChange.toFixed(2)}%
          </span>
        </div>

        <div style={{ display: 'flex', gap: 20, marginLeft: 8 }}>
          {[
            { label: 'O', val: candles[0]?.open.toFixed(2) ?? livePrice.toFixed(2) },
            { label: 'H', val: Math.max(...candles.slice(-20).map(c => c.high)).toFixed(2) },
            { label: 'L', val: Math.min(...candles.slice(-20).map(c => c.low)).toFixed(2) },
            { label: 'Vol', val: 'Simulated' },
          ].map(s => (
            <div key={s.label} style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#3F3F46', fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace" }}>{s.label}</span>
              <span className="font-mono-data" style={{ fontSize: 12, color: '#71717A' }}>{s.val}</span>
            </div>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        <div style={{ display: 'flex', gap: 3 }}>
          {(['1m', '5m', '15m', '1h'] as TimeFrame[]).map(tf => (
            <button key={tf} onClick={() => setTimeframe(tf)} style={{ padding: '5px 10px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', fontFamily: "'IBM Plex Mono', monospace", transition: 'all 0.18s', background: timeframe === tf ? 'rgba(124,58,237,0.25)' : 'transparent', color: timeframe === tf ? '#A855F7' : '#52525B' }}>
              {tf}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 4, padding: '4px', background: '#181822', borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)' }}>
          <button
            onClick={() => setChartMode('candles')}
            style={{
              height: 28,
              padding: '0 10px',
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 700,
              fontFamily: "'IBM Plex Mono', monospace",
              background: chartMode === 'candles' ? 'rgba(124,58,237,0.3)' : 'transparent',
              color: chartMode === 'candles' ? '#A855F7' : '#52525B',
            }}
          >
            Candles
          </button>
          <button
            onClick={() => setChartMode('line')}
            style={{
              height: 28,
              padding: '0 10px',
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 700,
              fontFamily: "'IBM Plex Mono', monospace",
              background: chartMode === 'line' ? 'rgba(124,58,237,0.3)' : 'transparent',
              color: chartMode === 'line' ? '#A855F7' : '#52525B',
            }}
          >
            Line
          </button>
          {[
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18" strokeLinecap="round" /><path d="M7 16l4-5 4 3 4-7" strokeLinecap="round" strokeLinejoin="round" /></svg>,
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M12 3l9 9-9 9" strokeLinecap="round" strokeLinejoin="round" /></svg>,
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" strokeLinecap="round" /></svg>,
          ].map((icon, i) => (
            <button key={i} className="nav-icon-btn" style={{ width: 28, height: 28 }}>{icon}</button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ width: 180, flexShrink: 0, background: '#12121A', borderRight: '1px solid rgba(255,255,255,0.05)', overflow: 'auto' }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#3F3F46', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Watchlist</span>
          </div>
          {marketList.slice(0, 8).map(market => {
            const live = markets[market.symbol] ?? market
            const isActive = selectedMarket.symbol === market.symbol

            return (
              <div
                key={market.symbol}
                onClick={() => selectMarket(market.symbol)}
                style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.03)', cursor: 'pointer', background: isActive ? 'rgba(124,58,237,0.1)' : 'transparent', borderLeft: isActive ? '2px solid #7C3AED' : '2px solid transparent', transition: 'all 0.15s' }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
              >
                <div className="font-display" style={{ fontSize: 12, fontWeight: 700, color: isActive ? '#A855F7' : '#A1A1AA', marginBottom: 3 }}>{market.symbol}</div>
                <div className="font-mono-data" style={{ fontSize: 11, color: '#FFFFFF', marginBottom: 1 }}>{live.price.toFixed(2)}</div>
                <div className="font-mono-data" style={{ fontSize: 10, color: live.changePct >= 0 ? '#22C55E' : '#EF4444' }}>
                  {live.changePct >= 0 ? '+' : ''}{live.changePct.toFixed(2)}%
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, padding: '12px 8px 0', position: 'relative', overflow: 'hidden' }}>
            {chartMode === 'candles' ? <CandleChart candles={candles} livePrice={livePrice} /> : <LineChart history={liveMarket.history} livePrice={livePrice} />}
          </div>
          {chartMode === 'candles' && (
            <div style={{ padding: '0 8px 4px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
              <VolumeChart candles={candles} />
            </div>
          )}
          <LastDigitStatistics lastDigit={currentDigit} tickValue={livePrice} maxTicks={1000} />

          <div style={{ background: '#12121A', borderTop: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
            <div className="tab-bar">
              {[
                { id: 'positions', label: `Open (${openTrades.length})` },
                { id: 'orders', label: 'Orders' },
                { id: 'history', label: 'History' },
                { id: 'logs', label: 'Logs' },
              ].map(tab => (
                <button key={tab.id} className={`tab-item ${bottomTab === tab.id ? 'active' : ''}`} onClick={() => setBottomTab(tab.id)}>
                  {tab.label}
                </button>
              ))}
            </div>
            <div style={{ height: 140, overflow: 'auto' }}>
              {bottomTab === 'positions' && (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      {['ID', 'Symbol', 'Contract', 'Stake', 'Entry', 'Current', 'Expiry', 'Payout', ''].map(h => (
                        <th key={h} style={{ padding: '6px 12px', textAlign: 'left', fontSize: 10, color: '#3F3F46', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {openTrades.map(trade => {
                      const live = markets[trade.symbol] ?? selectedMarket

                      return (
                        <tr key={trade.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                          <td style={{ padding: '7px 12px' }}><span className="font-mono-data" style={{ fontSize: 11, color: '#52525B' }}>{trade.id}</span></td>
                          <td style={{ padding: '7px 12px' }}><span className="font-display" style={{ fontSize: 12, fontWeight: 600, color: '#FFFFFF' }}>{trade.symbol}</span></td>
                          <td style={{ padding: '7px 12px' }}><span className="font-mono-data" style={{ fontSize: 10, color: '#A855F7' }}>{trade.contractType.toUpperCase()}</span></td>
                          <td style={{ padding: '7px 12px' }}><span className="font-mono-data" style={{ fontSize: 11, color: '#71717A' }}>{trade.stake.toFixed(2)}</span></td>
                          <td style={{ padding: '7px 12px' }}><span className="font-mono-data" style={{ fontSize: 11, color: '#A1A1AA' }}>{trade.entryPrice.toFixed(2)}</span></td>
                          <td style={{ padding: '7px 12px' }}><span className="font-mono-data" style={{ fontSize: 11, color: '#FFFFFF' }}>{live.price.toFixed(2)}</span></td>
                          <td style={{ padding: '7px 12px' }}><span className="font-mono-data" style={{ fontSize: 11, color: '#A1A1AA' }}>{Math.max(0, Math.ceil((trade.expiryAt - Date.now()) / 1000))}s</span></td>
                          <td style={{ padding: '7px 12px' }}><span className="font-mono-data" style={{ fontSize: 11, color: '#22C55E' }}>{trade.payoutMultiplier.toFixed(2)}x</span></td>
                          <td style={{ padding: '7px 12px' }}>
                            <button onClick={() => forceCloseTrade(trade.id)} style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 5, cursor: 'pointer', background: 'rgba(239,68,68,0.12)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)', fontFamily: "'IBM Plex Mono', monospace" }}>
                              CLOSE
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}

              {bottomTab === 'history' && (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      {['ID', 'Symbol', 'Result', 'Entry', 'Exit', 'Stake', 'P&L'].map(h => (
                        <th key={h} style={{ padding: '6px 12px', textAlign: 'left', fontSize: 10, color: '#3F3F46', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recentTrades.map(trade => (
                      <tr key={trade.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                        <td style={{ padding: '7px 12px' }}><span className="font-mono-data" style={{ fontSize: 11, color: '#52525B' }}>{trade.id}</span></td>
                        <td style={{ padding: '7px 12px' }}><span className="font-display" style={{ fontSize: 12, fontWeight: 600, color: '#FFFFFF' }}>{trade.symbol}</span></td>
                        <td style={{ padding: '7px 12px' }}><span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, fontFamily: "'IBM Plex Mono', monospace", background: trade.result === 'won' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', color: trade.result === 'won' ? '#22C55E' : '#EF4444' }}>{trade.result?.toUpperCase()}</span></td>
                        <td style={{ padding: '7px 12px' }}><span className="font-mono-data" style={{ fontSize: 11, color: '#A1A1AA' }}>{trade.entryPrice.toFixed(2)}</span></td>
                        <td style={{ padding: '7px 12px' }}><span className="font-mono-data" style={{ fontSize: 11, color: '#FFFFFF' }}>{(trade.exitPrice ?? trade.entryPrice).toFixed(2)}</span></td>
                        <td style={{ padding: '7px 12px' }}><span className="font-mono-data" style={{ fontSize: 11, color: '#71717A' }}>{trade.stake.toFixed(2)}</span></td>
                        <td style={{ padding: '7px 12px' }}><span className="font-mono-data" style={{ fontSize: 12, fontWeight: 600, color: (trade.profit ?? 0) >= 0 ? '#22C55E' : '#EF4444' }}>{(trade.profit ?? 0) >= 0 ? '+' : ''}{(trade.profit ?? 0).toFixed(2)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {bottomTab === 'logs' && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#3F3F46', fontSize: 13 }}>
                  {feedback}
                </div>
              )}

              {bottomTab === 'orders' && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#3F3F46', fontSize: 13 }}>
                  Pending orders are not used in this binary simulation.
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ width: 260, flexShrink: 0, background: '#12121A', borderLeft: '1px solid rgba(255,255,255,0.05)', overflow: 'auto', padding: '16px' }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
            <button onClick={() => { setContractType('rise-fall'); setPrediction('rise') }} className={`order-side-btn order-buy ${contractType === 'rise-fall' ? 'active' : ''}`}>RISE/FALL</button>
            <button onClick={() => { setContractType('even-odd'); setPrediction('even') }} className={`order-side-btn order-sell ${contractType === 'even-odd' ? 'active' : ''}`}>EVEN/ODD</button>
          </div>

          <div style={{ textAlign: 'center', marginBottom: 14, padding: '6px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ fontSize: 11, color: '#52525B', fontFamily: "'IBM Plex Mono', monospace" }}>Risk model: </span>
            <span style={{ fontSize: 12, color: '#A855F7', fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600 }}>{contractType.toUpperCase()}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div className="field-label">Contract Type</div>
              <select className="field-input" value={contractType} onChange={e => { const value = e.target.value as 'rise-fall' | 'even-odd' | 'match-differ'; setContractType(value); setPrediction(value === 'rise-fall' ? 'rise' : value === 'even-odd' ? 'even' : 'match') }}>
                <option value="rise-fall">Rise / Fall</option>
                <option value="even-odd">Even / Odd</option>
                <option value="match-differ">Match / Differ</option>
              </select>
            </div>

            <div>
              <div className="field-label">Prediction</div>
              <select className="field-input" value={prediction} onChange={e => setPrediction(e.target.value as typeof prediction)}>
                {contractType === 'rise-fall' && <><option value="rise">Rise</option><option value="fall">Fall</option></>}
                {contractType === 'even-odd' && <><option value="even">Even</option><option value="odd">Odd</option></>}
                {contractType === 'match-differ' && <><option value="match">Match</option><option value="differ">Differ</option></>}
              </select>
            </div>

            <div>
              <div className="field-label">Expiry (seconds)</div>
              <select className="field-input" value={expirySeconds} onChange={e => setExpirySeconds(e.target.value)}>
                <option value="10">10</option>
                <option value="30">30</option>
                <option value="60">60</option>
                <option value="120">120</option>
              </select>
            </div>

            <div>
              <div className="field-label">Stake</div>
              <input className="field-input" type="number" value={stake} onChange={e => setStake(e.target.value)} step="0.01" min="1" />
            </div>
          </div>

          <div style={{ margin: '14px 0', padding: '12px', background: '#181822', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: '#52525B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Trade Type</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#F59E0B', fontFamily: "'IBM Plex Mono', monospace" }}>{marketLabel(prediction)}</span>
            </div>
            <div style={{ height: 5, background: 'rgba(255,255,255,0.05)', borderRadius: 3 }}>
              <div style={{ height: '100%', width: '55%', background: 'linear-gradient(90deg, #22C55E, #F59E0B)', borderRadius: 3 }} />
            </div>
          </div>

          <div style={{ padding: '12px', background: '#181822', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)', marginBottom: 14 }}>
            {[
              { label: 'Stake', val: `$${parseFloat(stake || '0').toFixed(2)}` },
              { label: 'Potential Payout', val: `~$${(parseFloat(stake || '0') * payoutMultiplier).toFixed(2)}` },
              { label: 'Entry Digit', val: livePrice.toFixed(2).slice(-1) },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: '#52525B' }}>{row.label}</span>
                <span className="font-mono-data" style={{ fontSize: 12, color: '#A1A1AA', fontWeight: 600 }}>{row.val}</span>
              </div>
            ))}
          </div>

          <button className={`execute-btn ${prediction === 'rise' || prediction === 'even' || prediction === 'match' ? 'execute-buy' : 'execute-sell'}`} onClick={placeBinaryTrade} style={{ marginBottom: 8 }}>
            Place {marketLabel(prediction)} on {selectedMarket.symbol}
          </button>
          <button style={{ width: '100%', padding: '10px', borderRadius: 12, background: 'transparent', color: '#52525B', border: '1px solid rgba(255,255,255,0.07)', cursor: 'pointer', fontSize: 13, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600 }}>
            Cancel
          </button>

          <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 12, background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.18)', color: lastError ? '#EF4444' : '#A1A1AA', fontSize: 12, lineHeight: 1.5 }}>
            {feedback}
          </div>
        </div>
      </div>
    </div>
  )
}
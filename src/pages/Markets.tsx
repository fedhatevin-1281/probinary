import { useState } from 'react'
import { buildSeriesShape, useTrading } from '../state/trading'

interface Props {
  onTrade: () => void
}

type Category = 'all' | 'volatility' | 'boom' | 'crash' | 'step' | 'favorites'

const MARKETS_DATA = [
  { symbol: 'VOL-10', name: 'Volatility 10 Index', category: 'volatility', price: 3891.77, change: +1.12, volatility: 'Low', volume: '4.2M', fav: false },
  { symbol: 'VOL-25', name: 'Volatility 25 Index', category: 'volatility', price: 5234.44, change: +2.31, volatility: 'Low', volume: '6.8M', fav: false },
  { symbol: 'VOL-50', name: 'Volatility 50 Index', category: 'volatility', price: 6789.31, change: -0.77, volatility: 'Medium', volume: '11.2M', fav: true },
  { symbol: 'VOL-75', name: 'Volatility 75 Index', category: 'volatility', price: 8243.12, change: +2.34, volatility: 'High', volume: '14.2M', fav: true },
  { symbol: 'VOL-100', name: 'Volatility 100 Index', category: 'volatility', price: 15420.33, change: +3.62, volatility: 'Very High', volume: '22.1M', fav: false },
  { symbol: 'BOOM-300', name: 'Boom 300 Index', category: 'boom', price: 7841.20, change: +3.44, volatility: 'Medium', volume: '8.9M', fav: false },
  { symbol: 'BOOM-500', name: 'Boom 500 Index', category: 'boom', price: 12891.44, change: +5.17, volatility: 'High', volume: '18.4M', fav: true },
  { symbol: 'BOOM-1000', name: 'Boom 1000 Index', category: 'boom', price: 22104.55, change: +8.91, volatility: 'Very High', volume: '31.7M', fav: false },
  { symbol: 'CRASH-300', name: 'Crash 300 Index', category: 'crash', price: 5674.80, change: -1.89, volatility: 'Medium', volume: '7.3M', fav: false },
  { symbol: 'CRASH-500', name: 'Crash 500 Index', category: 'crash', price: 4312.20, change: -3.41, volatility: 'High', volume: '12.6M', fav: true },
  { symbol: 'CRASH-1000', name: 'Crash 1000 Index', category: 'crash', price: 2891.66, change: -6.22, volatility: 'Very High', volume: '19.8M', fav: false },
  { symbol: 'STEP-UP', name: 'Step Index (Up)', category: 'step', price: 9122.64, change: +2.85, volatility: 'Low', volume: '3.1M', fav: false },
  { symbol: 'JUMP-10', name: 'Jump 10 Index', category: 'step', price: 18934.00, change: +4.23, volatility: 'High', volume: '24.5M', fav: false },
  { symbol: 'JUMP-25', name: 'Jump 25 Index', category: 'step', price: 44211.80, change: +9.12, volatility: 'Very High', volume: '42.0M', fav: false },
  { symbol: 'JUMP-50', name: 'Jump 50 Index', category: 'step', price: 91234.00, change: +11.44, volatility: 'Extreme', volume: '68.3M', fav: false },
]

function Sparkline({ history, positive }: { history: number[]; positive: boolean }) {
  const color = positive ? '#22C55E' : '#EF4444'
  const { line } = buildSeriesShape(history, 60, 28, 2)
  return (
    <svg width="60" height="28" viewBox="0 0 60 60" style={{ display: 'block' }}>
      <path d={line} fill="none" stroke={color} strokeWidth="2" />
    </svg>
  )
}

function VolatilityBadge({ level }: { level: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    Low: { bg: 'rgba(34,197,94,0.12)', text: '#22C55E' },
    Medium: { bg: 'rgba(245,158,11,0.12)', text: '#F59E0B' },
    High: { bg: 'rgba(239,68,68,0.12)', text: '#EF4444' },
    'Very High': { bg: 'rgba(168,85,247,0.12)', text: '#A855F7' },
    Extreme: { bg: 'rgba(124,58,237,0.2)', text: '#C084FC' },
  }
  const c = colors[level] ?? colors.Medium
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 5, background: c.bg, color: c.text, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.02em' }}>
      {level.toUpperCase()}
    </span>
  )
}

export default function Markets({ onTrade }: Props) {
  const { marketList, markets, selectMarket } = useTrading()
  const [category, setCategory] = useState<Category>('all')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'change' | 'volume' | 'price'>('change')
  const [favs, setFavs] = useState(new Set(MARKETS_DATA.filter(m => m.fav).map(m => m.symbol)))

  const toggleFav = (symbol: string) => {
    setFavs(prev => {
      const next = new Set(prev)
      next.has(symbol) ? next.delete(symbol) : next.add(symbol)
      return next
    })
  }

  const filtered = MARKETS_DATA
    .filter(m => {
      if (category === 'favorites') return favs.has(m.symbol)
      if (category !== 'all') return m.category === category
      return true
    })
    .filter(m => m.symbol.toLowerCase().includes(search.toLowerCase()) || m.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === 'change') return Math.abs(b.change) - Math.abs(a.change)
      if (sort === 'volume') return parseFloat(b.volume) - parseFloat(a.volume)
      return b.price - a.price
    })

  const CATS: { id: Category; label: string }[] = [
    { id: 'all', label: 'All Markets' },
    { id: 'volatility', label: 'Volatility' },
    { id: 'boom', label: 'Boom' },
    { id: 'crash', label: 'Crash' },
    { id: 'step', label: 'Step & Jump' },
    { id: 'favorites', label: `★ Favorites (${favs.size})` },
  ]

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="font-display" style={{ fontSize: 22, fontWeight: 700, color: '#FFFFFF', margin: 0, letterSpacing: '-0.5px' }}>Markets</h1>
          <p style={{ fontSize: 13, color: '#52525B', margin: '4px 0 0' }}>{MARKETS_DATA.length} synthetic indices · Live prices</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="live-dot" />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#22C55E', fontFamily: "'Space Grotesk', sans-serif" }}>All Markets Live</span>
        </div>
      </div>

      {/* Category tabs + search */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div className="tab-bar" style={{ borderBottom: 'none', gap: 2 }}>
          {CATS.map(c => (
            <button
              key={c.id}
              className={`tab-item ${category === c.id ? 'active' : ''}`}
              onClick={() => setCategory(c.id)}
              style={{ borderBottom: 'none', borderRadius: 10, padding: '7px 14px', background: category === c.id ? 'rgba(124,58,237,0.12)' : 'transparent', border: category === c.id ? '1px solid rgba(124,58,237,0.2)' : '1px solid transparent' }}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#52525B', display: 'flex' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" strokeLinecap="round" /></svg>
            </div>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search..."
              style={{ background: '#181822', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '8px 12px 8px 32px', color: '#A1A1AA', fontFamily: "'Inter', sans-serif", fontSize: 13, outline: 'none', width: 180 }}
            />
          </div>

          {/* Sort */}
          <select
            value={sort}
            onChange={e => setSort(e.target.value as typeof sort)}
            style={{ background: '#181822', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '8px 12px', color: '#A1A1AA', fontFamily: "'Inter', sans-serif", fontSize: 13, outline: 'none', cursor: 'pointer' }}
          >
            <option value="change">Sort by Change</option>
            <option value="volume">Sort by Volume</option>
            <option value="price">Sort by Price</option>
          </select>
        </div>
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {filtered.map((market, idx) => {
          const originalIdx = MARKETS_DATA.indexOf(market)
          const live = markets[market.symbol] ?? marketList[originalIdx]
          const livePrice = live?.price ?? market.price
          const change = live?.changePct ?? market.change
          const isUp = change >= 0
          const isFav = favs.has(market.symbol)

          return (
            <div
              key={market.symbol}
              className="card-base card-hover"
              style={{ padding: '20px', cursor: 'pointer', position: 'relative' }}
            >
              {/* Fav button */}
              <button
                onClick={e => { e.stopPropagation(); toggleFav(market.symbol) }}
                style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: isFav ? '#F59E0B' : '#3F3F46', transition: 'color 0.2s' }}
                title={isFav ? 'Remove from watchlist' : 'Add to watchlist'}
              >
                {isFav ? '★' : '☆'}
              </button>

              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span className="font-display" style={{ fontSize: 15, fontWeight: 700, color: '#FFFFFF' }}>{market.symbol}</span>
                    <div className="live-dot" style={{ width: 5, height: 5 }} />
                  </div>
                  <div style={{ fontSize: 12, color: '#52525B' }}>{market.name}</div>
                </div>
              </div>

              {/* Price + sparkline */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div>
                  <div className="font-mono-data" style={{ fontSize: 20, fontWeight: 600, color: '#FFFFFF', letterSpacing: '-0.5px' }}>
                    {livePrice.toFixed(2)}
                  </div>
                  <div className="font-mono-data" style={{ fontSize: 13, color: isUp ? '#22C55E' : '#EF4444', fontWeight: 600, marginTop: 2 }}>
                    {isUp ? '▲' : '▼'} {isUp ? '+' : ''}{change.toFixed(2)}%
                  </div>
                </div>
                <Sparkline history={live?.history ?? [market.price]} positive={isUp} />
              </div>

              {/* Metadata row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                <VolatilityBadge level={market.volatility} />
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10, color: '#3F3F46', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 1 }}>Vol</div>
                    <div className="font-mono-data" style={{ fontSize: 11, color: '#71717A' }}>{market.volume}</div>
                  </div>
                </div>
              </div>

              {/* Trade button - appears on hover */}
              <button
                onClick={() => { selectMarket(market.symbol); onTrade() }}
                className="btn-primary"
                style={{ width: '100%', padding: '10px', borderRadius: 10, fontSize: 13, marginTop: 12 }}
              >
                Trade Now →
              </button>
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '80px 0', color: '#3F3F46' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>○</div>
          <div className="font-display" style={{ fontSize: 16, fontWeight: 600, color: '#52525B' }}>No markets found</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>Try adjusting your search or filter</div>
        </div>
      )}
    </div>
  )
}

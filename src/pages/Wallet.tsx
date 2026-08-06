import { useMemo, useState } from 'react'
import { useAnimatedNumber } from '../hooks/useAnimatedNumber'
import { useTopNav, type WalletTransaction } from '../state/topNav'

function formatDate(value: number) {
  return new Date(value).toLocaleString()
}

export default function Wallet() {
  const {
    balances,
    activeAccount,
    setActiveAccount,
    walletSettings,
    setUsdKesRate,
    walletTransactions,
    formatUsdValue,
    formatKesValue,
  } = useTopNav()

  const animatedReal = useAnimatedNumber(balances.real, 380)
  const animatedDemo = useAnimatedNumber(balances.demo, 380)
  const animatedAvailable = useAnimatedNumber(balances.available, 380)
  const animatedPending = useAnimatedNumber(balances.pending, 380)

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | WalletTransaction['type']>('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState<'time' | 'amount' | 'balance'>('time')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [rateInput, setRateInput] = useState(String(walletSettings.usdKesRate))

  const filteredTransactions = useMemo(() => {
    let rows = walletTransactions

    if (typeFilter !== 'all') {
      rows = rows.filter(item => item.type === typeFilter)
    }

    if (statusFilter !== 'all') {
      rows = rows.filter(item => item.status === statusFilter)
    }

    if (search.trim()) {
      const query = search.toLowerCase()
      rows = rows.filter(item =>
        item.referenceNumber.toLowerCase().includes(query) ||
        (item.note || '').toLowerCase().includes(query) ||
        item.type.toLowerCase().includes(query),
      )
    }

    rows = [...rows].sort((a, b) => {
      if (sortBy === 'time') {
        return sortDir === 'desc' ? b.timestamp - a.timestamp : a.timestamp - b.timestamp
      }

      if (sortBy === 'amount') {
        return sortDir === 'desc' ? b.amountUsd - a.amountUsd : a.amountUsd - b.amountUsd
      }

      return sortDir === 'desc' ? b.balanceAfterUsd - a.balanceAfterUsd : a.balanceAfterUsd - b.balanceAfterUsd
    })

    return rows
  }, [search, sortBy, sortDir, statusFilter, typeFilter, walletTransactions])

  const exportCsv = () => {
    const header = [
      'Transaction ID',
      'Date & Time',
      'Type',
      'Amount (USD)',
      'Status',
      'Reference Number',
      'Balance After (USD)',
    ]

    const lines = filteredTransactions.map(item => [
      item.id,
      new Date(item.timestamp).toISOString(),
      item.type,
      item.amountUsd.toFixed(2),
      item.status,
      item.referenceNumber,
      item.balanceAfterUsd.toFixed(2),
    ])

    const csv = [header, ...lines]
      .map(line => line.map(cell => `"${cell.replaceAll('"', '""')}"`).join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'wallet-transactions-usd.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 className="font-display" style={{ fontSize: 22, fontWeight: 700, color: '#FFFFFF', margin: 0, letterSpacing: '-0.5px' }}>
            Wallet
          </h1>
          <p style={{ fontSize: 13, color: '#71717A', margin: '6px 0 0' }}>
            Primary currency: USD · Mobile Money API conversion: 1 USD = {walletSettings.usdKesRate.toFixed(2)} KES
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button className={`nav-feature-secondary ${activeAccount === 'real' ? 'active' : ''}`} onClick={() => setActiveAccount('real')}>
            Real
          </button>
          <button className={`nav-feature-secondary ${activeAccount === 'demo' ? 'active' : ''}`} onClick={() => setActiveAccount('demo')}>
            Demo
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <div className="card-base" style={{ padding: 16 }}>
          <div style={{ fontSize: 12, color: '#A78BFA' }}>Real Wallet Balance (USD)</div>
          <div className="font-mono-data" style={{ marginTop: 8, color: '#FFFFFF', fontSize: 22 }}>{formatUsdValue(animatedReal)}</div>
        </div>
        <div className="card-base" style={{ padding: 16 }}>
          <div style={{ fontSize: 12, color: '#A78BFA' }}>Demo Wallet Balance (USD)</div>
          <div className="font-mono-data" style={{ marginTop: 8, color: '#FFFFFF', fontSize: 22 }}>{formatUsdValue(animatedDemo)}</div>
        </div>
        <div className="card-base" style={{ padding: 16 }}>
          <div style={{ fontSize: 12, color: '#A78BFA' }}>Available Balance (USD)</div>
          <div className="font-mono-data" style={{ marginTop: 8, color: '#22C55E', fontSize: 22 }}>{formatUsdValue(animatedAvailable)}</div>
        </div>
        <div className="card-base" style={{ padding: 16 }}>
          <div style={{ fontSize: 12, color: '#A78BFA' }}>Pending Balance (USD)</div>
          <div className="font-mono-data" style={{ marginTop: 8, color: '#F59E0B', fontSize: 22 }}>{formatUsdValue(animatedPending)}</div>
        </div>
      </div>

      <div className="card-base" style={{ padding: 16, display: 'grid', gap: 10 }}>
        <h3 className="font-display" style={{ margin: 0, fontSize: 16, color: '#EDE9FE' }}>Mobile Money Exchange Configuration</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#A78BFA' }}>USD to KES exchange rate</span>
          <input className="field-input" style={{ width: 180 }} value={rateInput} onChange={event => setRateInput(event.target.value)} />
          <button className="nav-feature-primary" onClick={() => setUsdKesRate(Number(rateInput))}>
            Save Rate
          </button>
        </div>
        <div style={{ fontSize: 12, color: '#C4B5FD' }}>
          Mobile Money conversion preview: {formatUsdValue(1)} = {formatKesValue(walletSettings.usdKesRate)}
        </div>
      </div>

      <div className="card-base" style={{ padding: 16, display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <h3 className="font-display" style={{ margin: 0, fontSize: 16, color: '#EDE9FE' }}>Wallet Transactions (USD)</h3>
          <button className="nav-feature-secondary" onClick={exportCsv}>Export CSV</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
          <input className="field-input" placeholder="Search ID/reference/type" value={search} onChange={event => setSearch(event.target.value)} />
          <select className="field-input" value={typeFilter} onChange={event => setTypeFilter(event.target.value as 'all' | WalletTransaction['type'])}>
            <option value="all">All types</option>
            <option value="deposit">Deposit</option>
            <option value="withdrawal">Withdrawal</option>
            <option value="trade">Trade</option>
            <option value="adjustment">Adjustment</option>
          </select>
          <select className="field-input" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="rejected">Rejected</option>
            <option value="failed">Failed</option>
            <option value="success">Success</option>
          </select>
          <select className="field-input" value={sortBy} onChange={event => setSortBy(event.target.value as 'time' | 'amount' | 'balance')}>
            <option value="time">Sort by time</option>
            <option value="amount">Sort by amount</option>
            <option value="balance">Sort by balance after</option>
          </select>
          <button className="nav-feature-secondary" onClick={() => setSortDir(value => (value === 'asc' ? 'desc' : 'asc'))}>
            {sortDir === 'asc' ? 'Ascending' : 'Descending'}
          </button>
        </div>

        <div style={{ border: '1px solid rgba(167,139,250,0.22)', borderRadius: 10, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 940 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(167,139,250,0.25)' }}>
                {['Transaction ID', 'Date & Time', 'Type', 'Amount (USD)', 'Status', 'Reference Number', 'Balance After (USD)'].map(header => (
                  <th key={header} style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, color: '#A78BFA', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map(item => (
                <tr key={item.id} style={{ borderBottom: '1px solid rgba(167,139,250,0.12)' }}>
                  <td className="font-mono-data" style={{ padding: '10px 12px', color: '#DDD6FE', fontSize: 12 }}>{item.id}</td>
                  <td style={{ padding: '10px 12px', color: '#C4B5FD', fontSize: 12 }}>{formatDate(item.timestamp)}</td>
                  <td style={{ padding: '10px 12px', color: '#DDD6FE', fontSize: 12 }}>{item.type}</td>
                  <td style={{ padding: '10px 12px', color: item.amountUsd >= 0 ? '#22C55E' : '#F87171', fontSize: 12 }}>
                    {item.amountUsd >= 0 ? '+' : '-'}{formatUsdValue(Math.abs(item.amountUsd))}
                  </td>
                  <td style={{ padding: '10px 12px', color: '#DDD6FE', fontSize: 12 }}>{item.status}</td>
                  <td className="font-mono-data" style={{ padding: '10px 12px', color: '#C4B5FD', fontSize: 12 }}>{item.referenceNumber}</td>
                  <td style={{ padding: '10px 12px', color: '#DDD6FE', fontSize: 12 }}>{formatUsdValue(item.balanceAfterUsd)}</td>
                </tr>
              ))}
              {!filteredTransactions.length && (
                <tr>
                  <td colSpan={7} style={{ padding: '16px 12px', color: '#A78BFA', textAlign: 'center', fontSize: 13 }}>
                    No wallet transactions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

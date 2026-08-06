import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import {
  useTopNav,
  type HistoryItem,
  type HistoryTab,
  type NotificationCategory,
} from '../state/topNav'

interface Props {
  onClose: () => void
}

const modalShell: CSSProperties = {
  width: 'min(960px, 94vw)',
  maxHeight: '86vh',
  borderRadius: 16,
  border: '1px solid rgba(167,139,250,0.28)',
  background: '#141127',
  boxShadow: '0 26px 80px rgba(22,9,44,0.7)',
  overflow: 'hidden',
  animation: 'slide-up 0.26s ease',
}

const panelTitleStyle: CSSProperties = {
  margin: 0,
  fontFamily: "'Space Grotesk', sans-serif",
  fontSize: 20,
  color: '#F5F3FF',
}

const sectionCardStyle: CSSProperties = {
  borderRadius: 12,
  background: 'rgba(76,29,149,0.22)',
  border: '1px solid rgba(167,139,250,0.24)',
  padding: 14,
}

function formatDate(value: number) {
  return new Date(value).toLocaleString()
}

function getStatusColor(status: string) {
  if (status === 'completed' || status === 'success') return '#22C55E'
  if (status === 'pending' || status === 'processing') return '#F59E0B'
  return '#EF4444'
}

function HistoryTable({ rows, formatUsdValue }: { rows: HistoryItem[]; formatUsdValue: (amount: number) => string }) {
  return (
    <div style={{ border: '1px solid rgba(167,139,250,0.2)', borderRadius: 12, overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
        <thead>
          <tr style={{ background: 'rgba(76,29,149,0.25)' }}>
            {['Date', 'Type', 'Amount (USD)', 'Status', 'Market', 'Reference', 'Balance After (USD)'].map(header => (
              <th key={header} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, color: '#C4B5FD', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.id} style={{ borderTop: '1px solid rgba(167,139,250,0.12)' }}>
              <td style={{ padding: '10px 12px', color: '#DDD6FE', fontSize: 12 }}>{formatDate(row.date)}</td>
              <td style={{ padding: '10px 12px', color: '#DDD6FE', fontSize: 12 }}>{row.type}</td>
              <td style={{ padding: '10px 12px', color: row.amount >= 0 ? '#22C55E' : '#F87171', fontSize: 12 }}>
                {row.amount >= 0 ? '+' : '-'}{formatUsdValue(Math.abs(row.amount))}
              </td>
              <td style={{ padding: '10px 12px' }}>
                <span style={{ display: 'inline-flex', borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 600, color: getStatusColor(row.status), border: `1px solid ${getStatusColor(row.status)}55` }}>
                  {row.status.toUpperCase()}
                </span>
              </td>
              <td style={{ padding: '10px 12px', color: '#A78BFA', fontSize: 12 }}>{row.market}</td>
              <td style={{ padding: '10px 12px', color: '#C4B5FD', fontSize: 12 }}>{row.referenceNumber}</td>
              <td style={{ padding: '10px 12px', color: '#DDD6FE', fontSize: 12 }}>{formatUsdValue(row.balanceAfter)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function WithdrawPanel({ onClose }: { onClose: () => void }) {
  const { balances, withdrawalHistory, submitWithdrawal, loadingStates, withdrawMinimumUsd, formatUsdValue } = useTopNav()
  const [amountUsd, setAmountUsd] = useState('20')
  const [paymentMethod, setPaymentMethod] = useState('Bank Transfer')
  const [accountNumber, setAccountNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setError(null)
    const result = await submitWithdrawal({ amountUsd: Number(amountUsd), paymentMethod, accountNumber, notes })
    if (!result.ok) {
      setError(result.error || 'Could not submit withdrawal')
      return
    }
    setAmountUsd('20')
    setAccountNumber('')
    setNotes('')
  }

  return (
    <div style={modalShell} role="dialog" aria-label="Withdraw funds" aria-modal="true">
      <div style={{ padding: '16px 18px', borderBottom: '1px solid rgba(167,139,250,0.22)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={panelTitleStyle}>Withdraw</h2>
        <button className="nav-feature-close" onClick={onClose}>Close</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, padding: '16px 18px' }}>
        <div style={sectionCardStyle}><div style={{ fontSize: 11, color: '#C4B5FD' }}>Real Wallet Balance</div><div className="font-mono-data" style={{ marginTop: 6 }}>{formatUsdValue(balances.real)}</div></div>
        <div style={sectionCardStyle}><div style={{ fontSize: 11, color: '#C4B5FD' }}>Available Balance</div><div className="font-mono-data" style={{ marginTop: 6 }}>{formatUsdValue(balances.available)}</div></div>
        <div style={sectionCardStyle}><div style={{ fontSize: 11, color: '#C4B5FD' }}>Pending Balance</div><div className="font-mono-data" style={{ marginTop: 6 }}>{formatUsdValue(balances.pending)}</div></div>
        <div style={sectionCardStyle}><div style={{ fontSize: 11, color: '#C4B5FD' }}>Minimum Withdrawal</div><div className="font-mono-data" style={{ marginTop: 6 }}>{formatUsdValue(withdrawMinimumUsd)}</div></div>
      </div>

      <div style={{ padding: '0 18px 18px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div className="nav-feature-form-grid">
          <label className="field-label">Amount (USD)</label>
          <input className="field-input" type="number" min={0} value={amountUsd} onChange={event => setAmountUsd(event.target.value)} />

          <label className="field-label">Payment Method</label>
          <select className="field-input" value={paymentMethod} onChange={event => setPaymentMethod(event.target.value)}>
            {['Bank Transfer', 'Mobile Money', 'Crypto', 'Credit Card', 'Local Payment'].map(method => <option key={method}>{method}</option>)}
          </select>

          <label className="field-label">Wallet / Account Number</label>
          <input className="field-input" value={accountNumber} onChange={event => setAccountNumber(event.target.value)} />

          <label className="field-label">Notes (Optional)</label>
          <textarea className="field-input" rows={3} value={notes} onChange={event => setNotes(event.target.value)} />

          {error && <div style={{ color: '#F87171', fontSize: 12 }}>{error}</div>}
          <button className="nav-feature-primary" onClick={() => void submit()} disabled={loadingStates.withdraw}>{loadingStates.withdraw ? 'Submitting...' : 'Submit Withdrawal'}</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h3 style={{ margin: 0, color: '#DDD6FE', fontSize: 14 }}>Withdrawal History</h3>
          <div style={{ border: '1px solid rgba(167,139,250,0.2)', borderRadius: 10, maxHeight: 320, overflowY: 'auto' }}>
            {withdrawalHistory.map(item => (
              <div key={item.id} style={{ padding: '10px 12px', borderTop: '1px solid rgba(167,139,250,0.13)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong className="font-mono-data" style={{ fontSize: 12, color: '#DDD6FE' }}>{item.referenceNumber}</strong>
                  <span style={{ fontSize: 11, color: getStatusColor(item.status) }}>{item.status.toUpperCase()}</span>
                </div>
                <div style={{ fontSize: 12, color: '#C4B5FD', marginTop: 3 }}>{item.method} · {item.accountNumber}</div>
                <div style={{ fontSize: 12, color: '#A78BFA', marginTop: 3 }}>{formatDate(item.createdAt)} · -{formatUsdValue(item.amountUsd)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function DepositPanel({ onClose }: { onClose: () => void }) {
  const { submitDeposit, depositHistory, depositMinimumUsd, loadingStates, walletSettings, formatUsdValue, formatKesValue } = useTopNav()
  const [amountUsd, setAmountUsd] = useState('10')
  const [paymentMethod, setPaymentMethod] = useState('Credit Card')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [receipt, setReceipt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const amount = Number(amountUsd || '0')
  const belowMinimum = !Number.isFinite(amount) || amount < depositMinimumUsd
  const mobileMoneyPreviewKes = paymentMethod === 'Mobile Money' ? amount * walletSettings.usdKesRate : 0

  const submit = async () => {
    setError(null)
    const result = await submitDeposit({ amountUsd: Number(amountUsd), paymentMethod, referenceNumber })
    if (!result.ok) {
      setError(result.error || 'Deposit failed')
      return
    }
    setReceipt(result.receiptNumber || null)
    setAmountUsd('10')
    setReferenceNumber('')
  }

  return (
    <div style={modalShell} role="dialog" aria-label="Deposit funds" aria-modal="true">
      <div style={{ padding: '16px 18px', borderBottom: '1px solid rgba(167,139,250,0.22)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={panelTitleStyle}>Deposit</h2>
        <button className="nav-feature-close" onClick={onClose}>Close</button>
      </div>

      <div style={{ padding: '16px 18px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div className="nav-feature-form-grid">
          <label className="field-label">Available methods</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {['Credit Card', 'Crypto', 'Bank Transfer', 'Mobile Money', 'Local Payments'].map(method => (
              <button key={method} className={`nav-chip-btn ${paymentMethod === method ? 'active' : ''}`} onClick={() => setPaymentMethod(method)}>{method}</button>
            ))}
          </div>

          <label className="field-label">Amount (USD)</label>
          <input className="field-input" type="number" min={0} value={amountUsd} onChange={event => setAmountUsd(event.target.value)} />

          <div style={{ ...sectionCardStyle, fontSize: 12, color: '#DDD6FE' }}>
            Minimum deposit: {formatUsdValue(depositMinimumUsd)}
          </div>

          {paymentMethod === 'Mobile Money' && (
            <div style={{ ...sectionCardStyle, fontSize: 12, color: '#DDD6FE' }}>
              API payload preview: {formatUsdValue(amount || 0)} will be sent as {formatKesValue(mobileMoneyPreviewKes)} using rate {walletSettings.usdKesRate}
            </div>
          )}

          <label className="field-label">Reference Number</label>
          <input className="field-input" value={referenceNumber} onChange={event => setReferenceNumber(event.target.value)} placeholder="Gateway / bank reference" />

          {belowMinimum && <div style={{ color: '#F59E0B', fontSize: 12 }}>Deposit must be at least {formatUsdValue(depositMinimumUsd)}.</div>}
          {error && <div style={{ color: '#F87171', fontSize: 12 }}>{error}</div>}
          {receipt && <div style={{ color: '#22C55E', fontSize: 12 }}>Success. Receipt: {receipt}</div>}

          <button className="nav-feature-primary" onClick={() => void submit()} disabled={loadingStates.deposit || belowMinimum}>{loadingStates.deposit ? 'Processing...' : 'Complete Deposit'}</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h3 style={{ margin: 0, color: '#DDD6FE', fontSize: 14 }}>Deposit Receipts</h3>
          <div style={{ border: '1px solid rgba(167,139,250,0.2)', borderRadius: 10, maxHeight: 340, overflowY: 'auto' }}>
            {depositHistory.map(item => (
              <div key={item.id} style={{ padding: '10px 12px', borderTop: '1px solid rgba(167,139,250,0.13)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong className="font-mono-data" style={{ fontSize: 12, color: '#DDD6FE' }}>{item.receiptNumber}</strong>
                  <span style={{ fontSize: 11, color: getStatusColor(item.status) }}>{item.status.toUpperCase()}</span>
                </div>
                <div style={{ fontSize: 12, color: '#C4B5FD', marginTop: 3 }}>{item.method} · {formatUsdValue(item.amountUsd)}</div>
                <div style={{ fontSize: 12, color: '#A78BFA', marginTop: 3 }}>{formatDate(item.createdAt)} · Ref {item.referenceNumber}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function HistoryPanel({ onClose }: { onClose: () => void }) {
  const { historyRows, formatUsdValue } = useTopNav()
  const [tab, setTab] = useState<HistoryTab>('trades')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [sortKey, setSortKey] = useState<'date' | 'amount' | 'status'>('date')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    let rows = historyRows.filter(item => item.tab === tab)
    if (query.trim()) {
      const lower = query.toLowerCase()
      rows = rows.filter(item => item.type.toLowerCase().includes(lower) || item.market.toLowerCase().includes(lower) || item.referenceNumber.toLowerCase().includes(lower))
    }
    if (status !== 'all') {
      rows = rows.filter(item => item.status === status)
    }
    if (fromDate) {
      const from = new Date(fromDate).getTime()
      rows = rows.filter(item => item.date >= from)
    }
    if (toDate) {
      const to = new Date(toDate).getTime() + 86399999
      rows = rows.filter(item => item.date <= to)
    }
    rows = [...rows].sort((a, b) => {
      if (sortKey === 'date') return sortDirection === 'desc' ? b.date - a.date : a.date - b.date
      if (sortKey === 'amount') return sortDirection === 'desc' ? b.amount - a.amount : a.amount - b.amount
      const cmp = a.status.localeCompare(b.status)
      return sortDirection === 'desc' ? -cmp : cmp
    })
    return rows
  }, [historyRows, tab, query, status, fromDate, toDate, sortKey, sortDirection])

  const pageSize = 8
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const visibleRows = filtered.slice((page - 1) * pageSize, page * pageSize)

  useEffect(() => setPage(1), [tab, query, status, fromDate, toDate, sortKey, sortDirection])

  return (
    <div style={modalShell} role="dialog" aria-label="Transaction history" aria-modal="true">
      <div style={{ padding: '16px 18px', borderBottom: '1px solid rgba(167,139,250,0.22)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={panelTitleStyle}>History</h2>
        <button className="nav-feature-close" onClick={onClose}>Close</button>
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {([
            ['trades', 'Trades'],
            ['deposits', 'Deposits'],
            ['withdrawals', 'Withdrawals'],
            ['transfers', 'Transfers'],
            ['login', 'Login Activity'],
          ] as [HistoryTab, string][]).map(([value, label]) => (
            <button key={value} className={`nav-chip-btn ${tab === value ? 'active' : ''}`} onClick={() => setTab(value)}>{label}</button>
          ))}
        </div>

        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
          <input className="field-input" placeholder="Search by type, market, reference" value={query} onChange={event => setQuery(event.target.value)} />
          <select className="field-input" value={status} onChange={event => setStatus(event.target.value)}>
            <option value="all">All status</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="rejected">Rejected</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
          </select>
          <input className="field-input" type="date" value={fromDate} onChange={event => setFromDate(event.target.value)} />
          <input className="field-input" type="date" value={toDate} onChange={event => setToDate(event.target.value)} />
        </div>

        <HistoryTable rows={visibleRows} formatUsdValue={formatUsdValue} />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, alignItems: 'center' }}>
          <button className="nav-feature-secondary" onClick={() => setPage(current => Math.max(1, current - 1))} disabled={page <= 1}>Prev</button>
          <span style={{ color: '#C4B5FD', fontSize: 12 }}>Page {page} / {totalPages}</span>
          <button className="nav-feature-secondary" onClick={() => setPage(current => Math.min(totalPages, current + 1))} disabled={page >= totalPages}>Next</button>
        </div>
      </div>
    </div>
  )
}

function AiPanel({ onClose }: { onClose: () => void }) {
  const { aiMessages, aiTyping, sendAiPrompt } = useTopNav()
  const [prompt, setPrompt] = useState('')
  const [minimized, setMinimized] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const move = (event: MouseEvent) => {
      if (!dragStartRef.current) return
      setPosition({ x: event.clientX - dragStartRef.current.x, y: event.clientY - dragStartRef.current.y })
    }
    const up = () => { dragStartRef.current = null }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
  }, [])

  const startDrag = (event: ReactMouseEvent<HTMLDivElement>) => {
    dragStartRef.current = { x: event.clientX - position.x, y: event.clientY - position.y }
  }

  return (
    <div style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 120, transform: `translate(${position.x}px, ${position.y}px)` }}>
      <div style={{ width: minimized ? 270 : 360, borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(167,139,250,0.34)', background: '#18112D' }}>
        <div onMouseDown={startDrag} style={{ cursor: 'grab', userSelect: 'none', padding: '10px 12px', borderBottom: '1px solid rgba(167,139,250,0.24)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <strong style={{ color: '#EDE9FE', fontSize: 13 }}>AI Assistant</strong>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="nav-feature-icon" onClick={() => setMinimized(value => !value)}>{minimized ? '□' : '_'}</button>
            <button className="nav-feature-icon" onClick={onClose}>×</button>
          </div>
        </div>
        {!minimized && (
          <>
            <div style={{ maxHeight: 250, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {aiMessages.map(message => (
                <div key={message.id} style={{ alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '88%', padding: '8px 10px', borderRadius: 10, background: message.role === 'user' ? 'rgba(124,58,237,0.28)' : 'rgba(109,40,217,0.14)', color: '#EDE9FE', fontSize: 12 }}>
                  {message.text}
                </div>
              ))}
              {aiTyping && <div style={{ fontSize: 12, color: '#C4B5FD' }}>Assistant is typing...</div>}
            </div>
            <div style={{ padding: 10, borderTop: '1px solid rgba(167,139,250,0.24)', display: 'flex', gap: 8 }}>
              <input className="field-input" style={{ flex: 1 }} value={prompt} onChange={event => setPrompt(event.target.value)} placeholder="Ask about indicators, markets, education..." />
              <button className="nav-feature-primary" style={{ padding: '8px 12px', borderRadius: 10, minWidth: 80 }} onClick={() => { const text = prompt.trim(); if (!text) return; setPrompt(''); void sendAiPrompt(text) }}>Send</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function ChatPanel({ onClose }: { onClose: () => void }) {
  const { chatMessages, sendSupportMessage, chatAgentOnline, loadingStates, unreadChat, supportCategory, setSupportCategory } = useTopNav()
  const [text, setText] = useState('')
  const [search, setSearch] = useState('')

  const filteredMessages = useMemo(() => {
    if (!search.trim()) return chatMessages
    const q = search.toLowerCase()
    return chatMessages.filter(message => message.text.toLowerCase().includes(q) || (message.attachmentName || '').toLowerCase().includes(q))
  }, [chatMessages, search])

  return (
    <aside style={{ position: 'fixed', top: 36, right: 0, width: 'min(420px, 100vw)', height: 'calc(100vh - 36px)', background: '#120E24', borderLeft: '1px solid rgba(167,139,250,0.26)', zIndex: 115 }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(167,139,250,0.22)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <strong style={{ color: '#EDE9FE' }}>Live Chat</strong>
          <div style={{ fontSize: 12, color: chatAgentOnline ? '#22C55E' : '#F59E0B' }}>{chatAgentOnline ? 'Agent online' : 'Leave us a message'}</div>
        </div>
        <button className="nav-feature-close" onClick={onClose}>Close</button>
      </div>

      <div style={{ padding: 10, display: 'grid', gap: 8, borderBottom: '1px solid rgba(167,139,250,0.18)' }}>
        <input className="field-input" placeholder="Search conversations" value={search} onChange={event => setSearch(event.target.value)} />
        <select className="field-input" value={supportCategory} onChange={event => setSupportCategory(event.target.value)}>
          <option>General</option>
          <option>Deposits</option>
          <option>Withdrawals</option>
          <option>Trading</option>
        </select>
      </div>

      <div style={{ height: 'calc(100% - 180px)', overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filteredMessages.map(message => (
          <div key={message.id} style={{ alignSelf: message.by === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%', background: message.by === 'user' ? 'rgba(124,58,237,0.26)' : message.by === 'agent' ? 'rgba(167,139,250,0.18)' : 'rgba(148,163,184,0.18)', borderRadius: 10, padding: '8px 10px', color: '#F5F3FF', fontSize: 12 }}>
            {message.text}
            <div style={{ marginTop: 4, fontSize: 10, color: '#C4B5FD' }}>{formatDate(message.timestamp)}</div>
          </div>
        ))}
      </div>

      <div style={{ borderTop: '1px solid rgba(167,139,250,0.22)', padding: 10, display: 'grid', gap: 8 }}>
        <div style={{ fontSize: 11, color: '#C4B5FD' }}>{unreadChat} unread</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="field-input" style={{ flex: 1 }} value={text} onChange={event => setText(event.target.value)} placeholder={chatAgentOnline ? 'Type your message' : 'Leave us a message'} />
          <button className="nav-feature-primary" style={{ minWidth: 92 }} onClick={() => { const msg = text.trim(); if (!msg) return; setText(''); void sendSupportMessage(msg) }} disabled={loadingStates.chatSend}>{loadingStates.chatSend ? 'Sending...' : 'Send'}</button>
        </div>
      </div>
    </aside>
  )
}

function LearnPanel({ onClose }: { onClose: () => void }) {
  const { lessons, markLessonCompleted, toggleLessonBookmark } = useTopNav()
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => lessons.filter(item => !query.trim() || item.title.toLowerCase().includes(query.toLowerCase()) || item.section.toLowerCase().includes(query.toLowerCase())), [lessons, query])

  return (
    <div style={modalShell} role="dialog" aria-label="Learning center" aria-modal="true">
      <div style={{ padding: '16px 18px', borderBottom: '1px solid rgba(167,139,250,0.22)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={panelTitleStyle}>How To Trade</h2>
        <button className="nav-feature-close" onClick={onClose}>Close</button>
      </div>
      <div style={{ padding: 16, display: 'grid', gap: 10 }}>
        <input className="field-input" placeholder="Search lessons" value={query} onChange={event => setQuery(event.target.value)} />
        <div style={{ maxHeight: 430, overflowY: 'auto', display: 'grid', gap: 8 }}>
          {filtered.map(item => (
            <div key={item.id} style={{ border: '1px solid rgba(167,139,250,0.2)', borderRadius: 12, padding: 12, display: 'grid', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong style={{ color: '#EDE9FE', fontSize: 14 }}>{item.title}</strong>
                <button className="nav-feature-icon" onClick={() => toggleLessonBookmark(item.id)}>{item.bookmarked ? '★' : '☆'}</button>
              </div>
              <div style={{ fontSize: 12, color: '#C4B5FD' }}>{item.section} · {item.duration} · {item.difficulty}</div>
              {!item.completed && <button className="nav-feature-secondary" onClick={() => markLessonCompleted(item.id)}>Mark complete</button>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function NotificationsPanel({ onClose }: { onClose: () => void }) {
  const { notifications, markAllNotificationsRead, deleteNotification } = useTopNav()
  const [category, setCategory] = useState<'all' | NotificationCategory>('all')
  const [visibleCount, setVisibleCount] = useState(12)

  const visible = useMemo(() => {
    const filtered = category === 'all' ? notifications : notifications.filter(item => item.category === category)
    return filtered.slice(0, visibleCount)
  }, [category, notifications, visibleCount])

  return (
    <aside style={{ position: 'fixed', top: 36, right: 0, width: 'min(420px, 100vw)', height: 'calc(100vh - 36px)', background: '#120E24', borderLeft: '1px solid rgba(167,139,250,0.26)', zIndex: 115 }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(167,139,250,0.22)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ color: '#EDE9FE' }}>Notifications</strong>
        <button className="nav-feature-close" onClick={onClose}>Close</button>
      </div>
      <div style={{ padding: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {(['all', 'trades', 'deposits', 'withdrawals', 'system', 'news', 'promotions'] as const).map(value => (
          <button key={value} className={`nav-chip-btn ${category === value ? 'active' : ''}`} onClick={() => setCategory(value)}>{value}</button>
        ))}
      </div>
      <div style={{ padding: '8px 10px' }}>
        <button className="nav-feature-secondary" onClick={markAllNotificationsRead}>Mark All Read</button>
      </div>
      <div style={{ height: 'calc(100% - 132px)', overflowY: 'auto' }}>
        {visible.map(item => (
          <div key={item.id} style={{ padding: '10px 12px', borderTop: '1px solid rgba(167,139,250,0.13)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: 12, color: '#EDE9FE' }}>{item.title}</strong>
              <button className="nav-feature-icon" onClick={() => deleteNotification(item.id)}>×</button>
            </div>
            <div style={{ marginTop: 4, fontSize: 12, color: '#C4B5FD' }}>{item.description}</div>
          </div>
        ))}
        {visibleCount < notifications.length && <div style={{ padding: 12, textAlign: 'center' }}><button className="nav-feature-secondary" onClick={() => setVisibleCount(current => current + 12)}>Load more</button></div>}
      </div>
    </aside>
  )
}

function Toasts() {
  const { toasts, dismissToast } = useTopNav()
  return (
    <div style={{ position: 'fixed', right: 14, top: 46, zIndex: 130, display: 'grid', gap: 8, width: 320 }}>
      {toasts.map(toast => (
        <div key={toast.id} style={{ borderRadius: 10, border: '1px solid rgba(167,139,250,0.25)', background: '#1A1331', padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: toast.type === 'success' ? '#22C55E' : toast.type === 'error' ? '#EF4444' : '#DDD6FE' }}>
          <span style={{ fontSize: 12 }}>{toast.message}</span>
          <button className="nav-feature-icon" onClick={() => dismissToast(toast.id)}>×</button>
        </div>
      ))}
    </div>
  )
}

export default function TopNavPanels({ onClose }: Props) {
  const { panel } = useTopNav()

  useEffect(() => {
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [onClose])

  const showOverlay = panel === 'withdraw' || panel === 'history' || panel === 'learn' || panel === 'deposit'

  if (panel === 'none') {
    return <Toasts />
  }

  return (
    <>
      <Toasts />
      {showOverlay && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(9,7,18,0.7)', backdropFilter: 'blur(2px)', zIndex: 112, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }} onClick={onClose}>
          <div onClick={event => event.stopPropagation()}>
            {panel === 'withdraw' && <WithdrawPanel onClose={onClose} />}
            {panel === 'history' && <HistoryPanel onClose={onClose} />}
            {panel === 'learn' && <LearnPanel onClose={onClose} />}
            {panel === 'deposit' && <DepositPanel onClose={onClose} />}
          </div>
        </div>
      )}
      {panel === 'ai' && <AiPanel onClose={onClose} />}
      {panel === 'chat' && <ChatPanel onClose={onClose} />}
      {panel === 'notifications' && <NotificationsPanel onClose={onClose} />}
    </>
  )
}

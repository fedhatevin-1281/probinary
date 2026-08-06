import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Page } from '../App'
import TopNavPanels from './TopNavPanels'
import { useTopNav, type HeaderPanel } from '../state/topNav'
import { useAnimatedNumber } from '../hooks/useAnimatedNumber'

const NAV_ITEMS: { id: Page; label: string; icon: ReactNode }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <GridIcon /> },
  { id: 'markets', label: 'Markets', icon: <ChartBarIcon /> },
  { id: 'terminal', label: 'Trade', icon: <TrendingIcon /> },
  { id: 'portfolio', label: 'Portfolio', icon: <PieIcon /> },
  { id: 'analytics', label: 'Analytics', icon: <LineChartIcon /> },
  { id: 'wallet', label: 'Wallet', icon: <WalletIcon /> },
  { id: 'leaderboard', label: 'Leaderboard', icon: <TrophyIcon /> },
]

const BOTTOM_ITEMS: { id: Page; label: string; icon: ReactNode }[] = [
  { id: 'settings', label: 'Settings', icon: <SettingsIcon /> },
]

interface Props {
  currentPage: Page
  onNavigate: (p: Page) => void
  children: ReactNode
}

export default function Layout({ currentPage, onNavigate, children }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [balanceMenuOpen, setBalanceMenuOpen] = useState(false)
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false)
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window === 'undefined' ? 1280 : window.innerWidth))
  const profileRef = useRef<HTMLDivElement | null>(null)
  const balanceRef = useRef<HTMLDivElement | null>(null)

  const {
    panel,
    setPanel,
    balances,
    activeAccount,
    setActiveAccount,
    balancePulse,
    unreadNotifications,
    unreadChat,
    backendOnline,
    loadingStates,
    refreshBalances,
    addNotification,
    formatUsdValue,
  } = useTopNav()

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const closeMenus = (event: MouseEvent) => {
      const target = event.target as Node
      if (profileRef.current && !profileRef.current.contains(target)) {
        setProfileOpen(false)
      }
      if (balanceRef.current && !balanceRef.current.contains(target)) {
        setBalanceMenuOpen(false)
      }
    }

    window.addEventListener('mousedown', closeMenus)
    return () => window.removeEventListener('mousedown', closeMenus)
  }, [])

  const openPanel = (nextPanel: HeaderPanel) => {
    setMobileActionsOpen(false)
    setPanel(panel === nextPanel ? 'none' : nextPanel)
  }

  const isMobile = viewportWidth <= 900
  const hideSidebar = viewportWidth <= 1120
  const accountBalance = activeAccount === 'real' ? balances.real : balances.demo
  const animatedAccountBalance = useAnimatedNumber(accountBalance, 320)
  const accountCode = activeAccount === 'real' ? 'R' : 'D'
  const accountLabel = activeAccount === 'real' ? 'REAL' : 'DEMO'

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#09090F', overflow: 'hidden', position: 'relative' }}>
      {/* Sidebar */}
      <aside style={{
        width: hideSidebar ? 0 : collapsed ? 64 : 220,
        flexShrink: 0,
        background: '#12121A',
        borderRight: '1px solid rgba(255,255,255,0.05)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.25s ease',
        overflow: hideSidebar ? 'hidden' : 'hidden',
        zIndex: 20,
      }}>
        {/* Logo */}
        <div style={{ padding: '20px 14px 16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <img
            src="/logo.png"
            alt="Pro Binary logo"
            style={{ width: 32, height: 32, borderRadius: 9, objectFit: 'cover', flexShrink: 0, boxShadow: '0 0 16px rgba(124,58,237,0.35)' }}
          />
          {!collapsed && (
            <div>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 15, color: '#FFFFFF', letterSpacing: '-0.3px' }}>
                pro<span style={{ color: '#A855F7' }}>binary</span>
              </div>
              <div style={{ fontSize: 10, color: '#52525B', fontWeight: 500, letterSpacing: '0.05em' }}>TRADING</div>
            </div>
          )}
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 3, overflowY: 'auto' }}>
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`sidebar-item ${currentPage === item.id ? 'active' : ''}`}
              style={{ justifyContent: collapsed ? 'center' : 'flex-start', width: '100%', background: 'none', border: 'none' }}
              title={collapsed ? item.label : undefined}
            >
              <span style={{ flexShrink: 0, display: 'flex' }}>{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </button>
          ))}
        </nav>

        {/* Bottom items */}
        <div style={{ padding: '10px 10px 16px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          {BOTTOM_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`sidebar-item ${currentPage === item.id ? 'active' : ''}`}
              style={{ justifyContent: collapsed ? 'center' : 'flex-start', width: '100%', background: 'none', border: 'none' }}
            >
              <span style={{ flexShrink: 0, display: 'flex' }}>{item.icon}</span>
              {!collapsed && <span>Settings</span>}
            </button>
          ))}

          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed(c => !c)}
            className="sidebar-item"
            style={{ justifyContent: collapsed ? 'center' : 'flex-start', width: '100%', background: 'none', border: 'none', marginTop: 4 }}
          >
            <span style={{ flexShrink: 0, display: 'flex', transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.25s' }}>
              <ChevronLeftIcon />
            </span>
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top Nav */}
        <header className="glass-nav" style={{ height: 40, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 10px', gap: 9, zIndex: 10, background: 'linear-gradient(90deg, #23113A 0%, #2D1450 55%, #261245 100%)', borderBottom: '1px solid rgba(167,139,250,0.28)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            {hideSidebar && (
              <button className="nav-icon-btn" aria-label="Toggle menu" title="Menu" onClick={() => setMobileActionsOpen(value => !value)}>
                <MenuIcon />
              </button>
            )}

            {!isMobile && (
              <>
                <HeaderActionButton label="Withdraw" icon={<WithdrawIcon />} onClick={() => openPanel('withdraw')} active={panel === 'withdraw'} />
                <HeaderActionButton label="History" icon={<HistorySmallIcon />} onClick={() => openPanel('history')} active={panel === 'history'} />
                <HeaderChip accent label="AI" icon={<AiSparkIcon />} onClick={() => openPanel('ai')} active={panel === 'ai'} ariaLabel="Open AI Assistant" />
                <HeaderChip label={`Live Chat${unreadChat ? ` (${unreadChat})` : ''}`} icon={<ChatSmallIcon />} onClick={() => openPanel('chat')} active={panel === 'chat'} ariaLabel="Open live support chat" />
                <HeaderChip label="How to Trade" icon={<BookSmallIcon />} onClick={() => openPanel('learn')} active={panel === 'learn'} ariaLabel="Open learning center" />
              </>
            )}

            {isMobile && (
              <button className="nav-feature-secondary" onClick={() => setMobileActionsOpen(value => !value)} aria-label="Open quick actions" style={{ padding: '5px 8px', borderRadius: 8, fontSize: 11 }}>
                Actions
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
            <div ref={balanceRef} style={{ position: 'relative' }}>
              <button
                aria-label="Open balance account selector"
                aria-expanded={balanceMenuOpen}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'rgba(46,16,101,0.42)',
                  border: '1px solid rgba(167,139,250,0.4)',
                  borderRadius: 14,
                  color: '#F8FAFC',
                  padding: '6px 9px',
                  cursor: 'pointer',
                  minWidth: 92,
                }}
                onClick={() => setBalanceMenuOpen(value => !value)}
              >
                <span style={{ width: 19, height: 19, borderRadius: '50%', background: '#C084FC', color: '#2E1065', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, fontFamily: "'Inter', sans-serif" }}>{accountCode}</span>
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.08 }}>
                  <span style={{ fontSize: 9, color: '#C4B5FD', fontWeight: 700, letterSpacing: '0.04em' }}>{accountLabel}</span>
                  <span className={`font-mono-data ${balancePulse ? 'nav-balance-pulse' : ''}`} style={{ fontSize: 11, fontWeight: 600 }}>{formatUsdValue(animatedAccountBalance)}</span>
                </span>
                <ChevronDownMini />
              </button>

              {balanceMenuOpen && (
                <div style={{ position: 'absolute', top: 33, right: 0, width: 182, borderRadius: 11, border: '1px solid rgba(167,139,250,0.3)', background: '#170F2B', padding: 8, display: 'grid', gap: 7, zIndex: 30 }}>
                  <button className={`nav-feature-secondary ${activeAccount === 'real' ? 'active' : ''}`} onClick={() => setActiveAccount('real')}>
                    REAL · {formatUsdValue(balances.real)}
                  </button>
                  <button className={`nav-feature-secondary ${activeAccount === 'demo' ? 'active' : ''}`} onClick={() => setActiveAccount('demo')}>
                    DEMO · {formatUsdValue(balances.demo)}
                  </button>
                  <button className="nav-feature-secondary" disabled={loadingStates.refreshBalances} onClick={() => void refreshBalances()}>
                    {loadingStates.refreshBalances ? 'Refreshing...' : `Refresh (${backendOnline ? 'Online' : 'Offline'})`}
                  </button>
                </div>
              )}
            </div>

            <button
              aria-label="Open deposit panel"
              style={{
                padding: '7px 14px',
                borderRadius: 10,
                border: 'none',
                cursor: 'pointer',
                background: 'linear-gradient(135deg, #7C3AED, #A855F7)',
                color: '#F5F3FF',
                fontFamily: "'Inter', sans-serif",
                fontSize: 17,
                fontWeight: 700,
                lineHeight: 1,
              }}
              onClick={() => openPanel('deposit')}
            >
              Deposit
            </button>

            <button className="nav-icon-btn" title="Notifications" aria-label="Open notifications" onClick={() => openPanel('notifications')} style={{ position: 'relative', color: '#C4B5FD', width: 26, height: 26, borderRadius: 8 }}>
              <BellIcon />
              {unreadNotifications > 0 && (
                <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 13, height: 13, borderRadius: 99, background: '#EF4444', color: '#FFF', fontSize: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>
                  {unreadNotifications > 9 ? '9+' : unreadNotifications}
                </span>
              )}
            </button>

            <div ref={profileRef} style={{ position: 'relative' }}>
              <button className="nav-icon-btn" title="Account" aria-label="Open profile menu" aria-expanded={profileOpen} style={{ color: '#C4B5FD', width: 26, height: 26, borderRadius: 8 }} onClick={() => setProfileOpen(value => !value)}>
                <UserCircleIcon />
              </button>

              {profileOpen && (
                <div style={{ position: 'absolute', right: 0, top: 33, width: 154, borderRadius: 11, border: '1px solid rgba(167,139,250,0.32)', background: '#170F2B', padding: 7, display: 'grid', gap: 5, zIndex: 35 }} role="menu" aria-label="Profile menu">
                  <ProfileMenuButton label="Dashboard" onClick={() => { onNavigate('dashboard'); setProfileOpen(false) }} />
                  <ProfileMenuButton label="My Profile" onClick={() => { setPanel('history'); setProfileOpen(false) }} />
                  <ProfileMenuButton label="Security" onClick={() => { setPanel('notifications'); setProfileOpen(false) }} />
                  <ProfileMenuButton label="Wallet" onClick={() => { onNavigate('wallet'); setProfileOpen(false) }} />
                  <ProfileMenuButton label="Settings" onClick={() => { onNavigate('settings'); setProfileOpen(false) }} />
                  <ProfileMenuButton label="Logout" onClick={() => {
                    addNotification({ category: 'system', icon: 'logout', title: 'Session ended', description: 'You have logged out of this session.' })
                    setProfileOpen(false)
                    onNavigate('dashboard')
                  }} />
                </div>
              )}
            </div>
          </div>
        </header>

        {mobileActionsOpen && (
          <div style={{ borderBottom: '1px solid rgba(167,139,250,0.2)', background: '#150F29', padding: 8, display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            <button className="nav-chip-btn" onClick={() => openPanel('withdraw')}>Withdraw</button>
            <button className="nav-chip-btn" onClick={() => openPanel('history')}>History</button>
            <button className="nav-chip-btn" onClick={() => openPanel('ai')}>AI</button>
            <button className="nav-chip-btn" onClick={() => openPanel('chat')}>Live Chat</button>
            <button className="nav-chip-btn" onClick={() => openPanel('learn')}>How to Trade</button>
            <button className="nav-chip-btn" onClick={() => openPanel('deposit')}>Deposit</button>
          </div>
        )}

        {/* Page content */}
        <main style={{ flex: 1, overflow: 'auto', background: '#09090F' }}>
          {children}
        </main>
      </div>

      <TopNavPanels onClose={() => setPanel('none')} />
    </div>
  )
}

function HeaderActionButton({ label, icon, onClick, active }: { label: string; icon: ReactNode; onClick: () => void; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={active ? 'nav-header-action active' : 'nav-header-action'}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', color: '#DDD6FE', fontSize: 15, padding: '6px 5px', cursor: 'pointer', fontFamily: "'Inter', sans-serif", fontWeight: 500 }}
    >
      {icon}
      <span style={{ fontSize: 15 }}>{label}</span>
    </button>
  )
}

function ProfileMenuButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="nav-feature-secondary" style={{ justifyContent: 'flex-start' }} role="menuitem">
      {label}
    </button>
  )
}

function HeaderChip({ label, icon, accent = false, onClick, active, ariaLabel }: { label: string; icon: ReactNode; accent?: boolean; onClick?: () => void; active?: boolean; ariaLabel?: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel || label}
      title={label}
      className={active ? 'nav-chip-btn active' : undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        borderRadius: 9,
        border: accent ? 'none' : active ? '1px solid rgba(196,181,253,0.8)' : '1px solid rgba(167,139,250,0.35)',
        padding: '6px 10px',
        cursor: 'pointer',
        background: accent ? 'linear-gradient(135deg, #7C3AED, #A855F7)' : active ? 'rgba(109,40,217,0.4)' : 'rgba(109,40,217,0.18)',
        color: accent ? '#F5F3FF' : '#EDE9FE',
        fontFamily: "'Inter', sans-serif",
        fontSize: 15,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

function MenuIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
    </svg>
  )
}

/* Icon components */
function GridIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  )
}

function ChartBarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 3v18h18" strokeLinecap="round" />
      <path d="M7 16l4-5 4 3 4-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function TrendingIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 17l5-5 4 4 9-9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 7h6v6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PieIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M21.21 15.89A10 10 0 1 1 8 2.83" strokeLinecap="round" />
      <path d="M22 12A10 10 0 0 0 12 2v10z" />
    </svg>
  )
}

function LineChartIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 3v18h18" strokeLinecap="round" />
      <rect x="7" y="10" width="3" height="8" rx="1" />
      <rect x="12" y="6" width="3" height="12" rx="1" />
      <rect x="17" y="13" width="3" height="5" rx="1" />
    </svg>
  )
}

function WalletIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="2" y="5" width="20" height="14" rx="3" />
      <path d="M16 13a1 1 0 1 0 2 0 1 1 0 0 0-2 0z" fill="currentColor" />
      <path d="M2 9h20" strokeLinecap="round" />
    </svg>
  )
}

function TrophyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M8 21h8M12 17v4" strokeLinecap="round" />
      <path d="M5 3h14v9a7 7 0 0 1-14 0V3z" />
      <path d="M5 6H2a1 1 0 0 0-1 1v2a4 4 0 0 0 4 4M19 6h3a1 1 0 0 1 1 1v2a4 4 0 0 1-4 4" strokeLinecap="round" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" strokeLinecap="round" />
    </svg>
  )
}

function ChevronLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SearchIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
    </svg>
  )
}

function WithdrawIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 4v13" strokeLinecap="round" /><path d="M7 9l5-5 5 5" strokeLinecap="round" strokeLinejoin="round" /><path d="M5 20h14" strokeLinecap="round" /></svg>
}

function HistorySmallIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 12a9 9 0 1 0 3-6.7" strokeLinecap="round" /><path d="M3 4v5h5" strokeLinecap="round" strokeLinejoin="round" /><path d="M12 7v5l3 2" strokeLinecap="round" /></svg>
}

function AiSparkIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3l1.4 3.6L17 8l-3.6 1.4L12 13l-1.4-3.6L7 8l3.6-1.4L12 3z" strokeLinejoin="round" /><path d="M5 14l.8 2.2L8 17l-2.2.8L5 20l-.8-2.2L2 17l2.2-.8L5 14z" strokeLinejoin="round" /><path d="M18.5 13.5l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7.7-1.9z" strokeLinejoin="round" /></svg>
}

function ChatSmallIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 11a8 8 0 0 1-8 8H7l-4 3 1.3-4.2A8 8 0 1 1 20 11z" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

function BookSmallIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15z" strokeLinecap="round" strokeLinejoin="round" /><path d="M8 7h8M8 11h8" strokeLinecap="round" /></svg>
}

function ChevronDownMini() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

function UserCircleIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="3.2" /><path d="M5 19a7 7 0 0 1 14 0" strokeLinecap="round" /></svg>
}

function BellIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" />
    </svg>
  )
}

function MessageIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

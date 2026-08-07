import { useState } from 'react'
import Landing from './pages/Landing'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Terminal from './pages/Terminal'
import Markets from './pages/Markets'
import { TradingProvider } from './state/trading'
import { TopNavProvider } from './state/topNav'
import Wallet from './pages/Wallet'
import SuperAdminConsole from './pages/SuperAdminConsole'

export type Page = 'dashboard' | 'terminal' | 'markets' | 'portfolio' | 'analytics' | 'wallet' | 'leaderboard' | 'settings'

const ACCESS_TOKEN_BY_LINK_KEY: Record<string, string> = {
  adminsim: 'sim-admin',
  superadmin: 'sim-super-admin',
}

function getLinkAccessKey() {
  if (typeof window === 'undefined') {
    return null
  }

  const params = new URLSearchParams(window.location.search)
  const queryKey = params.get('access') || params.get('role')
  if (queryKey) {
    return queryKey.trim().toLowerCase()
  }

  const pathKey = window.location.pathname.replace(/\/+$/g, '').split('/').filter(Boolean).pop()
  if (pathKey) {
    const normalizedPathKey = pathKey.trim().toLowerCase()
    if (normalizedPathKey === 'adminsim' || normalizedPathKey === 'superadmin') {
      return normalizedPathKey
    }
  }

  const hashKey = window.location.hash.replace(/^#\/?/, '').trim().toLowerCase()
  if (hashKey === 'adminsim' || hashKey === 'superadmin') {
    return hashKey
  }

  return null
}

function applyLinkAccessToken() {
  const accessKey = getLinkAccessKey()
  if (!accessKey) {
    return null
  }

  const token = ACCESS_TOKEN_BY_LINK_KEY[accessKey]
  if (!token) {
    return null
  }

  window.localStorage.setItem('pb.auth.token', token)
  return accessKey
}

export default function App() {
  const [accessMode] = useState<string | null>(() => applyLinkAccessToken())
  const [page, setPage] = useState<Page | null>(() => (accessMode ? 'terminal' : null))

  if (accessMode === 'superadmin') {
    return (
      <TradingProvider>
        <SuperAdminConsole />
      </TradingProvider>
    )
  }

  return (
    <TradingProvider>
      <TopNavProvider>
        {!page ? (
          <Landing onEnter={() => setPage('dashboard')} />
        ) : (
          <Layout currentPage={page} onNavigate={setPage}>
            {page === 'dashboard' && <Dashboard onTrade={() => setPage('terminal')} onMarkets={() => setPage('markets')} />}
            {page === 'terminal' && <Terminal />}
            {page === 'markets' && <Markets onTrade={() => setPage('terminal')} />}
            {page === 'wallet' && <Wallet />}
            {(page === 'portfolio' || page === 'analytics' || page === 'leaderboard' || page === 'settings') && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 16 }}>
                <div style={{ width: 64, height: 64, borderRadius: 18, background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#A855F7" strokeWidth="1.5"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round"/></svg>
                </div>
                <p className="font-display" style={{ color: '#A855F7', fontSize: 20, fontWeight: 600, margin: 0 }}>
                  {page.charAt(0).toUpperCase() + page.slice(1)}
                </p>
                <p style={{ color: '#52525B', fontSize: 14, margin: 0 }}>Coming soon — full module in progress</p>
              </div>
            )}
          </Layout>
        )}
      </TopNavProvider>
    </TradingProvider>
  )
}

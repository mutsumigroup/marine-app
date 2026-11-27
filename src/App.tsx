import { HashRouter as BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { useAppState } from './hooks/useAppState'
import Sidebar from './components/Sidebar'
import { LoadingSpinner, ToastContainer, useIsMobile } from './components/UI'
const Dashboard = lazy(() => import('./pages/Dashboard'))
const DailyForm = lazy(() => import('./pages/DailyForm'))
const ReportsList = lazy(() => import('./pages/ReportsList'))
const Sales = lazy(() => import('./pages/Sales'))
const Invoices = lazy(() => import('./pages/Invoices'))
const Payments = lazy(() => import('./pages/Payments'))
import Annual from './pages/Annual'
const SettingsPage = lazy(() => import('./pages/Settings'))
import KyForm from './pages/KyForm'
import TransportForm from './pages/TransportForm'
import DailyMenu from './pages/DailyMenu'
import TransportList from './pages/TransportList'
import KyList from './pages/KyList'
import PortMasterPage from './pages/PortMasterPage'
const Changelog = lazy(() => import('./pages/Changelog'))
import { useState, lazy, Suspense } from 'react'

const PAGE_TITLES: Record<string, string> = {
  '/': 'ダッシュボード',
  '/daily': '日報作成',
  '/daily/ship': '船舶日報作成',
  '/reports': '日報一覧',
  '/sales': '売上管理',
  '/invoices': '請求書管理',
  '/payments': '入金管理',
  '/annual': '売上・目標管理',
  '/settings': '設定',
  '/ky/new': 'KY出発前報告',
  '/transport/new': '送迎日報作成',
  '/transport': '送迎日報一覧',
  '/ky': 'KY報告一覧',
  '/ports': '港マスター',
  '/changelog': '更新履歴',
}

function MobileHeader({ onMenu }: { onMenu: () => void }) {
  const location = useLocation()
  const title = PAGE_TITLES[location.pathname] ?? 'マリン業務'
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 400, height: 52, background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', boxShadow: 'var(--shadow)' }}>
      <button onClick={onMenu} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 5, padding: 4 }}>
        <span style={{ width: 20, height: 2, background: 'var(--text)', borderRadius: 2, display: 'block' }} />
        <span style={{ width: 20, height: 2, background: 'var(--text)', borderRadius: 2, display: 'block' }} />
        <span style={{ width: 20, height: 2, background: 'var(--text)', borderRadius: 2, display: 'block' }} />
      </button>
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>⚓ {title}</div>
    </div>
  )
}


const BOTTOM_NAV = [
  { path: '/', label: 'ホーム', icon: '⊞' },
  { path: '/daily', label: '日報作成', icon: '📝' },
  { path: '/reports', label: '日報一覧', icon: '📋' },
  { path: '/invoices', label: '請求書', icon: '🧾' },
  { path: '/settings', label: '設定', icon: '⚙️' },
]

function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const isActive = (path: string) => path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)
  return (
    <nav style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 200, display: 'flex', background: 'var(--surface)', borderTop: '1px solid var(--border)', paddingBottom: 'env(safe-area-inset-bottom)', boxShadow: '0 -2px 8px rgba(0,0,0,.06)' }}>
      {BOTTOM_NAV.map(item => {
        const active = isActive(item.path)
        return (
          <button key={item.path} onClick={() => navigate(item.path)}
            style={{ flex: 1, minHeight: 56, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, background: 'none', border: 'none', cursor: 'pointer', color: active ? 'var(--accent)' : 'var(--text-muted)', fontWeight: active ? 700 : 500, borderTop: active ? '2px solid var(--accent)' : '2px solid transparent' }}>
            <span style={{ fontSize: 20, lineHeight: 1 }}>{item.icon}</span>
            <span style={{ fontSize: 10 }}>{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

function AppInner() {
  const app = useAppState()
  const isMobile = useIsMobile()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(false)

  if (app.loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100dvh', gap: 16, background: '#f8fafc' }}>
      <LoadingSpinner />
      {app.loadSlow && (
        <div style={{ textAlign: 'center', animation: 'fadeIn 0.5s ease' }}>
          <div style={{ fontSize: 14, color: '#475569', fontWeight: 600 }}>サーバーを起動中です...</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>初回起動は最大1分かかる場合があります</div>
        </div>
      )}
    </div>
  )

  if (app.loadError) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100dvh', gap: 20, padding: 24, background: '#f8fafc', textAlign: 'center' }}>
      <div style={{ fontSize: 48 }}>⚠️</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#1e293b' }}>データの読み込みに失敗しました</div>
      <div style={{ fontSize: 13, color: '#64748b', maxWidth: 320, lineHeight: 1.6 }}>
        ネットワーク接続を確認してください。<br />
        サーバーが一時的に停止している可能性があります。
      </div>
      <div style={{ fontSize: 11, color: '#94a3b8', background: '#f1f5f9', borderRadius: 6, padding: '6px 12px', maxWidth: 360, wordBreak: 'break-all' }}>
        {app.loadError}
      </div>
      <button
        onClick={() => app.reload()}
        style={{ marginTop: 8, padding: '12px 32px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
        🔄 再読み込み
      </button>
    </div>
  )

  return (
    <div className={isMobile ? 'has-bottom-nav' : undefined} style={{ display: 'flex', height: '100dvh', overflow: 'hidden' }}>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} collapsed={!isMobile && desktopSidebarCollapsed} onToggle={() => setDesktopSidebarCollapsed(v => !v)} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {isMobile && <MobileHeader onMenu={() => setSidebarOpen(true)} />}
        <main style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingTop: isMobile ? 52 : 0 }}>
          <Suspense fallback={<div style={{display:'flex',justifyContent:'center',alignItems:'center',height:'60vh',color:'var(--text-muted)',fontSize:14}}>読み込み中...</div>}>
          <Routes>
            <Route path="/" element={<Dashboard reports={app.reports} invoices={app.invoices} settings={app.settings} reload={app.reload} onUpdateReport={app.updateReport} onDeleteReport={app.deleteReport} />} />
            <Route path="/daily" element={<DailyMenu />} />
            <Route path="/daily/ship" element={<DailyForm onSubmit={app.submitReport} pastReports={app.reports.map(r => ({ port: r.port, ship: r.ship }))} prices={app.settings.prices} customCategories={app.settings.custom_categories ?? []} />} />
            <Route path="/reports" element={<ReportsList reports={app.reports} onUpdateAmount={app.updateAmount} onSavePdf={app.savePdf} onUpdateReport={app.updateReport} onDeleteReport={app.deleteReport} prices={app.settings.prices} settings={app.settings} />} />
            <Route path="/sales" element={<Sales reports={app.reports} />} />
            <Route path="/invoices" element={<Invoices invoices={app.invoices} reports={app.reports} settings={app.settings} onSend={app.sendInvoice} onSendTransport={app.sendTransportInvoice} onSendCombined={app.sendCombinedInvoice} onPaidTransport={app.markTransportPaid} onRevertTransport={app.revertTransportInvoice} onPaid={app.markPaid} onRevert={app.revertInvoice} onUpdateInvoice={app.updateInvoiceManual} />} />
            <Route path="/payments" element={<Payments invoices={app.invoices} onPaid={app.markPaid} />} />
            <Route path="/annual" element={<Annual reports={app.reports} invoices={app.invoices} settings={app.settings} />} />
            <Route path="/settings" element={<SettingsPage settings={app.settings} onSave={app.saveSettings} />} />
            <Route path="/transport/new" element={<TransportForm settings={app.settings} />} />
            <Route path="/transport" element={<TransportList />} />
            <Route path="/ky/new" element={<KyForm onSubmit={app.submitKyReport} portMasters={app.portMasters} pastReports={app.reports.map(r => ({ port: r.port, ship: r.ship }))} operatorName={app.settings.company_name} />} />
            <Route path="/ky" element={<KyList kyReports={app.kyReports} onDelete={app.deleteKyReport} />} />
            <Route path="/ports" element={<PortMasterPage portMasters={app.portMasters} onSave={app.savePortMaster} onDelete={app.deletePortMasterById} />} />
            <Route path="/changelog" element={<Changelog />} />
          </Routes>
          </Suspense>
        </main>
      </div>
      {isMobile && <BottomNav />}
      <ToastContainer toasts={app.toasts} remove={app.removeToast} />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  )
}

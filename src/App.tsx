import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { useAppState } from './hooks/useAppState'
import Sidebar from './components/Sidebar'
import { LoadingSpinner, ToastContainer, useIsMobile } from './components/UI'
import Dashboard from './pages/Dashboard'
import DailyForm from './pages/DailyForm'
import ReportsList from './pages/ReportsList'
import Sales from './pages/Sales'
import Invoices from './pages/Invoices'
import Payments from './pages/Payments'
import Annual from './pages/Annual'
import SettingsPage from './pages/Settings'
import { useState } from 'react'

const PAGE_TITLES: Record<string, string> = {
  '/': 'ダッシュボード',
  '/daily': '日報作成',
  '/reports': '日報一覧',
  '/sales': '売上管理',
  '/invoices': '請求書管理',
  '/payments': '入金管理',
  '/annual': '売上・目標管理',
  '/settings': '設定',
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

function AppInner() {
  const app = useAppState()
  const isMobile = useIsMobile()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  if (app.loading) return <LoadingSpinner />

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {isMobile && <MobileHeader onMenu={() => setSidebarOpen(true)} />}
        <main style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingTop: isMobile ? 52 : 0 }}>
          <Routes>
            <Route path="/" element={<Dashboard reports={app.reports} invoices={app.invoices} settings={app.settings} reload={app.reload} />} />
            <Route path="/daily" element={<DailyForm onSubmit={app.submitReport} pastReports={app.reports.map(r => ({ port: r.port, ship: r.ship }))} prices={app.settings.prices} />} />
            <Route path="/reports" element={<ReportsList reports={app.reports} onUpdateAmount={app.updateAmount} onSavePdf={app.savePdf} onUpdateReport={app.updateReport} onDeleteReport={app.deleteReport} prices={app.settings.prices} />} />
            <Route path="/sales" element={<Sales reports={app.reports} />} />
            <Route path="/invoices" element={<Invoices invoices={app.invoices} reports={app.reports} settings={app.settings} onSend={app.sendInvoice} onPaid={app.markPaid} onRevert={app.revertInvoice} onUpdateInvoice={app.updateInvoiceManual} />} />
            <Route path="/payments" element={<Payments invoices={app.invoices} onPaid={app.markPaid} />} />
            <Route path="/annual" element={<Annual reports={app.reports} invoices={app.invoices} settings={app.settings} />} />
            <Route path="/settings" element={<SettingsPage settings={app.settings} onSave={app.saveSettings} />} />
          </Routes>
        </main>
      </div>
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

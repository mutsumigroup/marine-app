import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useAppState } from './hooks/useAppState'
import Sidebar from './components/Sidebar'
import { LoadingSpinner, ToastContainer } from './components/UI'
import Dashboard from './pages/Dashboard'
import DailyForm from './pages/DailyForm'
import ReportsList from './pages/ReportsList'
import Sales from './pages/Sales'
import Invoices from './pages/Invoices'
import Payments from './pages/Payments'
import Annual from './pages/Annual'
import SettingsPage from './pages/Settings'

export default function App() {
  const app = useAppState()

  if (app.loading) return <LoadingSpinner />

  return (
    <BrowserRouter>
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        <Sidebar />
        <main style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          <Routes>
            <Route path="/" element={
              <Dashboard reports={app.reports} invoices={app.invoices} settings={app.settings} reload={app.reload} />
            } />
            <Route path="/daily" element={
              <DailyForm onSubmit={app.submitReport} pastReports={app.reports.map(r => ({ port: r.port, ship: r.ship }))} prices={app.settings.prices} />
            } />
            <Route path="/reports" element={
              <ReportsList reports={app.reports} onUpdateAmount={app.updateAmount} onSavePdf={app.savePdf} onUpdateReport={app.updateReport} onDeleteReport={app.deleteReport} prices={app.settings.prices} />
            } />
            <Route path="/sales" element={
              <Sales reports={app.reports} />
            } />
            <Route path="/invoices" element={
              <Invoices invoices={app.invoices} reports={app.reports} settings={app.settings}
                onSend={app.sendInvoice} onPaid={app.markPaid} onRevert={app.revertInvoice} />
            } />
            <Route path="/payments" element={
              <Payments invoices={app.invoices} onPaid={app.markPaid} />
            } />
            <Route path="/annual" element={
              <Annual reports={app.reports} invoices={app.invoices} settings={app.settings} />
            } />
            <Route path="/settings" element={
              <SettingsPage settings={app.settings} onSave={app.saveSettings} />
            } />
          </Routes>
        </main>
      </div>
      <ToastContainer toasts={app.toasts} remove={app.removeToast} />
    </BrowserRouter>
  )
}

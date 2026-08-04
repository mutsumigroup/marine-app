import { useState, useEffect, useCallback } from 'react'
import type { Report, Invoice, Settings, Toast, KyReport, PortMaster } from '../types'
import * as api from '../lib/api'
import { sendEmail, buildDailyReportEmail, buildInvoiceEmail } from '../lib/email'

const DEFAULT_SETTINGS: Settings = {
  company_name: '',
  address: '',
  tel: '',
  email: '',
  invoice_no: '',
  pay_days: 30,
  bank: '',
  account: '',
  daily_mail: '',
  inv_mail: '',
  prices: {},
  fixed_expenses: [],
  client_name: '',
  client_email: '',
  client_annual_goal: 0,
}

export function useAppState() {
  const [reports, setReports] = useState<Report[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [kyReports, setKyReports] = useState<KyReport[]>([])
  const [portMasters, setPortMasters] = useState<PortMaster[]>([])
  const [loading, setLoading] = useState(true)
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((type: Toast['type'], message: string) => {
    const id = crypto.randomUUID()
    setToasts(prev => [...prev, { id, type, message }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000)
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [r, inv, s, ky, pm] = await Promise.all([
        api.fetchReports(),
        api.fetchInvoices(),
        api.fetchSettings(),
        api.fetchKyReports().catch(() => [] as KyReport[]),
        api.fetchPortMasters().catch(() => [] as PortMaster[]),
      ])
      setReports(r)
      setInvoices(inv)
      setSettings(s)
      setKyReports(ky)
      setPortMasters(pm)
    } catch (err) {
      addToast('error', `データの読み込みに失敗しました: ${(err as Error).message}`)
    } finally {
      setLoading(false)
    }
  }, [addToast])

  useEffect(() => { loadAll() }, [loadAll])

  const submitReport = useCallback(async (
    reportData: Omit<Report, 'id' | 'created_at' | 'updated_at'>
  ): Promise<boolean> => {
    try {
      const saved = await api.insertReport(reportData)
      const newReports = [saved, ...reports]
      setReports(newReports)

      const updatedInv = await api.syncInvoiceFromReport(reportData.bill_month, newReports)
      setInvoices(prev => {
        const exists = prev.find(i => i.id === updatedInv.id)
        return exists
          ? prev.map(i => i.id === updatedInv.id ? updatedInv : i)
          : [updatedInv, ...prev]
      })

      if (settings.daily_mail) {
        try {
          const annualUrl = `https://mutsumigroup.github.io/marine-app/#/reports?month=${reportData.bill_month}`
          const message = buildDailyReportEmail({
            date: reportData.date,
            port: reportData.port,
            ship: reportData.ship,
            crew: reportData.crew,
            category: reportData.category,
            work: reportData.work ?? '',
            amount: reportData.amount,
            park_fee: reportData.park_fee,
            hw_fee: reportData.hw_fee,
            meal: reportData.meal,
        hotel_fee: reportData.hotel_fee ?? 0,
        shinkansen_fee: reportData.shinkansen_fee ?? 0,
            expenses: reportData.expenses,
            voucher: reportData.voucher ?? '',
            bill_month: reportData.bill_month,
            notes: reportData.notes ?? '',
          }, annualUrl)
          await sendEmail({
            to_email: settings.daily_mail,
            subject: `【日報】${reportData.date} ${reportData.ship}`,
            message,
          })
          addToast('success', `日報を保存しました。${settings.daily_mail} へメール送信しました。売上・請求データを自動登録しました。`)
        } catch {
          addToast('info', '日報を保存しました。メール送信に失敗しました。売上・請求データを自動登録しました。')
        }
      } else {
        addToast('success', '日報を保存しました。売上・請求データを自動登録しました。')
      }
      return true
    } catch (err) {
      addToast('error', `保存失敗: ${(err as Error).message}`)
      return false
    }
  }, [reports, settings.daily_mail, addToast])

  const saveSettings = useCallback(async (newSettings: Settings): Promise<boolean> => {
    try {
      await api.updateSettings(newSettings)
      setSettings(newSettings)
      addToast('success', '設定を保存しました')
      return true
    } catch (err) {
      addToast('error', `保存失敗: ${(err as Error).message}`)
      return false
    }
  }, [addToast])

  const sendInvoice = useCallback(async (id: string): Promise<boolean> => {
    const inv = invoices.find(i => i.id === id)
    if (!inv) return false
    try {
      const sentAt = new Date().toLocaleString('ja-JP')
      await api.updateInvoice(id, { status: '送信済', sent_at: sentAt })
      const targetReports = reports.filter(r => r.bill_month === inv.billing_month)
      await Promise.all(targetReports.map(r => api.updateReport(r.id, { invoiced: true })))
      setInvoices(prev => prev.map(i => i.id === id ? { ...i, status: '送信済', sent_at: sentAt } : i))
      setReports(prev => prev.map(r =>
        r.bill_month === inv.billing_month ? { ...r, invoiced: true } : r
      ))
      if (settings.client_email || settings.inv_mail) {
        try {
          const toEmail = settings.inv_mail || settings.client_email
          const message = buildInvoiceEmail(inv, settings.client_name)
          await sendEmail({
            to_email: toEmail,
            subject: `【請求書】${inv.billing_month}分 ${settings.client_name}`,
            message,
          })
          addToast('success', `請求書 ${id} を ${toEmail} へメール送信しました（${sentAt}）`)
        } catch {
          addToast('info', `ステータスを更新しました。メール送信に失敗しました。`)
        }
      } else {
        addToast('success', `請求書 ${id} のステータスを送信済みに更新しました（${sentAt}）`)
      }
      return true
    } catch (err) {
      addToast('error', `送信失敗: ${(err as Error).message}`)
      return false
    }
  }, [invoices, reports, settings.client_email, addToast])

  const revertInvoice = useCallback(async (id: string, status: Invoice['status']): Promise<boolean> => {
    const inv = invoices.find(i => i.id === id)
    if (!inv) return false
    try {
      await api.updateInvoice(id, { status, paid_date: '', paid_amt: 0 })
      const targetReports = reports.filter(r => r.bill_month === inv.billing_month)
      if (status === '未請求') {
        await Promise.all(targetReports.map(r => api.updateReport(r.id, { invoiced: false, paid: false })))
        setReports(prev => prev.map(r =>
          r.bill_month === inv.billing_month ? { ...r, invoiced: false, paid: false } : r
        ))
      } else if (status === '送信済') {
        await Promise.all(targetReports.map(r => api.updateReport(r.id, { paid: false })))
        setReports(prev => prev.map(r =>
          r.bill_month === inv.billing_month ? { ...r, paid: false } : r
        ))
      }
      setInvoices(prev => prev.map(i =>
        i.id === id ? { ...i, status, paid_date: '', paid_amt: 0 } : i
      ))
      addToast('success', `請求書 ${id} を「${status}」に戻しました`)
      return true
    } catch (err) {
      addToast('error', `更新失敗: ${(err as Error).message}`)
      return false
    }
  }, [invoices, reports, addToast])

  const markPaid = useCallback(async (id: string): Promise<boolean> => {
    const inv = invoices.find(i => i.id === id)
    if (!inv) return false
    try {
      const paidDate = new Date().toISOString().slice(0, 10)
      await api.updateInvoice(id, { status: '入金済', paid_date: paidDate, paid_amt: inv.total })
      const targetReports = reports.filter(r => r.bill_month === inv.billing_month)
      await Promise.all(targetReports.map(r => api.updateReport(r.id, { paid: true })))
      setInvoices(prev => prev.map(i =>
        i.id === id ? { ...i, status: '入金済', paid_date: paidDate, paid_amt: inv.total } : i
      ))
      setReports(prev => prev.map(r =>
        r.bill_month === inv.billing_month ? { ...r, paid: true } : r
      ))
      addToast('success', `請求書 ${id} を入金済にしました`)
      return true
    } catch (err) {
      addToast('error', `更新失敗: ${(err as Error).message}`)
      return false
    }
  }, [invoices, reports, addToast])

  const updateInvoiceManual = useCallback(async (id: string, updates: Pick<Invoice, 'subtotal' | 'tax' | 'expenses' | 'total' | 'expense_items'>): Promise<boolean> => {
    try {
      await api.updateInvoice(id, updates)
      setInvoices(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i))
      addToast('success', '請求書を保存しました')
      return true
    } catch (err) {
      addToast('error', `保存失敗: ${(err as Error).message}`)
      return false
    }
  }, [addToast])

  const savePdf = useCallback(async (id: string, url: string) => {
    try {
      await api.updateReport(id, { hw_voucher: url })
      setReports(prev => prev.map(r => r.id === id ? { ...r, hw_voucher: url } : r))
      addToast('success', 'PDFを保存しました')
    } catch (err) {
      addToast('error', `保存失敗: ${(err as Error).message}`)
    }
  }, [addToast])

  const updateReport = useCallback(async (id: string, updates: Partial<Report>): Promise<boolean> => {
    try {
      await api.updateReport(id, updates)
      setReports(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r))
      const target = reports.find(r => r.id === id)
      if (target) {
        const billMonth = (updates.bill_month ?? target.bill_month)
        const newReports = reports.map(r => r.id === id ? { ...r, ...updates } : r)
        const updatedInv = await api.syncInvoiceFromReport(billMonth, newReports)
        setInvoices(prev => prev.map(i => i.id === updatedInv.id ? updatedInv : i))
      }
      addToast('success', '日報を更新しました')
      return true
    } catch (err) {
      addToast('error', `更新失敗: ${(err as Error).message}`)
      return false
    }
  }, [reports, addToast])

  const deleteReport = useCallback(async (id: string): Promise<boolean> => {
    try {
      await api.deleteReport(id)
      setReports(prev => prev.filter(r => r.id !== id))
      addToast('success', '日報を削除しました')
      return true
    } catch (err) {
      addToast('error', `削除失敗: ${(err as Error).message}`)
      return false
    }
  }, [addToast])

  const updateAmount = useCallback(async (id: string, amount: number): Promise<boolean> => {
    try {
      await api.updateReport(id, { amount })
      setReports(prev => prev.map(r => r.id === id ? { ...r, amount } : r))
      const target = reports.find(r => r.id === id)
      if (target) {
        const newReports = reports.map(r => r.id === id ? { ...r, amount } : r)
        const updatedInv = await api.syncInvoiceFromReport(target.bill_month, newReports)
        setInvoices(prev => prev.map(i => i.id === updatedInv.id ? updatedInv : i))
      }
      addToast('success', '売上金額を保存しました')
      return true
    } catch (err) {
      addToast('error', `保存失敗: ${(err as Error).message}`)
      return false
    }
  }, [reports, addToast])

  // ===================== KY REPORTS =====================
  const submitKyReport = useCallback(async (
    data: Omit<KyReport, 'id' | 'created_at' | 'updated_at'>
  ): Promise<KyReport | null> => {
    try {
      const saved = await api.insertKyReport(data)
      setKyReports(prev => [saved, ...prev])
      // Google Chat通知
      if (settings.gchat_webhook) {
        try {
          await api.sendGchatNotification(settings.gchat_webhook, saved)
          addToast('success', 'KY出発前報告を送信しました。Google Chatに通知しました。')
        } catch {
          addToast('info', 'KY出発前報告を保存しました。Google Chat通知に失敗しました。')
        }
      } else {
        addToast('success', 'KY出発前報告を保存しました。')
      }
      return saved
    } catch (err) {
      addToast('error', `KY報告の保存に失敗: ${(err as Error).message}`)
      return null
    }
  }, [settings.gchat_webhook, addToast])

  const deleteKyReport = useCallback(async (id: string): Promise<boolean> => {
    try {
      await api.deleteKyReport(id)
      setKyReports(prev => prev.filter(k => k.id !== id))
      addToast('success', 'KY報告を削除しました')
      return true
    } catch (err) {
      addToast('error', `削除失敗: ${(err as Error).message}`)
      return false
    }
  }, [addToast])

  // ===================== PORT MASTER =====================
  const savePortMaster = useCallback(async (pm: Omit<PortMaster, 'created_at' | 'updated_at'>): Promise<boolean> => {
    try {
      const saved = await api.upsertPortMaster(pm)
      setPortMasters(prev => {
        const exists = prev.find(p => p.id === saved.id)
        return exists ? prev.map(p => p.id === saved.id ? saved : p) : [...prev, saved]
      })
      addToast('success', '港マスターを保存しました')
      return true
    } catch (err) {
      addToast('error', `保存失敗: ${(err as Error).message}`)
      return false
    }
  }, [addToast])

  const deletePortMasterById = useCallback(async (id: string): Promise<boolean> => {
    try {
      await api.deletePortMaster(id)
      setPortMasters(prev => prev.filter(p => p.id !== id))
      addToast('success', '港マスターを削除しました')
      return true
    } catch (err) {
      addToast('error', `削除失敗: ${(err as Error).message}`)
      return false
    }
  }, [addToast])

  return {
    reports, invoices, settings,
    kyReports, portMasters,
    loading, toasts,
    addToast, removeToast,
    submitReport, saveSettings,
    sendInvoice, markPaid, revertInvoice,
    updateAmount,
    updateReport,
    deleteReport,
    savePdf,
    updateInvoiceManual,
    submitKyReport,
    deleteKyReport,
    savePortMaster,
    deletePortMasterById,
    reload: loadAll,
  }
}

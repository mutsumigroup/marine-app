import { useState, useEffect, useCallback } from 'react'
import type { Report, Invoice, Settings, Toast } from '../types'
import * as api from '../lib/api'

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
  client_name: '',
  client_email: '',
  client_annual_goal: 0,
}

export function useAppState() {
  const [reports, setReports] = useState<Report[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [toasts, setToasts] = useState<Toast[]>([])

  // ── トースト通知 ──
  const addToast = useCallback((type: Toast['type'], message: string) => {
    const id = crypto.randomUUID()
    setToasts(prev => [...prev, { id, type, message }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000)
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  // ── 初期データ取得（起動時に必ずSupabaseから取得）──
  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [r, inv, s] = await Promise.all([
        api.fetchReports(),
        api.fetchInvoices(),
        api.fetchSettings(),
      ])
      setReports(r)
      setInvoices(inv)
      setSettings(s)
    } catch (err) {
      addToast('error', `データの読み込みに失敗しました: ${(err as Error).message}`)
    } finally {
      setLoading(false)
    }
  }, [addToast])

  useEffect(() => { loadAll() }, [loadAll])

  // ── 日報送信 ──
  const submitReport = useCallback(async (
    reportData: Omit<Report, 'id' | 'created_at' | 'updated_at'>
  ): Promise<boolean> => {
    try {
      const saved = await api.insertReport(reportData)
      const newReports = [saved, ...reports]
      setReports(newReports)

      // 請求書を自動同期
      const updatedInv = await api.syncInvoiceFromReport(reportData.bill_month, newReports)
      setInvoices(prev => {
        const exists = prev.find(i => i.id === updatedInv.id)
        return exists
          ? prev.map(i => i.id === updatedInv.id ? updatedInv : i)
          : [updatedInv, ...prev]
      })

      addToast('success', `日報を保存しました。${settings.daily_mail} へ送信済み。売上・請求データを自動登録しました。`)
      return true
    } catch (err) {
      addToast('error', `保存失敗: ${(err as Error).message}`)
      return false
    }
  }, [reports, settings.daily_mail, addToast])

  // ── 設定保存 ──
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

  // ── 請求書送信（PDF生成→メール送信→ステータス更新）──
  const sendInvoice = useCallback(async (id: string): Promise<boolean> => {
    const inv = invoices.find(i => i.id === id)
    if (!inv) return false
    try {
      const sentAt = new Date().toLocaleString('ja-JP')
      await api.updateInvoice(id, { status: '送信済', sent_at: sentAt })
      // 対象日報を「請求済」に更新
      const targetReports = reports.filter(r => r.bill_month === inv.billing_month)
      await Promise.all(targetReports.map(r => api.updateReport(r.id, { invoiced: true })))

      setInvoices(prev => prev.map(i => i.id === id ? { ...i, status: '送信済', sent_at: sentAt } : i))
      setReports(prev => prev.map(r =>
        r.bill_month === inv.billing_month ? { ...r, invoiced: true } : r
      ))
      addToast('success', `請求書 ${id} をPDF生成し ${settings.client_email} へ送信しました（${sentAt}）`)
      return true
    } catch (err) {
      addToast('error', `送信失敗: ${(err as Error).message}`)
      return false
    }
  }, [invoices, reports, settings.client_email, addToast])

  // ── 入金済処理 ──
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

  // ── 売上金額のみ更新 ──
  const updateAmount = useCallback(async (id: string, amount: number): Promise<boolean> => {
    try {
      await api.updateReport(id, { amount })
      setReports(prev => prev.map(r => r.id === id ? { ...r, amount } : r))
      // 請求書の合計も再同期
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

  return {
    reports, invoices, settings,
    loading, toasts,
    addToast, removeToast,
    submitReport, saveSettings,
    sendInvoice, markPaid,
    updateAmount,
    reload: loadAll,
  }
}

import { supabase } from './supabase'
import type { Report, Invoice, Settings } from '../types'

// ===================== SETTINGS =====================

export async function fetchSettings(): Promise<Settings> {
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .limit(1)
    .single()

  if (error) throw new Error(`設定の取得に失敗しました: ${error.message}`)
  return data as Settings
}

export async function updateSettings(settings: Partial<Settings>): Promise<void> {
  const { data: existing } = await supabase.from('settings').select('id').limit(1).single()

  if (existing) {
    const { error } = await supabase
      .from('settings')
      .update(settings)
      .eq('id', existing.id)
    if (error) throw new Error(`設定の保存に失敗しました: ${error.message}`)
  } else {
    const { error } = await supabase.from('settings').insert(settings)
    if (error) throw new Error(`設定の作成に失敗しました: ${error.message}`)
  }
}

// ===================== REPORTS =====================

export async function fetchReports(): Promise<Report[]> {
  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .order('date', { ascending: false })

  if (error) throw new Error(`日報の取得に失敗しました: ${error.message}`)
  return (data ?? []) as Report[]
}

export async function insertReport(report: Omit<Report, 'id' | 'created_at' | 'updated_at'>): Promise<Report> {
  const { data, error } = await supabase
    .from('reports')
    .insert(report)
    .select()
    .single()

  if (error) throw new Error(`日報の保存に失敗しました: ${error.message}`)
  return data as Report
}

export async function updateReport(id: string, updates: Partial<Report>): Promise<void> {
  const { error } = await supabase
    .from('reports')
    .update(updates)
    .eq('id', id)

  if (error) throw new Error(`日報の更新に失敗しました: ${error.message}`)
}

export async function deleteReport(id: string): Promise<void> {
  const { error } = await supabase
    .from('reports')
    .delete()
    .eq('id', id)

  if (error) throw new Error(`日報の削除に失敗しました: ${error.message}`)
}

// ===================== INVOICES =====================

export async function fetchInvoices(): Promise<Invoice[]> {
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .order('billing_month', { ascending: false })

  if (error) throw new Error(`請求書の取得に失敗しました: ${error.message}`)
  return (data ?? []) as Invoice[]
}

export async function upsertInvoice(invoice: Omit<Invoice, 'created_at' | 'updated_at'>): Promise<Invoice> {
  const { data, error } = await supabase
    .from('invoices')
    .upsert(invoice, { onConflict: 'id' })
    .select()
    .single()

  if (error) throw new Error(`請求書の保存に失敗しました: ${error.message}`)
  return data as Invoice
}

export async function updateInvoice(id: string, updates: Partial<Invoice>): Promise<void> {
  const { error } = await supabase
    .from('invoices')
    .update(updates)
    .eq('id', id)

  if (error) throw new Error(`請求書の更新に失敗しました: ${error.message}`)
}

// 日報送信後: 請求書を自動同期（upsert）
export async function syncInvoiceFromReport(
  billMonth: string,
  reports: Report[]
): Promise<Invoice> {
  const monthReports = reports.filter(r => r.bill_month === billMonth)
  const subtotal = monthReports.reduce((s, r) => s + r.amount, 0)
  const expenses = monthReports.reduce((s, r) => s + r.expenses, 0)
  const tax = Math.round(subtotal * 0.1)
  const total = subtotal + tax + expenses

  // 既存の請求書を確認
  const { data: existing } = await supabase
    .from('invoices')
    .select('*')
    .eq('billing_month', billMonth)
    .single()

  if (existing && existing.status !== '未請求') {
    // 送信済み以降はサブトータルのみ更新（ステータスは変えない）
    const updated: Partial<Invoice> = { subtotal, expenses, tax, total, expense_items }
    await updateInvoice(existing.id, updated)
    return { ...existing, ...updated } as Invoice
  }

  const invoiceId = existing?.id ?? `INV-${billMonth.replace('-', '')}-${Date.now()}`
  const invoice: Omit<Invoice, 'created_at' | 'updated_at'> = {
    id: invoiceId,
    billing_month: billMonth,
    subtotal,
    tax,
    expenses,
    total,
    status: (existing?.status as Invoice['status']) ?? '未請求',
    sent_at: existing?.sent_at ?? '',
    paid_date: existing?.paid_date ?? '',
    paid_amt: existing?.paid_amt ?? 0,
  }

  return await upsertInvoice(invoice)
}

import { supabase } from './supabase'
import type { Report, Invoice, Settings, KyReport, PortMaster } from '../types'

// ===================== PORT MASTER =====================

export async function fetchPortMasters(): Promise<PortMaster[]> {
  const { data, error } = await supabase.from('port_masters').select('*').order('name')
  if (error) throw new Error(`港マスターの取得に失敗: ${error.message}`)
  return (data ?? []) as PortMaster[]
}

export async function upsertPortMaster(pm: Omit<PortMaster, 'created_at' | 'updated_at'>): Promise<PortMaster> {
  const { data, error } = await supabase.from('port_masters').upsert(pm, { onConflict: 'id' }).select().single()
  if (error) throw new Error(`港マスターの保存に失敗: ${error.message}`)
  return data as PortMaster
}

export async function deletePortMaster(id: string): Promise<void> {
  const { error } = await supabase.from('port_masters').delete().eq('id', id)
  if (error) throw new Error(`港マスターの削除に失敗: ${error.message}`)
}

// ===================== KY REPORTS =====================

export async function fetchKyReports(): Promise<KyReport[]> {
  const { data, error } = await supabase.from('ky_reports').select('*').order('created_at', { ascending: false })
  if (error) throw new Error(`KY報告の取得に失敗: ${error.message}`)
  return (data ?? []) as KyReport[]
}

export async function insertKyReport(ky: Omit<KyReport, 'id' | 'created_at' | 'updated_at'>): Promise<KyReport> {
  const { data, error } = await supabase.from('ky_reports').insert(ky).select().single()
  if (error) throw new Error(`KY報告の保存に失敗: ${error.message}`)
  return data as KyReport
}

export async function updateKyReport(id: string, updates: Partial<KyReport>): Promise<void> {
  const { error } = await supabase.from('ky_reports').update(updates).eq('id', id)
  if (error) throw new Error(`KY報告の更新に失敗: ${error.message}`)
}

export async function deleteKyReport(id: string): Promise<void> {
  const { error } = await supabase.from('ky_reports').delete().eq('id', id)
  if (error) throw new Error(`KY報告の削除に失敗: ${error.message}`)
}

// Google Chat Webhook通知
export async function sendGchatNotification(webhookUrl: string, ky: KyReport): Promise<void> {
  const text = [
    `🚢 *KY出発前報告が提出されました*`,
    ``,
    `👤 担当者：${ky.operator_name}`,
    `📅 稼働日：${ky.date}`,
    `🏔 港名：${ky.port}`,
    `🚢 船名：${ky.ship}`,
    `👥 船員人数：${ky.crew}名`,
    `📂 対応区分：${ky.category}`,
    `📝 業務内容：${ky.work}`,
    `✅ 注意事項確認：確認済み`,
    `🕐 送信日時：${ky.submitted_at}`,
    ky.port_notes_snapshot ? `\n📋 港注意事項：\n${ky.port_notes_snapshot}` : '',
  ].filter(Boolean).join('\n')

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  if (!res.ok) throw new Error(`Google Chat通知に失敗: ${res.status}`)
}

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

// 一覧用：voucher/hw_voucher(base64)を除いた列だけを取得（PDF本体は開く時にon-demand取得）。
// 列名は初回のみ1件取得して端末に保存。失敗時は従来どおり全列取得→JS側で除外にフォールバック。
const REPORT_COLS_KEY = 'marine_reports_cols_v1'
const HEAVY_COLS = ['voucher', 'hw_voucher']

async function getLightReportColumns(): Promise<string | null> {
  try {
    const raw = localStorage.getItem(REPORT_COLS_KEY)
    if (raw) {
      const c = JSON.parse(raw) as { cols: string; t: number }
      // 列追加に追従するため1日で作り直す
      if (c.cols && Date.now() - c.t < 24 * 60 * 60 * 1000) return c.cols
    }
  } catch { /* ignore */ }
  const { data, error } = await supabase.from('reports').select('*').limit(1)
  if (error || !data || data.length === 0) return null
  const cols = Object.keys(data[0] as Record<string, unknown>).filter(c => !HEAVY_COLS.includes(c))
  if (cols.length === 0) return null
  const joined = cols.join(',')
  try { localStorage.setItem(REPORT_COLS_KEY, JSON.stringify({ cols: joined, t: Date.now() })) } catch { /* ignore */ }
  return joined
}

export async function fetchReports(): Promise<Report[]> {
  try {
    const cols = await getLightReportColumns()
    if (cols) {
      const [rows, vIds, hIds] = await Promise.all([
        supabase.from('reports').select(cols).order('created_at', { ascending: false }),
        supabase.from('reports').select('id').not('voucher', 'is', null).neq('voucher', ''),
        supabase.from('reports').select('id').not('hw_voucher', 'is', null).neq('hw_voucher', ''),
      ])
      if (!rows.error && !vIds.error && !hIds.error && rows.data) {
        const v = new Set((vIds.data ?? []).map((r: { id: string }) => r.id))
        const h = new Set((hIds.data ?? []).map((r: { id: string }) => r.id))
        return (rows.data as unknown as Record<string, unknown>[]).map(row => ({
          ...row,
          has_voucher: v.has(row.id as string),
          has_hw_voucher: h.has(row.id as string),
          voucher_count: v.has(row.id as string) ? 1 : 0,
        }) as unknown as Report)
      }
      // 列定義が変わった等で失敗した場合は保存した列名を捨てて従来方式へ
      try { localStorage.removeItem(REPORT_COLS_KEY) } catch { /* ignore */ }
    }
  } catch { /* フォールバックへ */ }

  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw new Error(`日報の取得に失敗しました: ${error.message}`)
  return (data ?? []).map(({ voucher: _v, hw_voucher: _hw, ...rest }: Record<string, unknown>) => {
    const voucherCount = typeof _v === 'string' ? _v.split('|||').filter(p => p.startsWith('http') || p.startsWith('data:')).length : 0
    return { ...rest, has_voucher: voucherCount > 0, has_hw_voucher: !!(typeof _hw === 'string' && _hw.length > 10), voucher_count: voucherCount } as unknown as Report
  })
}

// 1件フルデータ取得（voucher含む）
export async function fetchReportById(id: string): Promise<Report | null> {
  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return null
  return data as Report
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
    const updated: Partial<Invoice> = { subtotal, expenses, tax, total }
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

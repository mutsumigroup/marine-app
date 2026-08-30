export const CATEGORIES = [
  '転船', 'センディング', '乗船', '下船',
  '別日の場合の入管手続き', '新横浜・東京駅対応', 'その他①', 'その他②'
] as const

export type Category = typeof CATEGORIES[number]

export interface PriceEntry {
  ship: number
  crew: number
}

export interface Settings {
  id?: string
  company_name: string
  address: string
  tel: string
  email: string
  invoice_no: string
  pay_days: number
  bank: string
  account: string
  daily_mail: string
  inv_mail: string
  prices: Record<string, PriceEntry>
  fixed_expenses: { label: string; amount: number }[]
  client_name: string
  client_email: string
  client_annual_goal: number
  gchat_webhook?: string
  daily_report_template?: string
  invoice_template?: string
  custom_categories?: string[]
}

// 港マスター
export interface PortMaster {
  id: string
  name: string
  notes: string
  photos: string[]   // base64 or URL
  pdfs: string[]     // base64 or URL
  extra: Record<string, unknown>  // 将来拡張用
  created_at?: string
  updated_at?: string
}

// KY出発前報告
export interface KyReport {
  id: string
  date: string
  port: string
  ship: string
  crew: number
  category: string
  work: string
  notes_confirmed: boolean   // 注意事項確認チェック
  port_notes_snapshot: string // 送信時点の港注意事項スナップショット
  submitted_at: string
  operator_name: string
  report_id?: string         // 紐付いた日報ID（子データ）
  created_at?: string
  updated_at?: string
}

export interface Report {
  id: string
  date: string
  port: string
  ship: string
  crew: number
  category: string
  work: string
  amount: number
  park_place: string
  park_fee: number
  hw_from1: string
  hw_to1: string
  hw_from2: string
  hw_to2: string
  hw_fee: number
  hw_voucher?: string
  meal: number
  hotel_fee: number
  shinkansen_fee: number
  other_exp: number
  extra_expenses?: { label: string; amount: number; _type?: string }[]
  expenses: number
  expense_items?: { label: string; amount: number; _type?: string }[]
  voucher: string
  bill_month: string
  notes: string
  invoiced: boolean
  paid: boolean
  created_at?: string
  updated_at?: string
}

export interface Invoice {
  id: string
  billing_month: string
  subtotal: number
  tax: number
  expenses: number
  expense_items?: { label: string; amount: number; _type?: string }[]
  total: number
  status: InvoiceStatus
  sent_at: string
  paid_date: string
  paid_amt: number
  created_at?: string
  updated_at?: string
}

export type InvoiceStatus = '未請求' | '作成済' | '送信済' | '入金待ち' | '入金済'

export interface Toast {
  id: string
  type: 'success' | 'error' | 'info'
  message: string
}

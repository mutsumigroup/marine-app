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
  meal: number
  other_exp: number
  expenses: number
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

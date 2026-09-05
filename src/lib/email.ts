import emailjs from '@emailjs/browser'

emailjs.init(import.meta.env.VITE_EMAILJS_PUBLIC_KEY)

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY

export async function sendEmail(params: {
  to_email: string
  subject: string
  message: string
}): Promise<void> {
  await emailjs.send(SERVICE_ID, TEMPLATE_ID, {
    to_email: params.to_email,
    subject: params.subject,
    message: params.message,
    email: params.to_email,
  })
}

export async function sendInvoiceEmail(params: {
  to_email: string
  subject: string
  message: string
  pdf_base64: string
  pdf_filename: string
}): Promise<void> {
  await emailjs.send(SERVICE_ID, TEMPLATE_ID, {
    to_email: params.to_email,
    subject: params.subject,
    message: params.message,
    email: params.to_email,
    pdf_base64: params.pdf_base64,
    pdf_filename: params.pdf_filename,
  }, { publicKey: PUBLIC_KEY })
}

export const DEFAULT_DAILY_TEMPLATE = `【日報】{date} {ship}

■ 基本情報
稼働日：{date}
港名：{port}
船名：{ship}
船員人数：{crew}名
対応区分：{category}
業務内容：{work}
請求対象月：{bill_month}

■ 費用
売上金額：¥{amount}
{expense_lines}立替合計：¥{expenses}

{voucher_line}{notes_line}
■ 日報一覧を確認する
{annual_url}

---
マリン業務管理システム`

export const DEFAULT_INVOICE_TEMPLATE = `{client_name} 御中

いつもお世話になっております。
{billing_month}分の請求書をお送りします。

■ 請求書番号：{invoice_id}
■ 請求月：{billing_month}
■ 業務請求金額（税抜）：¥{subtotal}
■ 消費税（10%）：¥{tax}
■ 立替金精算：¥{expenses}
■ 最終請求金額（税込）：¥{total}

■ 請求書の確認はこちら：
{invoice_url}

お手数ですが、ご確認のうえお振込みくださいますようお願いいたします。

---
マリン業務管理システム`

export function buildDailyReportEmail(report: {
  date: string
  port: string
  ship: string
  crew: number
  category: string
  work: string
  amount: number
  park_fee: number
  hw_fee: number
  meal: number
  hotel_fee: number
  shinkansen_fee: number
  expenses: number
  extra_expenses?: { label: string; amount: number }[]
  voucher: string
  bill_month: string
  notes: string
}, annualUrl: string, template?: string): string {
  const tpl = template || DEFAULT_DAILY_TEMPLATE
  const expenseLines: string[] = []
  if (report.park_fee > 0) expenseLines.push(`駐車場料金：¥${report.park_fee.toLocaleString()}`)
  if (report.hw_fee > 0)   expenseLines.push(`高速料金：¥${report.hw_fee.toLocaleString()}`)
  if (report.meal > 0)     expenseLines.push(`食事代：¥${report.meal.toLocaleString()}`)
  if (report.hotel_fee > 0) expenseLines.push(`ホテル代金：¥${report.hotel_fee.toLocaleString()}`)
  if (report.shinkansen_fee > 0) expenseLines.push(`新幹線代金：¥${report.shinkansen_fee.toLocaleString()}`)
  if (report.extra_expenses && report.extra_expenses.length > 0) {
    report.extra_expenses.forEach(e => {
      if (e.label || e.amount > 0) {
        expenseLines.push(`${e.label || 'その他'}：¥${e.amount.toLocaleString()}`)
      }
    })
  }
  const expenseLinesStr = expenseLines.length > 0 ? expenseLines.join('\n') + '\n' : ''
  return tpl
    .replace(/{date}/g, report.date)
    .replace(/{port}/g, report.port)
    .replace(/{ship}/g, report.ship)
    .replace(/{crew}/g, String(report.crew))
    .replace(/{category}/g, report.category)
    .replace(/{work}/g, report.work || '—')
    .replace(/{bill_month}/g, report.bill_month)
    .replace(/{amount}/g, report.amount.toLocaleString())
    .replace(/{expense_lines}/g, expenseLinesStr)
    .replace(/{park_fee}/g, report.park_fee.toLocaleString())
    .replace(/{hw_fee}/g, report.hw_fee.toLocaleString())
    .replace(/{meal}/g, report.meal.toLocaleString())
    .replace(/{hotel_fee}/g, report.hotel_fee.toLocaleString())
    .replace(/{shinkansen_fee}/g, report.shinkansen_fee.toLocaleString())
    .replace(/{expenses}/g, report.expenses.toLocaleString())
    .replace(/{voucher_line}/g, (report.voucher && !report.voucher.startsWith('data:')) ? `Voucher：${report.voucher}
` : '')
    .replace(/{notes_line}/g, report.notes ? `備考：${report.notes}
` : '')
    .replace(/{annual_url}/g, annualUrl)
}

export function buildInvoiceEmail(invoice: {
  id: string
  billing_month: string
  subtotal: number
  tax: number
  expenses: number
  total: number
}, clientName: string, template?: string): string {
  const invoiceUrl = `https://mutsumigroup.github.io/marine-app/#/invoices?id=${invoice.id}`
  const tpl = template || DEFAULT_INVOICE_TEMPLATE
  return tpl
    .replace(/{client_name}/g, clientName)
    .replace(/{billing_month}/g, invoice.billing_month)
    .replace(/{invoice_id}/g, invoice.id)
    .replace(/{subtotal}/g, invoice.subtotal.toLocaleString())
    .replace(/{tax}/g, invoice.tax.toLocaleString())
    .replace(/{expenses}/g, invoice.expenses.toLocaleString())
    .replace(/{total}/g, invoice.total.toLocaleString())
    .replace(/{invoice_url}/g, invoiceUrl)
}

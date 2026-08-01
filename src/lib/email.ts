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
  voucher: string
  bill_month: string
  notes: string
}, annualUrl: string): string {
  return `【日報】${report.date} ${report.ship}

■ 基本情報
稼働日：${report.date}
港名：${report.port}
船名：${report.ship}
船員人数：${report.crew}名
対応区分：${report.category}
業務内容：${report.work || '—'}
請求対象月：${report.bill_month}

■ 費用
売上金額：¥${report.amount.toLocaleString()}
駐車場料金：¥${report.park_fee.toLocaleString()}
高速料金：¥${report.hw_fee.toLocaleString()}
食事代：¥${report.meal.toLocaleString()}
ホテル代金：¥${report.hotel_fee.toLocaleString()}
新幹線代金：¥${report.shinkansen_fee.toLocaleString()}
立替合計：¥${report.expenses.toLocaleString()}

${report.voucher && !report.voucher.startsWith("data:") ? `Voucher：${report.voucher}` : ""}
${report.notes ? `備考：${report.notes}` : ''}

■ 日報一覧を確認する
${annualUrl}

---
マリン業務管理システム`
}

export function buildInvoiceEmail(invoice: {
  id: string
  billing_month: string
  subtotal: number
  tax: number
  expenses: number
  total: number
}, clientName: string): string {
  const invoiceUrl = 'https://mutsumigroup.github.io/marine-app/#/invoices'
  return `${clientName} 御中

いつもお世話になっております。
${invoice.billing_month}分の請求書をお送りします。

■ 請求書番号：${invoice.id}
■ 請求月：${invoice.billing_month}
■ 業務請求金額（税抜）：¥${invoice.subtotal.toLocaleString()}
■ 消費税（10%）：¥${invoice.tax.toLocaleString()}
■ 立替金精算：¥${invoice.expenses.toLocaleString()}
■ 最終請求金額（税込）：¥${invoice.total.toLocaleString()}

■ 請求書の確認はこちら：
${invoiceUrl}

お手数ですが、ご確認のうえお振込みくださいますようお願いいたします。

---
マリン業務管理システム`
}

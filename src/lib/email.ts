// メールテンプレートのデフォルト値（設定未入力時に使用）
export const DEFAULT_DAILY_MAIL_SUBJECT = '【日報】{{date}} {{ship}}'
export const DEFAULT_DAILY_MAIL_BODY = `■ 基本情報
稼働日：{{date}}
港名：{{port}}
船名：{{ship}}
船員人数：{{crew}}名
対応区分：{{category}}
業務内容：{{work}}
請求対象月：{{bill_month}}

■ 費用
売上金額：¥{{amount}}
駐車場料金：¥{{park_fee}}
高速料金：¥{{hw_fee}}
食事代：¥{{meal}}
立替合計：¥{{expenses}}

{{voucher}}
{{notes}}
{{link}}`

// テンプレート変数を実際の値に置換する
function applyTemplate(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce((str, [key, val]) => {
    return str.split(`{{${key}}}`).join(val)
  }, template)
}

export function buildDailyReportEmail(
  report: {
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
    expenses: number
    voucher: string
    bill_month: string
    notes: string
  },
  annualUrl: string,
  template?: { subject?: string; body?: string; link?: string }
): { subject: string; body: string } {
  const link = template?.link || annualUrl
  const vars: Record<string, string> = {
    date: report.date,
    port: report.port,
    ship: report.ship,
    crew: String(report.crew),
    category: report.category,
    work: report.work || '—',
    amount: report.amount.toLocaleString(),
    park_fee: report.park_fee.toLocaleString(),
    hw_fee: report.hw_fee.toLocaleString(),
    meal: report.meal.toLocaleString(),
    expenses: report.expenses.toLocaleString(),
    voucher: report.voucher ? `Voucher：${report.voucher}` : '',
    notes: report.notes ? `備考：${report.notes}` : '',
    bill_month: report.bill_month,
    link: link ? `■ 確認リンク\n${link}` : '',
  }

  const subject = applyTemplate(template?.subject || DEFAULT_DAILY_MAIL_SUBJECT, vars)
  const body = applyTemplate(template?.body || DEFAULT_DAILY_MAIL_BODY, vars)

  return { subject, body }
}

// 請求書メール送信（変更なし）
export function buildInvoiceEmail(invoice: {
  id: string
  billing_month: string
  subtotal: number
  tax: number
  expenses: number
  total: number
}, clientName: string): string {
  return `${clientName} 御中

いつもお世話になっております。
${invoice.billing_month}分の請求書をお送りします。

■ 請求書番号：${invoice.id}
■ 請求月：${invoice.billing_month}
■ 業務請求金額（税抜）：¥${invoice.subtotal.toLocaleString()}
■ 消費税（10%）：¥${invoice.tax.toLocaleString()}
■ 立替金精算：¥${invoice.expenses.toLocaleString()}
■ 最終請求金額（税込）：¥${invoice.total.toLocaleString()}

お手数ですが、ご確認のうえお振込みくださいますようお願いいたします。

---
マリン業務管理システム`
}

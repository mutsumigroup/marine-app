import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Invoice, Report, Settings } from '../types'

export function generateInvoicePDF(
  inv: Invoice,
  reports: Report[],
  settings: Settings
): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })

  // フォント設定（日本語は文字化けするためBase64埋め込みが必要。
  // 本番では適切な日本語フォントを追加すること）
  doc.setFont('helvetica')

  const pageW = doc.internal.pageSize.getWidth()
  const margin = 20

  // ── ヘッダー ──
  doc.setFontSize(22)
  doc.setTextColor(26, 58, 92)
  doc.text('INVOICE', margin, 28)

  doc.setFontSize(10)
  doc.setTextColor(100)
  doc.text(`No. ${inv.id}`, margin, 35)

  // 自社情報（右上）
  doc.setFontSize(9)
  doc.setTextColor(50)
  const companyLines = [
    settings.company_name,
    settings.address,
    `TEL: ${settings.tel}`,
    settings.email,
    `Invoice No: ${settings.invoice_no}`,
  ]
  let cy = 20
  companyLines.forEach(line => {
    doc.text(line, pageW - margin, cy, { align: 'right' })
    cy += 5
  })

  // 区切り線
  doc.setDrawColor(26, 58, 92)
  doc.setLineWidth(0.5)
  doc.line(margin, 40, pageW - margin, 40)

  // 請求先
  doc.setFontSize(10)
  doc.setTextColor(100)
  doc.text('請求先', margin, 50)
  doc.setFontSize(13)
  doc.setTextColor(30)
  doc.text(`${settings.client_name} 御中`, margin, 58)
  doc.setLineWidth(0.3)
  doc.line(margin, 60, margin + 80, 60)

  // メタ情報
  doc.setFontSize(9)
  doc.setTextColor(80)
  const today = new Date().toLocaleDateString('ja-JP')
  const dueDate = new Date(Date.now() + settings.pay_days * 86400000).toLocaleDateString('ja-JP')
  doc.text(`件名: ${inv.billing_month}分 業務委託費`, margin, 68)
  doc.text(`請求日: ${today}`, pageW / 2, 68, { align: 'center' })
  doc.text(`支払期限: ${dueDate}`, pageW - margin, 68, { align: 'right' })

  // 合計金額バナー
  doc.setFillColor(26, 58, 92)
  doc.rect(margin, 73, pageW - margin * 2, 12, 'F')
  doc.setFontSize(10)
  doc.setTextColor(255)
  doc.text('ご請求金額（税込）', margin + 4, 81)
  doc.setFontSize(14)
  doc.text(`JPY ${inv.total.toLocaleString()}`, pageW - margin - 4, 81, { align: 'right' })

  // ── 業務明細 ──
  const monthReports = reports.filter(r => r.bill_month === inv.billing_month)
  const catSum: Record<string, { count: number; crew: number }> = {}
  monthReports.forEach(r => {
    if (!catSum[r.category]) catSum[r.category] = { count: 0, crew: 0 }
    catSum[r.category].count++
    catSum[r.category].crew += r.crew
  })

  const pr = settings.prices ?? {}
  let bizTotal = 0
  const detailRows: (string | number)[][] = []

  Object.entries(catSum).forEach(([cat, d]) => {
    const p = pr[cat] ?? { ship: 10000, crew: 1000 }
    const shipAmt = d.count * p.ship
    const crewAmt = d.crew * (p.crew ?? 0)
    const line = shipAmt + crewAmt
    bizTotal += line
    detailRows.push([
      cat,
      `${d.count}隻`,
      `${d.crew}名`,
      `¥${p.ship.toLocaleString()} / ¥${(p.crew ?? 0).toLocaleString()}`,
      `¥${line.toLocaleString()}`,
    ])
  })

  doc.setFontSize(10)
  doc.setTextColor(26, 58, 92)
  doc.text('業務明細（集計）', margin, 93)

  autoTable(doc, {
    startY: 96,
    head: [['対応区分', '件数', '船員', '単価（船/人）', '金額']],
    body: detailRows,
    theme: 'striped',
    headStyles: { fillColor: [26, 58, 92], fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 4: { halign: 'right' } },
    margin: { left: margin, right: margin },
  })

  const afterSummaryTable = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6

  // 日報明細一覧
  doc.setFontSize(10)
  doc.setTextColor(26, 58, 92)
  doc.text('日報明細一覧', margin, afterSummaryTable)

  const reportDetailRows = monthReports
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(r => [
      r.date,
      r.port,
      r.ship.length > 14 ? r.ship.slice(0, 14) + '…' : r.ship,
      String(r.crew) + '名',
      r.category,
      r.work.length > 18 ? r.work.slice(0, 18) + '…' : r.work,
      r.expenses > 0 ? '¥' + r.expenses.toLocaleString() : '—',
      r.amount > 0 ? '¥' + r.amount.toLocaleString() : '—',
    ])

  autoTable(doc, {
    startY: afterSummaryTable + 3,
    head: [['日付', '港', '船名', '人数', '区分', '業務内容', '立替', '売上']],
    body: reportDetailRows,
    theme: 'grid',
    headStyles: { fillColor: [60, 90, 120], fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    columnStyles: {
      6: { halign: 'right' },
      7: { halign: 'right' },
    },
    margin: { left: margin, right: margin },
  })

  const afterDetail = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4

  // 小計・税
  doc.setFontSize(9)
  doc.setTextColor(80)
  doc.text('業務小計:', pageW - margin - 60, afterDetail)
  doc.text(`¥${bizTotal.toLocaleString()}`, pageW - margin, afterDetail, { align: 'right' })
  doc.text('消費税（10%）:', pageW - margin - 60, afterDetail + 5)
  doc.text(`¥${inv.tax.toLocaleString()}`, pageW - margin, afterDetail + 5, { align: 'right' })
  doc.setFontSize(10)
  doc.setTextColor(30)
  doc.text('業務請求小計:', pageW - margin - 60, afterDetail + 12)
  doc.text(`¥${(bizTotal + inv.tax).toLocaleString()}`, pageW - margin, afterDetail + 12, { align: 'right' })

  // ── 立替金精算 ──
  const parkTotal = monthReports.reduce((s, r) => s + r.park_fee, 0)
  const hwTotal = monthReports.reduce((s, r) => s + r.hw_fee, 0)
  const mealTotal = monthReports.reduce((s, r) => s + r.meal, 0)
  const othTotal = monthReports.reduce((s, r) => s + r.other_exp, 0)
  const expRows: (string | number)[][] = []
  if (parkTotal > 0) expRows.push(['駐車場料金', `¥${parkTotal.toLocaleString()}`])
  if (hwTotal > 0) expRows.push(['高速料金', `¥${hwTotal.toLocaleString()}`])
  if (mealTotal > 0) expRows.push(['食事代', `¥${mealTotal.toLocaleString()}`])
  if (othTotal > 0) expRows.push(['その他立替', `¥${othTotal.toLocaleString()}`])

  const expStart = afterDetail + 18

  if (expRows.length > 0) {
    doc.setFontSize(10)
    doc.setTextColor(26, 58, 92)
    doc.text('立替金精算', margin, expStart)

    autoTable(doc, {
      startY: expStart + 3,
      head: [['項目', '金額']],
      body: expRows,
      theme: 'grid',
      headStyles: { fillColor: [60, 80, 110], fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 1: { halign: 'right' } },
      margin: { left: margin, right: margin },
    })
  }

  const afterExp = expRows.length > 0
    ? (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6
    : expStart

  // ── 合計ボックス ──
  doc.setFillColor(240, 244, 248)
  doc.rect(margin, afterExp, pageW - margin * 2, 22, 'F')
  doc.setDrawColor(26, 58, 92)
  doc.setLineWidth(0.8)
  doc.line(margin, afterExp, margin, afterExp + 22)
  doc.setLineWidth(0.3)

  doc.setFontSize(9)
  doc.setTextColor(80)
  doc.text('業務請求金額（税込）:', margin + 4, afterExp + 7)
  doc.text(`¥${(bizTotal + inv.tax).toLocaleString()}`, pageW - margin - 4, afterExp + 7, { align: 'right' })
  doc.text('立替金精算:', margin + 4, afterExp + 13)
  doc.text(`¥${inv.expenses.toLocaleString()}`, pageW - margin - 4, afterExp + 13, { align: 'right' })

  doc.setFontSize(12)
  doc.setTextColor(26, 58, 92)
  doc.text('最終請求金額:', margin + 4, afterExp + 20)
  doc.text(`¥${inv.total.toLocaleString()}`, pageW - margin - 4, afterExp + 20, { align: 'right' })

  // ── 振込先 ──
  const bankY = afterExp + 30
  doc.setFontSize(9)
  doc.setFillColor(249, 249, 249)
  doc.rect(margin, bankY, pageW - margin * 2, 14, 'F')
  doc.setDrawColor(200)
  doc.rect(margin, bankY, pageW - margin * 2, 14)
  doc.setTextColor(50)
  doc.text('お振込先', margin + 3, bankY + 5)
  doc.text(`${settings.bank}`, margin + 3, bankY + 10)
  doc.text(`${settings.account}`, margin + 60, bankY + 10)

  return doc
}

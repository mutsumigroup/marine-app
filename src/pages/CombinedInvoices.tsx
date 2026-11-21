import { useState, useEffect, useRef } from 'react'
import { Btn } from '../components/UI'
import { supabase } from '../lib/supabase'
import type { Invoice, Report, Settings } from '../types'
import type { TransportReport } from '../types/transport'

type TransportStatus = '未請求' | '送信済' | '入金済'
const getTransportStatus = (reps: TransportReport[]): TransportStatus =>
  reps.some(r => r.paid) ? '入金済' : reps.some(r => r.sent) ? '送信済' : '未請求'

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    '未請求':   ['#fff7e6', '#d97706'],
    '作成済':   ['#f3f0ff', '#7c3aed'],
    '送信済':   ['#eff6ff', '#2563eb'],
    '入金待ち': ['#fef2f2', '#dc2626'],
    '入金済':   ['#f0fdf4', '#16a34a'],
  }
  const [bg, color] = map[status] ?? ['#f3f4f6', '#6b7280']
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: bg, color }}>
      {status}
    </span>
  )
}

interface CombinedMonth {
  month: string
  invoice: Invoice | null
  shipReports: Report[]
  shipSub: number
  shipTax: number
  shipExp: number
  shipTotal: number
  transportReports: TransportReport[]
  transportSub: number
  transportTax: number
  transportTotal: number
  combinedTotal: number
}

type ExpItem = { label: string; amount: number; _type?: string }

/* ------------------------------------------------------------------ */
/* 合算請求書プレビュー（PDFデザイン） */
/* ------------------------------------------------------------------ */

function CombinedInvoiceSheet({ c, settings, onClose }: {
  c: CombinedMonth
  settings: Settings
  onClose: () => void
}) {
  const pr = settings.prices ?? {}

  // 🚢 船舶：カテゴリ別の件数・船員数
  const shipRows = (() => {
    const catSum: Record<string, { count: number; crew: number }> = {}
    c.shipReports.forEach(r => {
      if (!catSum[r.category]) catSum[r.category] = { count: 0, crew: 0 }
      catSum[r.category].count++
      catSum[r.category].crew += r.crew
    })
    return Object.entries(catSum).map(([cat, d]) => {
      const p = pr[cat] ?? { ship: 10000, crew: 1000 }
      return { cat, count: d.count, crew: d.crew, shipP: p.ship, crewP: p.crew ?? 0 }
    })
  })()

  // 🚢 船舶：立替金項目（保存済みのinvoiceがあればそれを優先）
  const shipExpItems: ExpItem[] = (() => {
    if (c.invoice?.expense_items && c.invoice.expense_items.length > 0) return c.invoice.expense_items
    const parkTotal = c.shipReports.reduce((s, r) => s + r.park_fee, 0)
    const hwTotal = c.shipReports.reduce((s, r) => s + r.hw_fee, 0)
    const mealTotal = c.shipReports.reduce((s, r) => s + r.meal, 0)
    const hotelTotal = c.shipReports.reduce((s, r) => s + (r.hotel_fee ?? 0), 0)
    const shinkansenTotal = c.shipReports.reduce((s, r) => s + (r.shinkansen_fee ?? 0), 0)
    const othTotal = c.shipReports.reduce((s, r) => s + r.other_exp, 0)
    const rawExp = c.shipReports.flatMap(r => r.extra_expenses ?? [])
    const extraExp = Object.values(
      rawExp.reduce((acc: Record<string, ExpItem>, item) => {
        acc[item.label] = acc[item.label]
          ? { ...acc[item.label], amount: acc[item.label].amount + item.amount }
          : { ...item }
        return acc
      }, {})
    )
    const fixedItems = (settings.fixed_expenses ?? []).map(e => ({ label: e.label, amount: e.amount, _type: 'fixed' }))
    return [
      { label: '駐車場料金', amount: parkTotal },
      { label: '高速料金', amount: hwTotal },
      { label: '食事代', amount: mealTotal },
      { label: 'ホテル代金', amount: hotelTotal },
      { label: '新幹線代金', amount: shinkansenTotal },
      { label: 'その他立替', amount: othTotal },
      ...extraExp,
      ...fixedItems,
    ].filter(e => e.amount > 0)
  })()

  const [pdfGenerating, setPdfGenerating] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)

  const handleDownloadPdf = async () => {
    if (!sheetRef.current) return
    setPdfGenerating(true)
    const noPrintEls = sheetRef.current.querySelectorAll('.no-print')
    noPrintEls.forEach(el => { (el as HTMLElement).style.display = 'none' })
    try {
      const html2canvas = (await import('html2canvas')).default
      const jsPDF = (await import('jspdf')).jsPDF
      const el = sheetRef.current
      const prevWidth = el.style.width; const prevMax = el.style.maxWidth; const prevMin = el.style.minWidth
      el.style.width = '720px'; el.style.maxWidth = '720px'; el.style.minWidth = '720px'
      await new Promise(r => setTimeout(r, 150))
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff', width: 720, height: el.scrollHeight, windowWidth: 720, windowHeight: el.scrollHeight })
      el.style.width = prevWidth; el.style.maxWidth = prevMax; el.style.minWidth = prevMin

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()
      const margin = 8
      const availWmm = pageW - margin * 2
      const availHmm = pageH - margin * 2
      const pxPerMm = canvas.width / availWmm
      const pageHeightPx = Math.floor(availHmm * pxPerMm)

      let renderedPx = 0
      let page = 0
      while (renderedPx < canvas.height) {
        const sliceHeightPx = Math.min(pageHeightPx, canvas.height - renderedPx)
        const slice = document.createElement('canvas')
        slice.width = canvas.width
        slice.height = sliceHeightPx
        const ctx = slice.getContext('2d')
        if (ctx) ctx.drawImage(canvas, 0, renderedPx, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx)
        const imgData = slice.toDataURL('image/png')
        if (page > 0) pdf.addPage()
        const sliceHmm = sliceHeightPx / pxPerMm
        pdf.addImage(imgData, 'PNG', margin, margin, availWmm, sliceHmm)
        renderedPx += sliceHeightPx
        page++
      }
      pdf.save(`合算請求書_${c.month}.pdf`)
    } catch (e) { console.error('PDF生成エラー:', e) }
    finally {
      noPrintEls.forEach(el => { (el as HTMLElement).style.display = '' })
      setPdfGenerating(false)
    }
  }

  const today = new Date().toLocaleDateString('ja-JP')
  const due = (() => {
    const [y, m] = c.month.split('-').map(Number)
    return new Date(y, m, 0).toLocaleDateString('ja-JP')
  })()

  const tdS = { padding: '7px 8px', fontSize: 12 } as React.CSSProperties
  const thS = { padding: '6px 8px', fontWeight: 500, fontSize: 11, color: '#666', borderBottom: '0.5px solid #ccc', textAlign: 'left' as const }
  const sectionLabel = { fontSize: 10, fontWeight: 700, color: '#555', letterSpacing: '.5px', textTransform: 'uppercase' as const, marginBottom: 4 }
  const summaryBox = { marginTop: 8, padding: '8px 10px', background: '#fafafa', borderRadius: 6, border: '0.5px solid #eee', fontSize: 12 }
  const summaryRow = { display: 'flex', justifyContent: 'space-between' as const, color: '#555', marginBottom: 3 }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 300, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '24px 16px' }}>
      <div style={{ background: '#fff', color: '#222', borderRadius: 10, width: '100%', maxWidth: 720, boxShadow: '0 12px 48px rgba(0,0,0,.22)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', background: '#f7f7f5', borderBottom: '0.5px solid #ddd' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>📑 合算請求書 — {c.month}分</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#999' }}>✕</button>
        </div>

        <div ref={sheetRef} style={{ padding: '24px 28px' }}>
          {/* タイトル・会社情報 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 500, letterSpacing: '0.15em', color: '#1a1a1a' }}>請　求　書</div>
              <div style={{ fontSize: 10, color: '#888', marginTop: 4 }}>登録番号: {settings.invoice_no}</div>
              <div style={{ display: 'inline-flex', gap: 5, marginTop: 6, fontSize: 10, color: '#888' }}>
                <span style={{ background: '#eff6ff', color: '#2563eb', borderRadius: 4, padding: '2px 6px', fontWeight: 600 }}>🚢 船泊</span>
                <span style={{ background: '#f0fdf4', color: '#16a34a', borderRadius: 4, padding: '2px 6px', fontWeight: 600 }}>🚗 送迎</span>
                <span>合算請求</span>
              </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: 11, color: '#555', lineHeight: 1.7 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>{settings.company_name}</div>
              <div>{settings.address}</div>
              <div>{settings.tel} | {settings.email}</div>
            </div>
          </div>
          <div style={{ borderTop: '0.5px solid #ccc', marginBottom: 14 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 10, color: '#999', marginBottom: 3 }}>請求先</div>
              <div style={{ fontSize: 15, fontWeight: 500 }}>{settings.client_name} 御中</div>
            </div>
            <div style={{ textAlign: 'right', fontSize: 11, color: '#666', lineHeight: 1.8 }}>
              <div>件名: {c.month}分 船舶・送迎業務費（合算）</div>
              <div>請求日: {today} / 支払期限: {due}</div>
            </div>
          </div>

          {/* 総額バー */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1a1a1a', color: '#fff', borderRadius: 6, padding: '10px 16px', marginBottom: 12 }}>
            <div style={{ fontSize: 12 }}>ご請求金額（税込・合算）</div>
            <div style={{ fontSize: 20, fontWeight: 500 }}>¥{c.combinedTotal.toLocaleString()}</div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 20, fontSize: 12 }}>
            <div style={{ flex: 1, background: '#eff6ff', borderRadius: 6, padding: '8px 12px', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#2563eb', fontWeight: 600 }}>🚢 船泊請求</span><span style={{ fontWeight: 600 }}>¥{c.shipTotal.toLocaleString()}</span>
            </div>
            <div style={{ flex: 1, background: '#f0fdf4', borderRadius: 6, padding: '8px 12px', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#16a34a', fontWeight: 600 }}>🚗 送迎請求</span><span style={{ fontWeight: 600 }}>¥{c.transportTotal.toLocaleString()}</span>
            </div>
          </div>

          {/* 🚢 船舶セクション */}
          {c.shipReports.length > 0 && (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a', marginBottom: 8, paddingBottom: 6, borderBottom: '1.5px solid #1a1a1a' }}>🚢 船泊業務</div>
              <div style={{ marginBottom: 14 }}>
                <div style={sectionLabel}>業務明細</div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #ddd' }}>
                      <th style={thS}>対応区分</th>
                      <th style={{ ...thS, textAlign: 'right' }}>件数</th>
                      <th style={{ ...thS, textAlign: 'right' }}>船員</th>
                      <th style={{ ...thS, textAlign: 'right' }}>単価（船/人）</th>
                      <th style={{ ...thS, textAlign: 'right' }}>金額</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shipRows.map((r, i) => {
                      const line = r.count * r.shipP + r.crew * r.crewP
                      return (
                        <tr key={i} style={{ borderBottom: '0.5px solid #eee' }}>
                          <td style={tdS}>{r.cat}</td>
                          <td style={{ ...tdS, textAlign: 'right' }}>{r.count}隻</td>
                          <td style={{ ...tdS, textAlign: 'right' }}>{r.crew}名</td>
                          <td style={{ ...tdS, textAlign: 'right', color: '#888' }}>¥{r.shipP.toLocaleString()} / ¥{r.crewP.toLocaleString()}</td>
                          <td style={{ ...tdS, textAlign: 'right', fontWeight: 500 }}>¥{line.toLocaleString()}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <div style={summaryBox}>
                  <div style={summaryRow}><span>業務小計</span><span>¥{c.shipSub.toLocaleString()}</span></div>
                  <div style={summaryRow}><span>消費税（10%）</span><span>¥{c.shipTax.toLocaleString()}</span></div>
                  <div style={{ ...summaryRow, fontWeight: 600, borderTop: '0.5px solid #ddd', paddingTop: 6, marginTop: 3 }}><span>業務請求小計</span><span>¥{(c.shipSub + c.shipTax).toLocaleString()}</span></div>
                </div>
              </div>
              {shipExpItems.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={sectionLabel}>立替金</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                      {shipExpItems.map((e, i) => (
                        <tr key={i} style={{ borderBottom: '0.5px solid #eee' }}>
                          <td style={tdS}>{e.label}</td>
                          <td style={{ ...tdS, textAlign: 'right' }}>¥{e.amount.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ ...summaryBox, display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                    <span>立替金合計</span><span>¥{c.shipExp.toLocaleString()}</span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* 🚗 送迎セクション */}
          {c.transportReports.length > 0 && (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a', marginBottom: 8, paddingBottom: 6, borderBottom: '1.5px solid #1a1a1a' }}>🚗 送迎業務</div>
              <div style={{ marginBottom: 16 }}>
                <div style={sectionLabel}>業務明細</div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #ddd' }}>
                      <th style={thS}>日付</th>
                      <th style={thS}>区間</th>
                      <th style={thS}>乗客</th>
                      <th style={{ ...thS, textAlign: 'right' }}>旅客運送報酬</th>
                      <th style={{ ...thS, textAlign: 'right' }}>点呼手当</th>
                      <th style={{ ...thS, textAlign: 'right' }}>高速代等</th>
                      <th style={{ ...thS, textAlign: 'right' }}>小計</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...c.transportReports].sort((a, b) => a.date.localeCompare(b.date)).map((r, i) => {
                      const area = r.from_area && r.to_area ? `${r.from_area} → ${r.to_area}` : '—'
                      const fare = r.fare ?? 0; const tenko = r.tenko_fee ?? 0; const toll = r.toll_fee ?? 0
                      const sub = fare + tenko + toll
                      return (
                        <tr key={i} style={{ borderBottom: '0.5px solid #eee' }}>
                          <td style={tdS}>{r.date}</td>
                          <td style={tdS}>{area}</td>
                          <td style={{ ...tdS, fontSize: 10, color: '#666' }}>{r.passengers || '—（点呼のみ）'}</td>
                          <td style={{ ...tdS, textAlign: 'right' }}>{fare > 0 ? `¥${fare.toLocaleString()}` : '—'}</td>
                          <td style={{ ...tdS, textAlign: 'right' }}>{tenko > 0 ? `¥${tenko.toLocaleString()}` : '—'}</td>
                          <td style={{ ...tdS, textAlign: 'right' }}>{toll > 0 ? `¥${toll.toLocaleString()}` : '—'}</td>
                          <td style={{ ...tdS, textAlign: 'right', fontWeight: 500 }}>¥{sub.toLocaleString()}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <div style={summaryBox}>
                  <div style={summaryRow}><span>業務小計（税抜）</span><span>¥{c.transportSub.toLocaleString()}</span></div>
                  <div style={summaryRow}><span>消費税（10%）</span><span>¥{c.transportTax.toLocaleString()}</span></div>
                  <div style={{ ...summaryRow, fontWeight: 600, borderTop: '0.5px solid #ddd', paddingTop: 6, marginTop: 3 }}><span>送迎請求小計（税込）</span><span>¥{c.transportTotal.toLocaleString()}</span></div>
                </div>
              </div>
            </>
          )}

          {/* 総合計 */}
          <div style={{ background: '#f7f7f5', borderRadius: 6, padding: '12px 16px', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#666', marginBottom: 4 }}><span>🚢 船泊請求小計（税込）</span><span>¥{c.shipTotal.toLocaleString()}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#666', marginBottom: 4 }}><span>🚗 送迎請求小計（税込）</span><span>¥{c.transportTotal.toLocaleString()}</span></div>
            <div style={{ borderTop: '0.5px solid #ccc', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 600 }}>
              <span>合算ご請求金額</span><span>¥{c.combinedTotal.toLocaleString()}</span>
            </div>
          </div>

          {/* お振込先 */}
          <div style={{ fontSize: 11, color: '#333', lineHeight: 2, borderTop: '1.5px solid #333', paddingTop: 12, marginTop: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, color: '#1a1a1a', letterSpacing: '.05em' }}>【お振込先】</div>
            {settings.bank ? <div>{settings.bank}</div> : null}
            {settings.account ? <div>{settings.account}</div> : null}
            {!settings.bank && !settings.account && <div style={{ color: '#aaa' }}>（設定画面で振込先を登録してください）</div>}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '12px 20px', background: '#f7f7f5', borderTop: '0.5px solid #ddd' }}>
          <Btn onClick={handleDownloadPdf} disabled={pdfGenerating}>{pdfGenerating ? '生成中...' : '📄 PDFダウンロード'}</Btn>
          <Btn onClick={onClose}>閉じる</Btn>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 合算請求書 一覧 */
/* ------------------------------------------------------------------ */

export default function CombinedInvoices({ invoices, reports, settings, onSendCombined, onPaid, onPaidTransport }: {
  invoices: Invoice[]
  reports: Report[]
  settings: Settings
  onSendCombined: (p: {
    month: string; invoiceId: string | null
    shipNeedsSend: boolean; transportNeedsSend: boolean
    shipSubtotal: number; shipTax: number; shipExpenses: number; shipTotal: number; shipCount: number
    transportSubtotal: number; transportTax: number; transportTotal: number; transportCount: number
    combinedTotal: number
  }) => Promise<boolean>
  onPaid: (id: string) => Promise<boolean>
  onPaidTransport: (month: string) => Promise<boolean>
}) {
  const [transportReports, setTransportReports] = useState<TransportReport[]>([])
  const [loading, setLoading] = useState(true)
  const [previewMonth, setPreviewMonth] = useState<string | null>(null)
  const [processing, setProcessing] = useState<string | null>(null)

  const load = async () => {
    const { data, error } = await supabase.from('transport_reports').select('*').order('date', { ascending: false })
    if (!error && data) setTransportReports(data as TransportReport[])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // 日報・送迎日報側の編集を反映するため、画面に戻ったとき再読み込み
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => { document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('focus', onVisible) }
  }, [])

  const months = new Set<string>()
  invoices.forEach(i => months.add(i.billing_month))
  transportReports.forEach(r => months.add(r.bill_month || r.date.slice(0, 7)))

  const combined: CombinedMonth[] = [...months].sort((a, b) => b.localeCompare(a)).map(month => {
    const invoice = invoices.find(i => i.billing_month === month) ?? null
    const shipReports = reports.filter(r => r.bill_month === month)
    const shipSub = shipReports.reduce((s, r) => s + (r.amount ?? 0), 0)
    const shipTax = Math.floor(shipSub * 0.1)
    const shipExp = (() => {
      if (invoice?.expense_items && invoice.expense_items.length > 0) {
        return invoice.expense_items.reduce((s, e) => s + e.amount, 0)
      }
      const reportExp = shipReports.reduce((s, r) =>
        s + r.park_fee + r.hw_fee + r.meal + (r.hotel_fee ?? 0) + (r.shinkansen_fee ?? 0) + r.other_exp +
        (r.extra_expenses ?? []).reduce((es, e) => es + e.amount, 0), 0)
      const fixedExp = (settings.fixed_expenses ?? []).reduce((s: number, e: { amount: number }) => s + e.amount, 0)
      return reportExp + fixedExp
    })()
    const shipTotal = shipSub + shipTax + shipExp
    const tReports = transportReports.filter(r => (r.bill_month || r.date.slice(0, 7)) === month)
    const tSub = tReports.reduce((s, r) => s + (r.fare ?? 0) + (r.tenko_fee ?? 0) + (r.toll_fee ?? 0), 0)
    const tTax = Math.floor(tSub * 0.1)
    const transportTotal = tSub + tTax
    return {
      month, invoice, shipReports, shipSub, shipTax, shipExp, shipTotal,
      transportReports: tReports, transportSub: tSub, transportTax: tTax, transportTotal,
      combinedTotal: shipTotal + transportTotal,
    }
  }).filter(c => c.shipReports.length > 0 || c.transportReports.length > 0)

  const totalAll = combined.reduce((s, c) => s + c.combinedTotal, 0)
  const waitAmt = combined.filter(c => {
    const ss = c.invoice?.status
    const ts = c.transportReports.length > 0 ? getTransportStatus(c.transportReports) : null
    return (ss && ['送信済', '入金待ち'].includes(ss)) || ts === '送信済'
  }).reduce((s, c) => s + c.combinedTotal, 0)
  const paidAmt = combined.filter(c => {
    const ss = c.invoice?.status
    const ts = c.transportReports.length > 0 ? getTransportStatus(c.transportReports) : null
    return ss === '入金済' || ts === '入金済'
  }).reduce((s, c) => s + c.combinedTotal, 0)

  const handleSendBoth = async (c: CombinedMonth) => {
    setProcessing(c.month)
    try {
      const shipNeedsSend = !!c.invoice && ['未請求', '作成済'].includes(c.invoice.status)
      const transportNeedsSend = c.transportReports.length > 0 && getTransportStatus(c.transportReports) === '未請求'
      await onSendCombined({
        month: c.month,
        invoiceId: c.invoice?.id ?? null,
        shipNeedsSend, transportNeedsSend,
        shipSubtotal: c.shipSub, shipTax: c.shipTax, shipExpenses: c.shipExp, shipTotal: c.shipTotal, shipCount: c.shipReports.length,
        transportSubtotal: c.transportSub, transportTax: c.transportTax, transportTotal: c.transportTotal, transportCount: c.transportReports.length,
        combinedTotal: c.combinedTotal,
      })
      await load()
    } finally { setProcessing(null) }
  }

  const handlePaidBoth = async (c: CombinedMonth) => {
    setProcessing(c.month)
    try {
      if (c.invoice && ['送信済', '入金待ち'].includes(c.invoice.status)) await onPaid(c.invoice.id)
      if (c.transportReports.length > 0 && getTransportStatus(c.transportReports) === '送信済') await onPaidTransport(c.month)
      await load()
    } finally { setProcessing(null) }
  }

  const previewC = previewMonth ? combined.find(c => c.month === previewMonth) ?? null : null

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>読み込み中...</div>

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 20 }}>
        {[
          { label: '合算請求総額', value: `¥${totalAll.toLocaleString()}`, color: '#1a1a1a' },
          { label: '入金待ち',     value: `¥${waitAmt.toLocaleString()}`,  color: '#dc2626' },
          { label: '入金済',       value: `¥${paidAmt.toLocaleString()}`,  color: '#16a34a' },
          { label: '対象月数',     value: `${combined.length}ヶ月`,        color: '#d97706' },
        ].map(c => (
          <div key={c.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 14px', boxShadow: 'var(--shadow)' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 3 }}>{c.label}</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
        🚢 船泊請求書と🚗 送迎請求書を月ごとに合算した請求書です。「👁 確認・PDF作成」で見やすいデザインの請求書を確認し、そのままPDFをダウンロードできます。
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
        {combined.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>データがありません</div>
        ) : combined.map((c, idx) => {
          const shipStatus = c.invoice?.status ?? (c.shipReports.length > 0 ? '未請求' : null)
          const tStatus = c.transportReports.length > 0 ? getTransportStatus(c.transportReports) : null
          const canSend = (!!shipStatus && ['未請求', '作成済'].includes(shipStatus)) || tStatus === '未請求'
          const canMarkPaid = (!!shipStatus && ['送信済', '入金待ち'].includes(shipStatus)) || tStatus === '送信済'
          return (
            <div key={c.month} style={{ borderBottom: idx < combined.length - 1 ? '0.5px solid var(--border)' : 'none', padding: '14px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 14, fontWeight: 600, minWidth: 70 }}>{c.month}</div>
                {shipStatus && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>🚢<StatusBadge status={shipStatus} /></span>}
                {tStatus && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>🚗<StatusBadge status={tStatus} /></span>}
                <div style={{ marginLeft: 'auto', fontSize: 16, fontWeight: 600 }}>¥{c.combinedTotal.toLocaleString()}</div>
              </div>
              <div style={{ display: 'flex', gap: 20, fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, flexWrap: 'wrap' }}>
                <span>🚢 船舶 <strong style={{ color: 'var(--text)' }}>¥{c.shipTotal.toLocaleString()}</strong></span>
                <span>🚗 送迎 <strong style={{ color: 'var(--text)' }}>¥{c.transportTotal.toLocaleString()}</strong></span>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <Btn size="sm" onClick={() => setPreviewMonth(c.month)}>👁 確認・PDF作成</Btn>
                {canSend && (
                  <Btn size="sm" variant="success" disabled={processing === c.month} onClick={() => handleSendBoth(c)}>
                    {processing === c.month ? '処理中...' : '📤 まとめて送信'}
                  </Btn>
                )}
                {canMarkPaid && (
                  <Btn size="sm" variant="primary" disabled={processing === c.month} onClick={() => handlePaidBoth(c)}>
                    {processing === c.month ? '処理中...' : '✓ まとめて入金済にする'}
                  </Btn>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {previewC && <CombinedInvoiceSheet c={previewC} settings={settings} onClose={() => setPreviewMonth(null)} />}
    </div>
  )
}

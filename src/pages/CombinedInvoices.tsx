import { useState, useEffect } from 'react'
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

export default function CombinedInvoices({ invoices, reports, settings, onSend, onSendTransport, onPaid, onPaidTransport }: {
  invoices: Invoice[]
  reports: Report[]
  settings: Settings
  onSend: (id: string) => Promise<boolean>
  onSendTransport: (month: string) => Promise<boolean>
  onPaid: (id: string) => Promise<boolean>
  onPaidTransport: (month: string) => Promise<boolean>
}) {
  const [transportReports, setTransportReports] = useState<TransportReport[]>([])
  const [loading, setLoading] = useState(true)
  const [openMonth, setOpenMonth] = useState<string | null>(null)
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
      if (c.invoice && ['未請求', '作成済'].includes(c.invoice.status)) await onSend(c.invoice.id)
      if (c.transportReports.length > 0 && getTransportStatus(c.transportReports) === '未請求') await onSendTransport(c.month)
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
        🚢 船泊請求書と🚗 送迎請求書を月ごとに合算して表示します。送信・入金管理は各タブの請求書に反映されます。
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
        {combined.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>データがありません</div>
        ) : combined.map((c, idx) => {
          const shipStatus = c.invoice?.status ?? (c.shipReports.length > 0 ? '未請求' : null)
          const tStatus = c.transportReports.length > 0 ? getTransportStatus(c.transportReports) : null
          const open = openMonth === c.month
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
              {open && (
                <div style={{ background: '#fafafa', border: '0.5px solid #eee', borderRadius: 6, padding: '10px 12px', marginBottom: 10, fontSize: 12 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>🚢 船泊請求書</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#555' }}><span>業務</span><span>¥{c.shipSub.toLocaleString()}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#555' }}><span>消費税</span><span>¥{c.shipTax.toLocaleString()}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#555' }}><span>立替</span><span>¥{c.shipExp.toLocaleString()}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, borderTop: '0.5px solid #ddd', paddingTop: 4, marginTop: 4 }}><span>小計</span><span>¥{c.shipTotal.toLocaleString()}</span></div>
                  <div style={{ fontWeight: 600, margin: '10px 0 4px' }}>🚗 送迎請求書</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#555' }}><span>業務（税抜）</span><span>¥{c.transportSub.toLocaleString()}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#555' }}><span>消費税</span><span>¥{c.transportTax.toLocaleString()}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, borderTop: '0.5px solid #ddd', paddingTop: 4, marginTop: 4 }}><span>小計</span><span>¥{c.transportTotal.toLocaleString()}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, borderTop: '1px solid #333', paddingTop: 6, marginTop: 6, fontSize: 13 }}><span>合計</span><span>¥{c.combinedTotal.toLocaleString()}</span></div>
                </div>
              )}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <Btn size="sm" onClick={() => setOpenMonth(open ? null : c.month)}>{open ? '閉じる' : '👁 内訳を見る'}</Btn>
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
    </div>
  )
}

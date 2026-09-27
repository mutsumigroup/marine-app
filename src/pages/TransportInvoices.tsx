import { useState, useEffect, useRef } from 'react'
import { Btn } from '../components/UI'
import { supabase } from '../lib/supabase'
import type { TransportReport } from '../types/transport'
import type { Settings } from '../types'

type InvoiceStatus = '未請求' | '送信済' | '入金済'

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    '未請求': ['#fff7e6', '#d97706'],
    '送信済': ['#eff6ff', '#2563eb'],
    '入金済': ['#f0fdf4', '#16a34a'],
  }
  const [bg, color] = map[status] ?? ['#f3f4f6', '#6b7280']
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: bg, color }}>
      {status}
    </span>
  )
}

interface MonthSummary {
  month: string
  reports: TransportReport[]
  totalFare: number
  totalTenko: number
  totalToll: number
  total: number
  status: InvoiceStatus
  paidDate?: string
}

function TransportInvoiceSheet({ summary, settings, onClose, onStatusChange }: {
  summary: MonthSummary
  settings?: Settings
  onClose: () => void
  onStatusChange: (month: string, status: InvoiceStatus, paidDate?: string) => void
}) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const [pdfGenerating, setPdfGenerating] = useState(false)

  const today = new Date().toLocaleDateString('ja-JP')
  const [y, mo] = summary.month.split('-').map(Number)
  const due = new Date(y, mo + 1, 0).toLocaleDateString('ja-JP')
  const tdS = { padding: '6px 8px', fontSize: 11 } as React.CSSProperties
  const thS = { padding: '5px 8px', fontWeight: 500, fontSize: 10, color: '#666', borderBottom: '0.5px solid #ccc', textAlign: 'left' } as React.CSSProperties

  const handleDownloadPdf = async () => {
    if (!sheetRef.current) return
    setPdfGenerating(true)
    const noPrintEls = sheetRef.current.querySelectorAll('.no-print')
    noPrintEls.forEach((el: any) => { el._prevDisplay = el.style.display; el.style.display = 'none' })
    try {
      const html2canvas = (await import('html2canvas')).default
      const jsPDF = (await import('jspdf')).jsPDF
      const el = sheetRef.current
      const prevWidth = el.style.width
      const prevMaxWidth = el.style.maxWidth
      el.style.width = '700px'
      el.style.maxWidth = '700px'
      await new Promise(r => setTimeout(r, 150))
      const canvas = await html2canvas(el, {
        scale: 2, useCORS: true, backgroundColor: '#ffffff',
        width: 700, height: el.scrollHeight,
        windowWidth: 700, windowHeight: el.scrollHeight,
      })
      el.style.width = prevWidth
      el.style.maxWidth = prevMaxWidth
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()
      const margin = 8
      const availW = pageW - margin * 2
      const availH = pageH - margin * 2
      const scaledH = (canvas.height * availW) / canvas.width
      if (scaledH <= availH) {
        pdf.addImage(imgData, 'PNG', margin, margin, availW, scaledH)
      } else {
        const ratio = availH / scaledH
        pdf.addImage(imgData, 'PNG', margin + (availW - availW * ratio) / 2, margin, availW * ratio, availH)
      }
      pdf.save(`送迎請求書_${summary.month}.pdf`)
    } catch (e) { console.error('PDF生成エラー:', e) }
    finally {
      noPrintEls.forEach((el: any) => { el.style.display = el._prevDisplay ?? '' })
      setPdfGenerating(false)
    }
  }

  const sorted = [...summary.reports].sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 300, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '24px 16px' }}>
      <div style={{ background: '#fff', color: '#222', borderRadius: 10, width: '100%', maxWidth: 740, boxShadow: '0 12px 48px rgba(0,0,0,.22)', overflow: 'hidden' }}>

        {/* モーダルヘッダー */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', background: '#f7f7f5', borderBottom: '0.5px solid #ddd' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>送迎請求書 — {summary.month}分</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <StatusBadge status={summary.status} />
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#999' }}>✕</button>
          </div>
        </div>

        {/* 請求書本体（PDF対象） */}
        <div ref={sheetRef} style={{ padding: '24px 28px', background: '#fff' }}>

          {/* タイトル・会社情報 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 500, letterSpacing: '0.15em', color: '#1a1a1a' }}>請　求　書</div>
              {settings?.invoice_no && <div style={{ fontSize: 10, color: '#888', marginTop: 4 }}>登録番号: {settings.invoice_no}</div>}
            </div>
            <div style={{ textAlign: 'right', fontSize: 11, color: '#555', lineHeight: 1.7 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>{settings?.company_name ?? ''}</div>
              <div>{settings?.address ?? ''}</div>
              <div>{[settings?.tel, settings?.email].filter(Boolean).join(' | ')}</div>
            </div>
          </div>

          <div style={{ borderTop: '0.5px solid #ccc', marginBottom: 14 }} />

          {/* 請求先・件名 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 10, color: '#999', marginBottom: 3 }}>請求先</div>
              <div style={{ fontSize: 15, fontWeight: 500 }}>{settings?.client_name ?? ''} 御中</div>
            </div>
            <div style={{ textAlign: 'right', fontSize: 11, color: '#666', lineHeight: 1.8 }}>
              <div>件名: {summary.month}分 送迎業務費</div>
              <div>請求日: {today} / 支払期限: {due}</div>
            </div>
          </div>

          {/* 合計金額バー */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1a1a1a', color: '#fff', borderRadius: 6, padding: '10px 16px', marginBottom: 20 }}>
            <div style={{ fontSize: 12 }}>ご請求金額（税抜）</div>
            <div style={{ fontSize: 20, fontWeight: 500 }}>¥{summary.total.toLocaleString()}</div>
          </div>

          {/* 業務明細テーブル */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#888', letterSpacing: '.5px', marginBottom: 6 }}>業務明細</div>
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
                {sorted.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '0.5px solid #eee' }}>
                    <td style={tdS}>{r.date}</td>
                    <td style={tdS}>{r.from_area} → {r.to_area}</td>
                    <td style={{ ...tdS, maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.passengers || '—'}</td>
                    <td style={{ ...tdS, textAlign: 'right' }}>¥{(r.fare ?? 0).toLocaleString()}</td>
                    <td style={{ ...tdS, textAlign: 'right' }}>{(r.tenko_fee ?? 0) > 0 ? `¥${r.tenko_fee.toLocaleString()}` : '—'}</td>
                    <td style={{ ...tdS, textAlign: 'right' }}>{(r.toll_fee ?? 0) > 0 ? `¥${r.toll_fee.toLocaleString()}` : '—'}</td>
                    <td style={{ ...tdS, textAlign: 'right', fontWeight: 500 }}>¥{(r.total ?? 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* 小計ボックス */}
            <div style={{ marginTop: 8, padding: '8px 10px', background: '#fafafa', borderRadius: 6, border: '0.5px solid #eee', fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#555', marginBottom: 3 }}>
                <span>旅客運送報酬 小計</span><span>¥{summary.totalFare.toLocaleString()}</span>
              </div>
              {summary.totalTenko > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#555', marginBottom: 3 }}>
                  <span>点呼手当 小計</span><span>¥{summary.totalTenko.toLocaleString()}</span>
                </div>
              )}
              {summary.totalToll > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#555', marginBottom: 3 }}>
                  <span>高速代等 小計</span><span>¥{summary.totalToll.toLocaleString()}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, borderTop: '0.5px solid #ddd', paddingTop: 6, marginTop: 3 }}>
                <span>合計</span><span>¥{summary.total.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* 振込先 */}
          <div style={{ fontSize: 11, color: '#333', lineHeight: 2, borderTop: '1.5px solid #333', paddingTop: 12, marginTop: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, color: '#1a1a1a', letterSpacing: '.05em' }}>【お振込先】</div>
            {settings?.bank ? <div>{settings.bank}</div> : null}
            {settings?.account ? <div>{settings.account}</div> : null}
            {!settings?.bank && !settings?.account && <div style={{ color: '#aaa' }}>（設定画面で振込先を登録してください）</div>}
          </div>
        </div>

        {/* フッターボタン */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '12px 20px', background: '#f7f7f5', borderTop: '0.5px solid #ddd', flexWrap: 'wrap' }}>
          <Btn onClick={handleDownloadPdf} disabled={pdfGenerating}>
            {pdfGenerating ? '生成中...' : '📄 PDFダウンロード'}
          </Btn>
          <Btn onClick={onClose}>閉じる</Btn>
          {summary.status === '未請求' && (
            <Btn variant="success" onClick={() => { onStatusChange(summary.month, '送信済'); onClose() }}>
              📤 送信済にする
            </Btn>
          )}
          {summary.status === '送信済' && (
            <Btn variant="primary" onClick={() => { onStatusChange(summary.month, '入金済', new Date().toLocaleDateString('ja-JP')); onClose() }}>
              ✓ 入金済にする
            </Btn>
          )}
          {summary.status !== '未請求' && (
            <Btn variant="ghost" onClick={() => { onStatusChange(summary.month, '未請求'); onClose() }}
              style={{ fontSize: 11, color: 'var(--text-muted)', border: '1px dashed var(--border-dark)' }}>
              ↩ 未請求に戻す
            </Btn>
          )}
        </div>
      </div>
    </div>
  )
}

interface Props {
  settings?: Settings
}

export default function TransportInvoices({ settings }: Props) {
  const [reports, setReports] = useState<TransportReport[]>([])
  const [loading, setLoading] = useState(true)
  const [statuses, setStatuses] = useState<Record<string, { status: InvoiceStatus; paidDate?: string }>>({})
  const [previewMonth, setPreviewMonth] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('transport_reports')
        .select('*')
        .order('date', { ascending: false })
      if (!error && data) setReports(data as TransportReport[])
      setLoading(false)
    }
    load()
  }, [])

  // localStorageからステータスを読み込む
  useEffect(() => {
    const saved: Record<string, { status: InvoiceStatus; paidDate?: string }> = {}
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) ?? ''
      if (key.startsWith('tiv_status_')) {
        const month = key.replace('tiv_status_', '')
        const status = (localStorage.getItem(key) ?? '未請求') as InvoiceStatus
        const paidDate = localStorage.getItem(`tiv_paid_${month}`) ?? undefined
        saved[month] = { status, paidDate }
      }
    }
    setStatuses(saved)
  }, [])

  const handleStatusChange = (month: string, status: InvoiceStatus, paidDate?: string) => {
    localStorage.setItem(`tiv_status_${month}`, status)
    if (paidDate) localStorage.setItem(`tiv_paid_${month}`, paidDate)
    else localStorage.removeItem(`tiv_paid_${month}`)
    setStatuses(prev => ({ ...prev, [month]: { status, paidDate } }))
  }

  // 月別にグループ化
  const monthMap = new Map<string, TransportReport[]>()
  reports.forEach(r => {
    const m = r.bill_month || r.date.slice(0, 7)
    if (!monthMap.has(m)) monthMap.set(m, [])
    monthMap.get(m)!.push(r)
  })

  const summaries: MonthSummary[] = [...monthMap.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([month, reps]) => ({
      month,
      reports: reps,
      totalFare:  reps.reduce((s, r) => s + (r.fare ?? 0), 0),
      totalTenko: reps.reduce((s, r) => s + (r.tenko_fee ?? 0), 0),
      totalToll:  reps.reduce((s, r) => s + (r.toll_fee ?? 0), 0),
      total:      reps.reduce((s, r) => s + (r.total ?? 0), 0),
      status:     (statuses[month]?.status ?? '未請求') as InvoiceStatus,
      paidDate:   statuses[month]?.paidDate,
    }))

  const totalAll  = summaries.reduce((s, m) => s + m.total, 0)
  const waitAmt   = summaries.filter(m => m.status === '送信済').reduce((s, m) => s + m.total, 0)
  const paidAmt   = summaries.filter(m => m.status === '入金済').reduce((s, m) => s + m.total, 0)
  const unpaidCnt = summaries.filter(m => m.status === '未請求').length

  const previewSummary = previewMonth ? summaries.find(s => s.month === previewMonth) ?? null : null

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>読み込み中...</div>

  return (
    <div>
      {/* サマリーカード（船泊と同じ4枚） */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 20 }}>
        {[
          { label: '請求総額',   value: `¥${totalAll.toLocaleString()}`,  color: '#1a1a1a' },
          { label: '入金待ち',   value: `¥${waitAmt.toLocaleString()}`,   color: '#dc2626' },
          { label: '入金済',     value: `¥${paidAmt.toLocaleString()}`,   color: '#16a34a' },
          { label: '未請求件数', value: `${unpaidCnt}件`,                  color: '#d97706' },
        ].map(c => (
          <div key={c.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 14px', boxShadow: 'var(--shadow)' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 3 }}>{c.label}</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* 月別リスト */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
        {summaries.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            送迎日報がありません。まず送迎日報を作成してください。
          </div>
        ) : summaries.map((s, idx) => (
          <div key={s.month}
            style={{ borderBottom: idx < summaries.length - 1 ? '0.5px solid var(--border)' : 'none', padding: '14px 18px', transition: 'background .1s' }}
            onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'var(--surface2,#f9f9f9)'}
            onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = ''}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 14, fontWeight: 600, minWidth: 70 }}>{s.month}</div>
              <StatusBadge status={s.status} />
              <div style={{ marginLeft: 'auto', fontSize: 16, fontWeight: 600 }}>¥{s.total.toLocaleString()}</div>
            </div>
            <div style={{ display: 'flex', gap: 20, fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, flexWrap: 'wrap' }}>
              <span>旅客運送報酬 <strong style={{ color: 'var(--text)' }}>¥{s.totalFare.toLocaleString()}</strong></span>
              <span>点呼手当 <strong style={{ color: 'var(--text)' }}>¥{s.totalTenko.toLocaleString()}</strong></span>
              {s.totalToll > 0 && <span>高速代等 <strong style={{ color: 'var(--text)' }}>¥{s.totalToll.toLocaleString()}</strong></span>}
              <span>件数 <strong style={{ color: 'var(--text)' }}>{s.reports.length}件</strong></span>
              {s.paidDate && <span>入金日 <strong style={{ color: 'var(--text)' }}>{s.paidDate}</strong></span>}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Btn size="sm" onClick={() => setPreviewMonth(s.month)}>👁 確認・編集</Btn>
              {s.status === '未請求' && (
                <Btn size="sm" variant="success" onClick={() => handleStatusChange(s.month, '送信済')}>
                  📤 送信済にする
                </Btn>
              )}
              {s.status === '送信済' && (
                <Btn size="sm" variant="primary" onClick={() => handleStatusChange(s.month, '入金済', new Date().toLocaleDateString('ja-JP'))}>
                  ✓ 入金済にする
                </Btn>
              )}
              {s.status === '入金済' && (
                <Btn size="sm" variant="ghost" onClick={() => handleStatusChange(s.month, '送信済')}
                  style={{ fontSize: 11, color: 'var(--text-muted)', border: '1px dashed var(--border-dark)' }}>
                  ↩ 送信済に戻す
                </Btn>
              )}
              {s.status === '送信済' && (
                <Btn size="sm" variant="ghost" onClick={() => handleStatusChange(s.month, '未請求')}
                  style={{ fontSize: 11, color: 'var(--text-muted)', border: '1px dashed var(--border-dark)' }}>
                  ↩ 未請求に戻す
                </Btn>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 請求書モーダル */}
      {previewSummary && (
        <TransportInvoiceSheet
          summary={previewSummary}
          settings={settings}
          onClose={() => setPreviewMonth(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  )
}

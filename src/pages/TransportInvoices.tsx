import { useState, useEffect, useRef } from 'react'
import { Btn } from '../components/UI'
import { supabase } from '../lib/supabase'
import type { TransportReport } from '../types/transport'

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

function InlineNum({ value, onChange, width = 70 }: { value: number; onChange: (v: number) => void; width?: number }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const open = () => { setDraft(String(value)); setEditing(true) }
  const commit = () => {
    const n = parseInt(draft.replace(/[^0-9]/g, ''), 10)
    if (!isNaN(n)) onChange(n)
    setEditing(false)
  }
  if (editing) {
    return (
      <input autoFocus value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
        style={{ width, textAlign: 'right', padding: '2px 4px', border: '1.5px solid #2563eb', borderRadius: 4, fontSize: 12, background: '#eff6ff', color: '#1d4ed8', outline: 'none', fontFamily: 'inherit' }}
      />
    )
  }
  return (
    <span onClick={open} title="クリックして編集"
      style={{ cursor: 'text', borderBottom: '1px dashed #bbb', paddingBottom: 1, display: 'inline-block', minWidth: width, textAlign: 'right' }}>
      {value.toLocaleString()}
    </span>
  )
}

interface EditableRow extends TransportReport {
  _fare: number
  _tenko: number
  _toll: number
}

function TransportInvoiceSheet({ month, reports: initReports, settings, onClose }: {
  month: string
  reports: TransportReport[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  settings: any
  onClose: () => void
}) {
  const [rows, setRows] = useState<EditableRow[]>(
    [...initReports]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(r => ({ ...r, _fare: r.fare ?? 0, _tenko: r.tenko_fee ?? 0, _toll: r.toll_fee ?? 0 }))
  )
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pdfGenerating, setPdfGenerating] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)

  const setRow = (i: number, field: '_fare' | '_tenko' | '_toll', v: number) => {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: v } : r))
    setDirty(true)
  }

  const totalFare   = rows.reduce((s, r) => s + r._fare, 0)
  const totalTenko  = rows.reduce((s, r) => s + r._tenko, 0)
  const subtotal    = totalFare + totalTenko
  const tax         = Math.floor(subtotal * 0.1)
  const total       = subtotal + tax

  const handleSave = async () => {
    setSaving(true)
    for (const r of rows) {
      await supabase.from('transport_reports').update({
        fare: r._fare,
        tenko_fee: r._tenko,
        toll_fee: r._toll,
        total: r._fare + r._tenko,
      }).eq('id', r.id)
    }
    setDirty(false)
    setSaving(false)
  }

  const handleDownloadPdf = async () => {
    if (!sheetRef.current) return
    setPdfGenerating(true)
    const noPrintEls = sheetRef.current.querySelectorAll('.no-print')
    noPrintEls.forEach((el: Element) => { (el as HTMLElement).style.display = 'none' })
    const inlineSpans = sheetRef.current.querySelectorAll('span[title="クリックして編集"]')
    inlineSpans.forEach((el: Element) => { (el as HTMLElement).style.borderBottom = 'none'; (el as HTMLElement).style.cursor = 'default' })
    try {
      const html2canvas = (await import('html2canvas')).default
      const jsPDF = (await import('jspdf')).jsPDF
      const el = sheetRef.current
      const prevWidth = el.style.width; const prevMax = el.style.maxWidth
      el.style.width = '780px'; el.style.maxWidth = '780px'
      await new Promise(r => setTimeout(r, 150))
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff', width: 780, height: el.scrollHeight, windowWidth: 780, windowHeight: el.scrollHeight })
      el.style.width = prevWidth; el.style.maxWidth = prevMax
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageW = pdf.internal.pageSize.getWidth(); const margin = 8
      const availW = pageW - margin * 2; const availH = pdf.internal.pageSize.getHeight() - margin * 2
      const scaledH = (canvas.height * availW) / canvas.width
      if (scaledH <= availH) {
        pdf.addImage(imgData, 'PNG', margin, margin, availW, scaledH)
      } else {
        const ratio = availH / scaledH
        pdf.addImage(imgData, 'PNG', margin + (availW - availW * ratio) / 2, margin, availW * ratio, availH)
      }
      pdf.save(`送迎請求書_${month}.pdf`)
    } catch (e) { console.error('PDF生成エラー:', e) }
    finally {
      noPrintEls.forEach((el: Element) => { (el as HTMLElement).style.display = '' })
      inlineSpans.forEach((el: Element) => { (el as HTMLElement).style.borderBottom = '1px dashed #bbb'; (el as HTMLElement).style.cursor = 'text' })
      setPdfGenerating(false)
    }
  }

  const today = new Date().toLocaleDateString('ja-JP')
  const due = (() => {
    const [y, m] = month.split('-').map(Number)
    return new Date(y, m + 1, 0).toLocaleDateString('ja-JP')
  })()

  const tdS = { padding: '6px 8px', fontSize: 11 } as React.CSSProperties
  const thS = { padding: '6px 8px', fontWeight: 500, fontSize: 10, color: '#666', borderBottom: '0.5px solid #ccc', textAlign: 'left' as const, whiteSpace: 'nowrap' as const }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 300, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '24px 16px' }}>
      <div style={{ background: '#fff', color: '#222', borderRadius: 10, width: '100%', maxWidth: 780, boxShadow: '0 12px 48px rgba(0,0,0,.22)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', background: '#f7f7f5', borderBottom: '0.5px solid #ddd' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>送迎請求書 — {month}分</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <StatusBadge status="未請求" />
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#999' }}>✕</button>
          </div>
        </div>

        <div ref={sheetRef} style={{ padding: '24px 28px' }}>
          {/* Title */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 500, letterSpacing: '0.15em', color: '#1a1a1a' }}>請　求　書</div>
              <div style={{ fontSize: 10, color: '#888', marginTop: 4 }}>登録番号: {settings.invoice_no}</div>
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
              <div>件名: {month}分 送迎業務費</div>
              <div>請求日: {today} / 支払期限: {due}</div>
            </div>
          </div>

          {/* Total bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1a1a1a', color: '#fff', borderRadius: 6, padding: '10px 16px', marginBottom: 20 }}>
            <div style={{ fontSize: 12 }}>ご請求金額（税込）</div>
            <div style={{ fontSize: 20, fontWeight: 500 }}>¥{total.toLocaleString()}</div>
          </div>

          {/* Detail table */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#888', letterSpacing: '.5px', marginBottom: 4 }}>業務明細</div>
            <div className="no-print" style={{ fontSize: 10, color: '#aaa', marginBottom: 6 }}>旅客運送報酬・点呼手当・高速代等をクリックして編集できます</div>
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
                {rows.map((r, i) => {
                  const area = r.from_area && r.to_area ? `${r.from_area} → ${r.to_area}` : '—'
                  const sub = r._fare + r._tenko
                  return (
                    <tr key={r.id} style={{ borderBottom: '0.5px solid #eee' }}>
                      <td style={tdS}>{r.date}</td>
                      <td style={tdS}>{area}</td>
                      <td style={{ ...tdS, fontSize: 10, color: '#666' }}>{r.passengers || '—（点呼のみ）'}</td>
                      <td style={{ ...tdS, textAlign: 'right' }}>
                        {r._fare > 0 ? <>¥<InlineNum value={r._fare} onChange={v => setRow(i, '_fare', v)} /></> : '—'}
                      </td>
                      <td style={{ ...tdS, textAlign: 'right' }}>
                        {r._tenko > 0 ? <>¥<InlineNum value={r._tenko} onChange={v => setRow(i, '_tenko', v)} /></> : '—'}
                      </td>
                      <td style={{ ...tdS, textAlign: 'right' }}>
                        {r._toll > 0 ? <>¥<InlineNum value={r._toll} onChange={v => setRow(i, '_toll', v)} /></> : '—'}
                      </td>
                      <td style={{ ...tdS, textAlign: 'right', fontWeight: 500 }}>¥{sub.toLocaleString()}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* Summary box */}
            <div style={{ marginTop: 8, padding: '8px 10px', background: '#fafafa', borderRadius: 6, border: '0.5px solid #eee', fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#555', marginBottom: 3 }}><span>旅客運送報酬 小計</span><span>¥{totalFare.toLocaleString()}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#555', marginBottom: 3 }}><span>点呼手当 小計</span><span>¥{totalTenko.toLocaleString()}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#555', marginBottom: 3, borderTop: '0.5px solid #ddd', paddingTop: 4, marginTop: 4 }}><span>業務小計（税抜）</span><span>¥{subtotal.toLocaleString()}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#555', marginBottom: 3 }}><span>消費税（10%）</span><span>¥{tax.toLocaleString()}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, borderTop: '0.5px solid #ddd', paddingTop: 6, marginTop: 3 }}><span>合計（税込）</span><span>¥{total.toLocaleString()}</span></div>
            </div>
          </div>

          {/* Bank */}
          <div style={{ fontSize: 11, color: '#333', lineHeight: 2, borderTop: '1.5px solid #333', paddingTop: 12, marginTop: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, color: '#1a1a1a', letterSpacing: '.05em' }}>【お振込先】</div>
            {settings.bank ? <div>{settings.bank}</div> : null}
            {settings.account ? <div>{settings.account}</div> : null}
            {!settings.bank && !settings.account && <div style={{ color: '#aaa' }}>（設定画面で振込先を登録してください）</div>}
          </div>

          {dirty && (
            <div className="no-print" style={{ marginTop: 14, padding: '8px 12px', background: '#fffbeb', border: '1px solid #f59e0b', borderRadius: 6, fontSize: 12, color: '#92400e' }}>
              ✏️ 金額が変更されています。「保存」を押してSupabaseに反映してください。
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '12px 20px', background: '#f7f7f5', borderTop: '0.5px solid #ddd' }}>
          <Btn onClick={handleDownloadPdf} disabled={pdfGenerating}>{pdfGenerating ? '生成中...' : '📄 PDFダウンロード'}</Btn>
          <Btn onClick={onClose}>閉じる</Btn>
          {dirty && <Btn variant="primary" disabled={saving} onClick={handleSave}>{saving ? '保存中...' : '💾 保存'}</Btn>}
        </div>
      </div>
    </div>
  )
}

interface MonthSummary {
  month: string
  reports: TransportReport[]
  totalFare: number
  totalTenko: number
  total: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function TransportInvoices({ settings }: { settings: any }) {
  const [reports, setReports] = useState<TransportReport[]>([])
  const [loading, setLoading] = useState(true)
  const [previewMonth, setPreviewMonth] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('transport_reports')
      .select('*')
      .order('date', { ascending: false })
    if (!error && data) setReports(data as TransportReport[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

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
      totalFare: reps.reduce((s, r) => s + (r.fare ?? 0), 0),
      totalTenko: reps.reduce((s, r) => s + (r.tenko_fee ?? 0), 0),
      total: reps.reduce((s, r) => s + (r.total ?? 0), 0),
    }))

  const totalAll = summaries.reduce((s, m) => s + Math.floor(m.total * 1.1), 0)
  const previewSummary = previewMonth ? summaries.find(s => s.month === previewMonth) ?? null : null

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>読み込み中...</div>

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 20 }}>
        {[
          { label: '送迎請求総額', value: `¥${totalAll.toLocaleString()}`, color: '#1a1a1a' },
          { label: '月数',         value: `${summaries.length}ヶ月`,       color: '#2563eb' },
          { label: '総件数',       value: `${reports.length}件`,            color: '#d97706' },
        ].map(c => (
          <div key={c.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 14px', boxShadow: 'var(--shadow)' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 3 }}>{c.label}</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

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
              <StatusBadge status="未請求" />
              <div style={{ marginLeft: 'auto', fontSize: 16, fontWeight: 600 }}>¥{Math.floor(s.total * 1.1).toLocaleString()}</div>
            </div>
            <div style={{ display: 'flex', gap: 20, fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, flexWrap: 'wrap' }}>
              <span>旅客運送報酬 <strong style={{ color: 'var(--text)' }}>¥{s.totalFare.toLocaleString()}</strong></span>
              <span>点呼手当 <strong style={{ color: 'var(--text)' }}>¥{s.totalTenko.toLocaleString()}</strong></span>
              <span>消費税（10%） <strong style={{ color: 'var(--text)' }}>¥{Math.floor(s.total * 0.1).toLocaleString()}</strong></span>
              <span>件数 <strong style={{ color: 'var(--text)' }}>{s.reports.length}件</strong></span>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Btn size="sm" onClick={() => setPreviewMonth(s.month)}>👁 確認・編集</Btn>
              <Btn size="sm" variant="success" onClick={() => setPreviewMonth(s.month)}>📤 PDF生成・送信</Btn>
            </div>
          </div>
        ))}
      </div>

      {previewSummary && (
        <TransportInvoiceSheet
          key={previewSummary.month}
          month={previewSummary.month}
          reports={previewSummary.reports}
          settings={settings}
          onClose={() => { setPreviewMonth(null); load() }}
        />
      )}
    </div>
  )
}

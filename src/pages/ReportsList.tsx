import React, { useState, useRef, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Card, Select, PageHeader, Btn, Field, Input, Grid, Divider, useIsMobile } from '../components/UI'
import { CATEGORIES } from '../types'
import type { Report } from '../types'

interface Props {
  reports: Report[]
  onUpdateAmount: (id: string, amount: number) => Promise<boolean>
  onSavePdf: (id: string, url: string) => void
  onUpdateReport: (id: string, updates: Partial<Report>) => Promise<boolean>
  onDeleteReport: (id: string) => Promise<boolean>
  prices?: Record<string, { ship: number; crew: number }>
}

function HwPopup({ report, onClose, onSavePdf }: { report: Report; onClose: () => void; onSavePdf: (id: string, url: string) => void }) {
  const [pdfUrl, setPdfUrl] = useState(report.voucher?.startsWith('http') ? report.voucher : '')
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || file.type !== 'application/pdf') return
    setUploading(true)
    const reader = new FileReader()
    reader.onload = (ev) => { const url = ev.target?.result as string; setPdfUrl(url); onSavePdf(report.id, url); setUploading(false) }
    reader.readAsDataURL(file)
  }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'var(--surface)', borderRadius: 12, padding: '20px 24px', width: 500, boxShadow: '0 8px 32px rgba(0,0,0,.18)', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>🛣 高速道路詳細</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)' }}>✕</button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>{report.date}　{report.ship}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          {[['行き 出発地', report.hw_from1], ['行き 到着地', report.hw_to1], ['帰り 出発地', report.hw_from2], ['帰り 到着地', report.hw_to2]].map(([label, val]) => (
            <div key={label} style={{ background: 'var(--surface2)', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{val || '—'}</div>
            </div>
          ))}
        </div>
        <div style={{ background: 'var(--accent-bg)', borderRadius: 8, padding: '12px 14px', border: '1px solid var(--accent-border)', marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>高速料金合計</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>¥{report.hw_fee.toLocaleString()}</div>
        </div>
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10, color: 'var(--text-secondary)' }}>📎 領収書PDF</div>
          {pdfUrl && <div style={{ marginBottom: 10 }}><a href={pdfUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', fontSize: 12, textDecoration: 'underline' }}>🔗 添付PDFを開く</a></div>}
          <input ref={fileRef} type="file" accept="application/pdf" style={{ display: 'none' }} onChange={handleFile} />
          <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius)', border: '1px dashed var(--border-dark)', background: 'var(--surface2)', cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)', width: '100%', justifyContent: 'center' }}>
            {uploading ? '読み込み中...' : '📄 PDFをアップロード'}
          </button>
        </div>
      </div>
    </div>
  )
}

function EditModal({ report, onClose, onSave, onDelete, prices }: { report: Report; onClose: () => void; onSave: (id: string, updates: Partial<Report>) => Promise<boolean>; onDelete: (id: string) => Promise<boolean>; prices: Record<string, { ship: number; crew: number }> }) {
  const [f, setF] = useState({ ...report })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [autoCalc, setAutoCalc] = useState(true)
  const set = (key: keyof Report) => (v: string) => setF(prev => ({ ...prev, [key]: v }))
  const setNum = (key: keyof Report) => (v: string) => setF(prev => ({ ...prev, [key]: parseInt(v) || 0 }))
  const calcAmount = (cat: string, crew: number) => { const p = prices[cat] ?? { ship: 10000, crew: 1000 }; return p.ship + crew * (p.crew ?? 0) }
  const handleCategoryChange = (v: string) => { setF(prev => { const newAmount = autoCalc ? calcAmount(v, Number(prev.crew)) : prev.amount; return { ...prev, category: v, amount: newAmount } }) }
  const handleCrewChange = (v: string) => { setF(prev => { const crew = parseInt(v) || 0; const newAmount = autoCalc ? calcAmount(prev.category, crew) : prev.amount; return { ...prev, crew, amount: newAmount } }) }
  const handleDelete = async () => { setDeleting(true); const ok = await onDelete(report.id); setDeleting(false); if (ok) onClose() }
  const handleSave = async () => { setSaving(true); const exp = (parseInt(String(f.park_fee)) || 0) + (parseInt(String(f.hw_fee)) || 0) + (parseInt(String(f.meal)) || 0) + (parseInt(String(f.other_exp)) || 0); const ok = await onSave(report.id, { ...f, expenses: exp }); setSaving(false); if (ok) onClose() }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'var(--surface)', borderRadius: 12, padding: '20px 24px', width: '100%', maxWidth: 680, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,.18)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>✏ 日報を編集</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)' }}>✕</button>
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 10 }}>基本情報</div>
        <Grid cols={3} style={{ marginBottom: 10 }}>
          <Field label="稼働日"><Input type="date" value={f.date} onChange={set('date')} /></Field>
          <Field label="港名"><Input value={f.port} onChange={set('port')} /></Field>
          <Field label="船名"><Input value={f.ship} onChange={set('ship')} /></Field>
        </Grid>
        <Grid cols={3} style={{ marginBottom: 10 }}>
          <Field label="船員人数"><Input type="number" value={String(f.crew)} onChange={handleCrewChange} /></Field>
          <Field label="対応区分"><select value={f.category} onChange={e => handleCategoryChange(e.target.value)} style={{ padding: '6px 9px', border: '1px solid var(--border-dark)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, width: '100%' }}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></Field>
          <Field label="業務内容"><Input value={f.work} onChange={set('work')} /></Field>
        </Grid>
        <Grid cols={2} style={{ marginBottom: 10 }}>
          <Field label="Voucher"><Input value={f.voucher} onChange={set('voucher')} /></Field>
          <Field label="請求対象月"><Input type="month" value={f.bill_month} onChange={set('bill_month')} /></Field>
        </Grid>
        <Divider />
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 10 }}>交通費・立替</div>
        <Grid cols={2} style={{ marginBottom: 10 }}>
          <Field label="駐車場場所"><Input value={f.park_place} onChange={set('park_place')} /></Field>
          <Field label="駐車場料金（円）"><Input type="number" value={String(f.park_fee)} onChange={setNum('park_fee')} /></Field>
        </Grid>
        <Grid cols={4} style={{ marginBottom: 10 }}>
          <Field label="行き 出発地"><Input value={f.hw_from1} onChange={set('hw_from1')} /></Field>
          <Field label="行き 到着地"><Input value={f.hw_to1} onChange={set('hw_to1')} /></Field>
          <Field label="帰り 出発地"><Input value={f.hw_from2} onChange={set('hw_from2')} /></Field>
          <Field label="帰り 到着地"><Input value={f.hw_to2} onChange={set('hw_to2')} /></Field>
        </Grid>
        <Grid cols={3} style={{ marginBottom: 10 }}>
          <Field label="高速料金（円）"><Input type="number" value={String(f.hw_fee)} onChange={setNum('hw_fee')} /></Field>
          <Field label="食事代（円）"><Input type="number" value={String(f.meal)} onChange={setNum('meal')} /></Field>
          <Field label="その他立替（円）"><Input type="number" value={String(f.other_exp)} onChange={setNum('other_exp')} /></Field>
        </Grid>
        {f.extra_expenses && f.extra_expenses.length > 0 && (
          <div style={{ marginTop: 8, marginBottom: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 8 }}>追加立替項目</div>
            {f.extra_expenses.map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                <input
                  value={item.label}
                  onChange={(e) => { const updated = [...f.extra_expenses!]; updated[i] = { ...updated[i], label: e.target.value }; setF(prev => ({ ...prev, extra_expenses: updated })) }}
                  style={{ flex: 1, padding: '6px 8px', border: '1px solid var(--border-dark)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13 }}
                  placeholder="項目名"
                />
                <input
                  type="number"
                  value={item.amount}
                  onChange={(e) => { const updated = [...f.extra_expenses!]; updated[i] = { ...updated[i], amount: parseInt(e.target.value) || 0 }; setF(prev => ({ ...prev, extra_expenses: updated })) }}
                  style={{ width: 100, padding: '6px 8px', border: '1px solid var(--border-dark)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--accent)', fontSize: 13, textAlign: 'right' }}
                  placeholder="金額"
                />
              </div>
            ))}
          </div>
        )}
        <Divider />
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 10 }}>売上</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <input type="checkbox" checked={autoCalc} onChange={e => { setAutoCalc(e.target.checked); if (e.target.checked) setF(prev => ({ ...prev, amount: calcAmount(prev.category, Number(prev.crew)) })) }} />
            対応区分・船員人数から自動計算
          </label>
          {autoCalc && <span style={{ fontSize: 11, color: 'var(--accent)', background: 'var(--accent-bg)', padding: '2px 8px', borderRadius: 'var(--radius)', border: '1px solid var(--accent-border)' }}>自動計算中 ¥{calcAmount(f.category, Number(f.crew)).toLocaleString()}</span>}
        </div>
        <Grid cols={2} style={{ marginBottom: 10 }}>
          <Field label="売上金額（円）"><Input type="number" value={String(f.amount)} onChange={v => { setAutoCalc(false); setNum('amount')(v) }} /></Field>
          <Field label="備考"><Input value={f.notes} onChange={set('notes')} /></Field>
        </Grid>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', marginTop: 16 }}>
          <div>
            {!confirmDelete ? <Btn onClick={() => setConfirmDelete(true)} disabled={deleting}>🗑 削除</Btn> : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--error, #dc2626)', fontWeight: 600 }}>本当に削除しますか？</span>
                <Btn onClick={handleDelete} disabled={deleting}>{deleting ? '削除中...' : '✓ はい、削除する'}</Btn>
                <Btn onClick={() => setConfirmDelete(false)}>キャンセル</Btn>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn onClick={onClose}>閉じる</Btn>
            <Btn variant="primary" onClick={handleSave} disabled={saving}>{saving ? '保存中...' : '✓ 保存する'}</Btn>
          </div>
        </div>
      </div>
    </div>
  )
}


// 業務内容ポップアップ
function ExtraExpenseCell({ items }: { items: {label: string; amount: number}[] }) {
  const [show, setShow] = React.useState(false)
  const total = items.reduce((sum, e) => sum + e.amount, 0)
  return (
    <>
      <div onClick={(e) => { e.stopPropagation(); setShow(true) }}
        style={{ cursor: 'pointer', color: 'var(--accent)', fontSize: 12, textDecoration: 'underline dotted', textUnderlineOffset: 3 }}>
        ¥{total.toLocaleString()}
      </div>
      {show && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setShow(false)}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px', maxWidth: 300, width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,.2)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 10 }}>追加立替項目</div>
            {items.map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none', fontSize: 13 }}>
                <span style={{ color: 'var(--text)' }}>{item.label}</span>
                <span style={{ color: 'var(--accent)', fontWeight: 600 }}>¥{item.amount.toLocaleString()}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0 0', marginTop: 6, fontSize: 13, fontWeight: 700 }}>
              <span>合計</span>
              <span style={{ color: 'var(--accent)' }}>¥{total.toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function WorkCell({ work }: { work: string }) {
  const [show, setShow] = React.useState(false)
  if (!work || work === '—') return <span style={{ color: 'var(--text-light)', fontSize: 11 }}>—</span>
  return (
    <>
      <div onClick={e => { e.stopPropagation(); setShow(true) }}
        style={{ cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)', textDecoration: 'underline dotted', textUnderlineOffset: 3 }}>
        {work}
      </div>
      {show && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setShow(false)}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px', maxWidth: 360, width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,.2)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px' }}>業務内容</div>
            <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text)' }}>{work}</div>
            <button onClick={() => setShow(false)} style={{ marginTop: 14, width: '100%', padding: '10px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-muted)' }}>閉じる</button>
          </div>
        </div>
      )}
    </>
  )
}

function HwCell({ report, onClick }: { report: Report; onClick: () => void }) {
  if (report.hw_fee === 0 && !report.hw_from1 && !report.hw_from2) return <span style={{ color: 'var(--text-light)', fontSize: 11 }}>—</span>
  return (
    <div onClick={onClick} title="クリックして高速詳細を表示" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 6px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--surface2)', transition: 'all .12s', fontSize: 11 }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--accent-bg)'; (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--accent-border)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--surface2)'; (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)' }}>
      🛣 {report.hw_fee > 0 ? `¥${report.hw_fee.toLocaleString()}` : '詳細'}
    </div>
  )
}

const TD: React.CSSProperties = { padding: '6px 8px', verticalAlign: 'middle', borderBottom: '1px solid var(--border)', fontSize: 12 }
const CAT_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  '乗船': { bg: '#fccaca', color: '#9b1c1c', border: '#f87171' },
  '下船': { bg: '#bfdbfe', color: '#1e40af', border: '#60a5fa' },
  'センディング': { bg: '#fde68a', color: '#92400e', border: '#f59e0b' },
  '転船': { bg: '#bbf7d0', color: '#14532d', border: '#4ade80' },
}
function CatBadge({ cat }: { cat: string }) {
  const c = CAT_COLORS[cat]
  if (!c) return <span style={{ fontSize: 12 }}>{cat}</span>
  return <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: c.bg, color: c.color, border: `1px solid ${c.border}`, whiteSpace: 'nowrap' }}>{cat}</span>
}

const COLS = [
  ['稼働日', '82px'], ['港名', '80px'], ['船名', '120px'], ['人数', '48px'],
  ['対応区分', '92px'], ['業務内容', '320px'], ['駐車場', '82px'],
  ['高速料金 🛣', '90px'], ['食事代', '76px'], ['Voucher', '80px'], ['追加立替', '80px'], ['売上金額', '114px'],
]

export default function ReportsList({ reports, onUpdateAmount, onSavePdf, onUpdateReport, onDeleteReport, prices = {} }: Props) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [filterYear, setFilterYear] = useState('')
  const [filterMonth, setFilterMonth] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  // URLパラメータからcategoryを読み取る
  React.useEffect(() => {
    const cat = searchParams.get('category')
    if (cat) setFilterCategory(cat)
    const month = searchParams.get('month')
    if (month) {
      setFilterYear(month.slice(0, 4))
      setFilterMonth(month)
    }
  }, [searchParams])
  const [hwReport, setHwReport] = useState<Report | null>(null)
  const [editReport, setEditReport] = useState<Report | null>(null)

  // URLの ?month= パラメータを初期値として使用
  useEffect(() => {
    const month = searchParams.get('month')
    if (month) {
      const year = month.slice(0, 4)
      setFilterYear(year)
      setFilterMonth(month)
      setSearchParams({}, { replace: true })
    }
  }, [])

  const years = [...new Set(reports.map(r => r.bill_month?.slice(0, 4)))].filter(Boolean).sort().reverse()
  const months = [...new Set(reports.filter(r => !filterYear || r.bill_month?.startsWith(filterYear)).map(r => r.bill_month))].sort().reverse()
  const filtered = reports.filter(r =>
    (!filterYear || r.bill_month?.startsWith(filterYear)) &&
    (!filterMonth || r.bill_month === filterMonth) &&
    (!filterCategory || r.category === filterCategory)
  )
  const sorted = [...filtered].sort((a, b) => b.date.localeCompare(a.date))
  const totalAmount = filtered.reduce((s, r) => s + r.amount, 0)
  const totalPark = filtered.reduce((s, r) => s + r.park_fee, 0)
  const totalHw = filtered.reduce((s, r) => s + r.hw_fee, 0)
  const totalMeal = filtered.reduce((s, r) => s + r.meal, 0)
  const zeroCount = filtered.filter(r => r.amount === 0).length

  return (
    <div style={{ padding: '16px 18px' }}>
      <PageHeader title="日報一覧" sub={filterMonth ? `${filterMonth} の日報` : '行をクリック→編集 / 高速料金をクリック→詳細'}>
        <Select value={filterYear} onChange={v => { setFilterYear(v); setFilterMonth('') }}>
          <option value="">すべての年</option>
          {years.map(y => <option key={y} value={y}>{y}年</option>)}
        </Select>
        <Select value={filterMonth} onChange={setFilterMonth}>
          <option value="">すべての月</option>
          {months.map(m => <option key={m} value={m}>{m}</option>)}
        </Select>
        <Select value={filterCategory} onChange={setFilterCategory}>
          <option value="">すべての区分</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </Select>
      </PageHeader>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 12px', fontSize: 12 }}>件数: <strong>{filtered.length}件</strong></div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 12px', fontSize: 12 }}>売上合計: <strong style={{ color: 'var(--accent)' }}>¥{totalAmount.toLocaleString()}</strong></div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 12px', fontSize: 12 }}>駐車場: <strong>¥{totalPark.toLocaleString()}</strong></div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 12px', fontSize: 12 }}>高速料金: <strong>¥{totalHw.toLocaleString()}</strong></div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 12px', fontSize: 12 }}>食事代: <strong>¥{totalMeal.toLocaleString()}</strong></div>
        {zeroCount > 0 && <div style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', borderRadius: 'var(--radius)', padding: '8px 12px', fontSize: 12, color: 'var(--warning)' }}>⚠ 売上未入力: <strong>{zeroCount}件</strong></div>}
      </div>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '8px 12px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>💡 行をクリックすると編集できます</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <thead>
              <tr style={{ background: 'var(--surface2)' }}>
                {COLS.map(([h, w]) => (
                  <th key={h} style={{ padding: '7px 8px', fontSize: 10, fontWeight: 600, color: h === '売上金額' ? 'var(--accent)' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.3px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', textAlign: 'left', width: w === 'auto' ? undefined : w, background: h === '売上金額' ? 'var(--accent-bg)' : undefined }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0
                ? <tr><td colSpan={COLS.length} style={{ padding: 32, textAlign: 'center', color: 'var(--text-light)' }}>日報がありません</td></tr>
                : sorted.map(r => (
                  <tr key={r.id} onClick={() => setEditReport(r)} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = '#f0f6ff' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = '' }}>
                    <td style={TD}>{r.date}</td>
                    <td style={{ ...TD, maxWidth: 76, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.port}</td>
                    <td style={{ ...TD, maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.ship}>{r.ship}</td>
                    <td style={{ ...TD, textAlign: 'center' }}>{r.crew}</td>
                    <td style={TD}><CatBadge cat={r.category} /></td>
                  <td style={{ ...TD, overflow: "visible", textOverflow: "clip", whiteSpace: "normal" }} onClick={(e) => e.stopPropagation()}><WorkCell work={r.work} />  </td>
                    <td style={{ ...TD, fontSize: 11 }}>{r.park_fee > 0 ? `¥${r.park_fee.toLocaleString()}` : '—'}</td>
                    <td style={TD} onClick={e => { e.stopPropagation(); setHwReport(r) }}><HwCell report={r} onClick={() => setHwReport(r)} /></td>
                    <td style={{ ...TD, fontSize: 11 }}>{r.meal > 0 ? `¥${r.meal.toLocaleString()}` : '—'}</td>
                    <td style={{ ...TD, fontSize: 10, maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                      {r.voucher ? r.voucher.startsWith('http') || r.voucher.startsWith('data:') ? <a href={r.voucher} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline', fontSize: 10 }}>🔗 開く</a> : <span style={{ color: 'var(--text-light)' }}>{r.voucher}</span> : <span style={{ color: 'var(--text-light)' }}>—</span>}
                    </td>
                <td style={{ ...TD, fontSize: 11 }} onClick={(e) => e.stopPropagation()}>
                  {r.extra_expenses && r.extra_expenses.length > 0
                    ? <ExtraExpenseCell items={r.extra_expenses} />
                    : <span style={{ color: 'var(--text-light)' }}>—</span>}
                </td>
                    <td style={{ ...TD, background: 'var(--accent-bg)' }} onClick={e => e.stopPropagation()}>
                      {r.amount > 0 ? <strong style={{ color: 'var(--accent)', fontSize: 12 }}>¥{r.amount.toLocaleString()}</strong> : <span style={{ color: 'var(--text-light)', fontSize: 11 }}>未入力</span>}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>

      {hwReport && <HwPopup report={hwReport} onClose={() => setHwReport(null)} onSavePdf={onSavePdf} />}
      {editReport && <EditModal report={editReport} onClose={() => setEditReport(null)} onSave={onUpdateReport} onDelete={onDeleteReport} prices={prices} />}
    </div>
  )
}

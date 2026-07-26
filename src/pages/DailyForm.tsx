import { useState, useRef, useEffect, useCallback } from 'react'
import { Card, CardTitle, Field, Input, Select, Grid, Divider, Btn, PageHeader } from '../components/UI'
import { CATEGORIES } from '../types'
import type { Report } from '../types'

interface Props {
  onSubmit: (data: Omit<Report, 'id' | 'created_at' | 'updated_at'>) => Promise<boolean>
  pastReports?: { port: string; ship: string }[]
  prices?: Record<string, { ship: number; crew: number }>
}

// オートコンプリート
function AutoInput({ value, onChange, placeholder, suggestions }: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  suggestions: string[]
}) {
  const [show, setShow] = useState(false)
  const [filtered, setFiltered] = useState<string[]>([])
  const wrapRef = useRef<HTMLDivElement>(null)

  const update = useCallback((v: string) => {
    const list = [...new Set(suggestions)].filter(s =>
      v.length === 0 || s.toLowerCase().includes(v.toLowerCase())
    ).slice(0, 8)
    setFiltered(list)
    setShow(list.length > 0)
  }, [suggestions])

  useEffect(() => { update(value) }, [value, update])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setShow(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const inputStyle = {
    padding: '6px 9px', border: '1px solid var(--border-dark)',
    borderRadius: 'var(--radius)', background: 'var(--surface)',
    color: 'var(--text)', fontSize: 13, width: '100%', outline: 'none',
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => update(value)}
        onBlur={() => setTimeout(() => setShow(false), 150)}
        placeholder={placeholder}
        style={inputStyle}
      />
      {show && filtered.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
          background: 'var(--surface)', border: '1px solid var(--border-dark)',
          borderRadius: 'var(--radius)', boxShadow: '0 4px 12px rgba(0,0,0,.12)',
          maxHeight: 220, overflowY: 'auto', marginTop: 2,
        }}>
          {filtered.map((s, i) => (
            <div key={i}
              onMouseDown={e => { e.preventDefault(); onChange(s); setShow(false) }}
              style={{
                padding: '8px 12px', fontSize: 12, cursor: 'pointer',
                borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--accent-bg)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = '' }}
            >
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const EMPTY = {
  date: new Date().toISOString().slice(0, 10),
  port: '', ship: '', crew: '', category: '', work: '',
  amount: '', parkPlace: '', parkFee: '',
  hwFrom1: '', hwTo1: '', hwFrom2: '', hwTo2: '', hwFee: '',
  meal: '', otherExp: '', voucher: '',
  billMonth: new Date().toISOString().slice(0, 7),
  notes: '',
}

export default function DailyForm({ onSubmit, pastReports = [], prices = {} }: Props) {
  const [f, setF] = useState(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [pdfName, setPdfName] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const [autoCalc, setAutoCalc] = useState(true)

  const calcAmount = (cat: string, crew: number) => {
    const p = prices[cat] ?? { ship: 10000, crew: 1000 }
    return p.ship + crew * (p.crew ?? 0)
  }

  const set = (key: string) => (v: string) => setF(prev => ({ ...prev, [key]: v }))

  // 対応区分変更時に自動計算
  const handleCategoryChange = (v: string) => {
    setF(prev => ({
      ...prev,
      category: v,
      amount: autoCalc ? String(calcAmount(v, parseInt(prev.crew) || 0)) : prev.amount
    }))
  }

  // 船員人数変更時に自動計算
  const handleCrewChange = (v: string) => {
    setF(prev => ({
      ...prev,
      crew: v,
      amount: autoCalc ? String(calcAmount(prev.category, parseInt(v) || 0)) : prev.amount
    }))
  }

  const totalExp = (parseInt(f.parkFee) || 0) + (parseInt(f.hwFee) || 0) + (parseInt(f.meal) || 0) + (parseInt(f.otherExp) || 0)

  const portList = [...new Set(pastReports.map(r => r.port).filter(Boolean))].sort()
  const shipList = [...new Set(pastReports.map(r => r.ship).filter(Boolean))].sort()

  const handlePdfSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.type !== 'application/pdf') { alert('PDFファイルを選択してください'); return }
    const reader = new FileReader()
    reader.onload = (ev) => {
      const url = ev.target?.result as string
      setF(prev => ({ ...prev, voucher: url }))
      setPdfName(file.name)
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = async () => {
    setError('')
    if (!f.date || !f.port || !f.ship || !f.category || !f.amount) {
      setError('必須項目（稼働日・港名・船名・対応区分・売上金額）を入力してください')
      return
    }
    setSubmitting(true)
    const data: Omit<Report, 'id' | 'created_at' | 'updated_at'> = {
      date: f.date, port: f.port, ship: f.ship,
      crew: parseInt(f.crew) || 0, category: f.category, work: f.work,
      amount: parseInt(f.amount) || 0,
      park_place: f.parkPlace, park_fee: parseInt(f.parkFee) || 0,
      hw_from1: f.hwFrom1, hw_to1: f.hwTo1, hw_from2: f.hwFrom2, hw_to2: f.hwTo2,
      hw_fee: parseInt(f.hwFee) || 0, meal: parseInt(f.meal) || 0,
      other_exp: parseInt(f.otherExp) || 0, expenses: totalExp,
      voucher: f.voucher, bill_month: f.billMonth, notes: f.notes,
      invoiced: false, paid: false,
    }
    const ok = await onSubmit(data)
    if (ok) {
      setF({ ...EMPTY, date: new Date().toISOString().slice(0, 10), billMonth: new Date().toISOString().slice(0, 7) })
      setPdfName('')
    }
    setSubmitting(false)
  }

  const clearForm = () => {
    setF({ ...EMPTY, date: new Date().toISOString().slice(0, 10), billMonth: new Date().toISOString().slice(0, 7) })
    setPdfName('')
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div style={{ padding: '20px 22px' }}>
      <PageHeader title="日報作成" sub="送信すると売上・請求データへ自動連携（Supabase保存）" />

      {error && (
        <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger-border)', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 14, fontSize: 12 }}>
          ⚠ {error}
        </div>
      )}

      <Card>
        <CardTitle>🚢 基本情報</CardTitle>
        <Grid cols={3} style={{ marginBottom: 10 }}>
          <Field label="稼働日" required><Input type="date" value={f.date} onChange={set('date')} /></Field>
          <Field label="港名" required>
            <AutoInput value={f.port} onChange={set('port')} placeholder="横浜港" suggestions={portList} />
          </Field>
          <Field label="船名" required>
            <AutoInput value={f.ship} onChange={set('ship')} placeholder="第一丸" suggestions={shipList} />
          </Field>
        </Grid>
        <Grid cols={3} style={{ marginBottom: 10 }}>
          <Field label="船員人数">
            <Input type="number" value={f.crew} onChange={handleCrewChange} placeholder="5" min="0" />
          </Field>
          <Field label="対応区分" required>
            <Select value={f.category} onChange={handleCategoryChange}>
              <option value="">選択してください</option>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="業務内容"><Input value={f.work} onChange={set('work')} placeholder="業務の概要" /></Field>
        </Grid>
        <Grid cols={2}>
          <Field label="Voucher / PDF領収書">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <input ref={fileRef} type="file" accept="application/pdf" style={{ display: 'none' }} onChange={handlePdfSelect} />
              <button type="button" onClick={() => fileRef.current?.click()}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px',
                  borderRadius: 'var(--radius)',
                  border: pdfName ? '1.5px solid var(--success)' : '1px dashed var(--border-dark)',
                  background: pdfName ? 'var(--success-bg)' : 'var(--surface2)',
                  cursor: 'pointer', fontSize: 12,
                  color: pdfName ? 'var(--success)' : 'var(--text-muted)',
                }}>
                {pdfName ? <>✅ {pdfName}</> : <>📎 PDFをアップロード（領収書など）</>}
              </button>
              {!pdfName && (
                <Input value={f.voucher.startsWith('data:') ? '' : f.voucher} onChange={set('voucher')} placeholder="または Voucher番号を入力（例: V-2025-001）" />
              )}
              {pdfName && (
                <button type="button"
                  onClick={() => { setF(prev => ({ ...prev, voucher: '' })); setPdfName(''); if (fileRef.current) fileRef.current.value = '' }}
                  style={{ fontSize: 11, color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                  ✕ PDFを削除
                </button>
              )}
            </div>
          </Field>
          <Field label="請求対象月"><Input type="month" value={f.billMonth} onChange={set('billMonth')} /></Field>
        </Grid>
      </Card>

      <Card>
        <CardTitle>🚗 交通費・立替</CardTitle>
        <Grid cols={2} style={{ marginBottom: 10 }}>
          <Field label="駐車場場所"><Input value={f.parkPlace} onChange={set('parkPlace')} placeholder="横浜港第3駐車場" /></Field>
          <Field label="駐車場料金合計（円）"><Input type="number" value={f.parkFee} onChange={set('parkFee')} placeholder="0" min="0" /></Field>
        </Grid>
        <Divider />
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 500 }}>高速道路</div>
        <Grid cols={4} style={{ marginBottom: 10 }}>
          <Field label="行き 出発地"><Input value={f.hwFrom1} onChange={set('hwFrom1')} placeholder="横浜IC" /></Field>
          <Field label="行き 到着地"><Input value={f.hwTo1} onChange={set('hwTo1')} placeholder="東京IC" /></Field>
          <Field label="帰り 出発地"><Input value={f.hwFrom2} onChange={set('hwFrom2')} placeholder="東京IC" /></Field>
          <Field label="帰り 到着地"><Input value={f.hwTo2} onChange={set('hwTo2')} placeholder="横浜IC" /></Field>
        </Grid>
        <Grid cols={3}>
          <Field label="高速料金合計（円）"><Input type="number" value={f.hwFee} onChange={set('hwFee')} placeholder="0" min="0" /></Field>
          <Field label="食事代（円）"><Input type="number" value={f.meal} onChange={set('meal')} placeholder="0" min="0" /></Field>
          <Field label="その他立替（円）"><Input type="number" value={f.otherExp} onChange={set('otherExp')} placeholder="0" min="0" /></Field>
        </Grid>
        {totalExp > 0 && (
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)', textAlign: 'right' }}>
            立替合計: <strong style={{ color: 'var(--text)' }}>¥{totalExp.toLocaleString()}</strong>
          </div>
        )}
      </Card>

      <Card>
        <CardTitle>💰 売上金額</CardTitle>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <input type="checkbox" checked={autoCalc} onChange={e => {
              setAutoCalc(e.target.checked)
              if (e.target.checked && f.category) {
                setF(prev => ({ ...prev, amount: String(calcAmount(prev.category, parseInt(prev.crew) || 0)) }))
              }
            }} />
            対応区分・船員人数から自動計算
          </label>
          {autoCalc && f.category && (
            <span style={{ fontSize: 11, color: 'var(--accent)', background: 'var(--accent-bg)', padding: '2px 8px', borderRadius: 'var(--radius)', border: '1px solid var(--accent-border)' }}>
              自動計算: ¥{calcAmount(f.category, parseInt(f.crew) || 0).toLocaleString()}
            </span>
          )}
        </div>
        <Grid cols={2}>
          <Field label="売上金額（円）" required>
            <Input type="number" value={f.amount} onChange={v => { setAutoCalc(false); set('amount')(v) }} placeholder="10000" min="0" />
          </Field>
          <Field label="備考"><Input value={f.notes} onChange={set('notes')} placeholder="特記事項" /></Field>
        </Grid>
      </Card>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <Btn onClick={clearForm}>↺ クリア</Btn>
        <Btn variant="primary" onClick={handleSubmit} disabled={submitting}>
          {submitting ? '送信中...' : '📨 日報送信（Supabase保存・自動連携）'}
        </Btn>
      </div>
    </div>
  )
}

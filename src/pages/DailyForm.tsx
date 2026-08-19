import { useState, useRef, useEffect, useCallback } from 'react'
import { Card, CardTitle, Field, Input, Select, Divider, Btn, PageHeader, useIsMobile } from '../components/UI'
import { CATEGORIES } from '../types'
import type { Report } from '../types'

interface Props {
  onSubmit: (data: Omit<Report, 'id' | 'created_at' | 'updated_at'>) => Promise<boolean>
  pastReports?: { port: string; ship: string }[]
  prices?: Record<string, { ship: number; crew: number }>
}

interface ExtraItem { label: string; amount: number }

interface ExtraItemsProps {
  items: ExtraItem[]
  onAdd: () => void
  onRemove: (i: number) => void
  onLabelChange: (i: number, v: string) => void
  onAmountChange: (i: number, v: number) => void
  inputSt: React.CSSProperties
  isMobile: boolean
}

function ExtraItemsSection({ items, onAdd, onRemove, onLabelChange, onAmountChange, inputSt, isMobile }: ExtraItemsProps) {
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ fontSize: isMobile ? 13 : 11, color: 'var(--text-muted)', fontWeight: 600 }}>追加立替項目</div>
        <button onClick={onAdd}
          style={{ fontSize: 11, color: '#2563eb', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontWeight: 600 }}>
          ＋ 項目追加
        </button>
      </div>
      {items.map((e, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 28px', gap: 6, marginBottom: 6, alignItems: 'center' }}>
          <input
            value={e.label}
            onChange={ev => onLabelChange(i, ev.target.value)}
            style={{ ...inputSt, padding: isMobile ? '10px 12px' : '6px 8px' }}
            placeholder="項目名"
          />
          <input
            type="number"
            value={e.amount || ''}
            onChange={ev => onAmountChange(i, parseInt(ev.target.value) || 0)}
            style={{ ...inputSt, padding: isMobile ? '10px 12px' : '6px 8px' }}
            placeholder="0"
            min="0"
          />
          <button onClick={() => onRemove(i)}
            style={{ background: '#fee2e2', border: 'none', borderRadius: 4, color: '#dc2626', cursor: 'pointer', fontSize: 14, height: isMobile ? 44 : 30, fontWeight: 600 }}>×</button>
        </div>
      ))}
    </div>
  )
}

function AutoInput({ value, onChange, placeholder, suggestions }: { value: string; onChange: (v: string) => void; placeholder?: string; suggestions: string[] }) {
  const [show, setShow] = useState(false)
  const [filtered, setFiltered] = useState<string[]>([])
  const wrapRef = useRef<HTMLDivElement>(null)
  const isMobile = useIsMobile()
  const update = useCallback((v: string) => {
    if (v.length === 0) { setFiltered([]); setShow(false); return }
    const list = [...new Set(suggestions)].filter(s => s.toLowerCase().includes(v.toLowerCase())).slice(0, 8)
    setFiltered(list)
    setShow(list.length > 0)
  }, [suggestions])
  useEffect(() => { update(value) }, [value, update])
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setShow(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])
  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <input type="text" value={value} onChange={e => onChange(e.target.value)} onFocus={() => update(value)} onBlur={() => setTimeout(() => setShow(false), 150)} placeholder={placeholder}
        style={{ padding: isMobile ? '12px 14px' : '8px 10px', border: '1px solid var(--border-dark)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text)', fontSize: isMobile ? 16 : 13, width: '100%', outline: 'none' }} />
      {show && filtered.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200, background: 'var(--surface)', border: '1px solid var(--border-dark)', borderRadius: 'var(--radius)', boxShadow: '0 4px 12px rgba(0,0,0,.12)', maxHeight: 220, overflowY: 'auto', marginTop: 2 }}>
          {filtered.map((s, i) => (
            <div key={i} onMouseDown={e => { e.preventDefault(); onChange(s); setShow(false) }}
              style={{ padding: isMobile ? '12px 14px' : '8px 12px', fontSize: isMobile ? 15 : 12, cursor: 'pointer', borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none' }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--accent-bg)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = '' }}>
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const EMPTY = {
  date: new Date().toISOString().slice(0, 10), port: '', ship: '', crew: '', category: '', work: '',
  amount: '', parkPlace: '', parkFee: '', hwFrom1: '', hwTo1: '', hwFrom2: '', hwTo2: '', hwFee: '', hwVoucher: '',
  meal: '',
  hotelFee: '',
  shinkansenFee: '', otherExp: '', vouchers: [] as string[], billMonth: new Date().toISOString().slice(0, 7), notes: '',
}

export default function DailyForm({ onSubmit, pastReports = [], prices = {} }: Props) {
  const [f, setF] = useState(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [pdfNames, setPdfNames] = useState<string[]>([])
  const [hwPdfName, setHwPdfName] = useState('')
  const hwFileRef = useRef<HTMLInputElement>(null)
  const [autoCalc, setAutoCalc] = useState(true)
  const [section, setSection] = useState<'basic' | 'transport' | 'sales'>('basic')
  const [extraItems, setExtraItems] = useState<ExtraItem[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const isMobile = useIsMobile()

  const DRAFT_KEY = 'marine_daily_draft'
  useEffect(() => {
    // KYプリフィルを優先チェック
    const kyRaw = sessionStorage.getItem('ky_prefill')
    if (kyRaw) {
      try {
        const ky = JSON.parse(kyRaw)
        sessionStorage.removeItem('ky_prefill')
        localStorage.removeItem(DRAFT_KEY)
        setF(() => ({
          ...EMPTY,
          date: ky.date ?? EMPTY.date,
          port: ky.port ?? '',
          ship: ky.ship ?? '',
          crew: String(ky.crew ?? ''),
          category: ky.category ?? '',
          work: ky.work ?? '',
          billMonth: ky.date ? ky.date.slice(0, 7) : EMPTY.billMonth,
        }))
        return
      } catch { /* ignore */ }
    }
    try {
      const saved = localStorage.getItem(DRAFT_KEY)
      if (saved) {
        const draft = JSON.parse(saved)
        setF(draft.f ?? EMPTY)
        setPdfNames(draft.pdfNames ?? [])
        setExtraItems(draft.extraItems ?? [])
        setAutoCalc(draft.autoCalc ?? true)
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ f, pdfNames, extraItems, autoCalc }))
    }, 500)
    return () => clearTimeout(timer)
  }, [f, pdfNames, extraItems, autoCalc])

  const calcAmount = (cat: string, crew: number) => { const p = prices[cat] ?? { ship: 10000, crew: 1000 }; return p.ship + crew * (p.crew ?? 0) }
  const set = (key: string) => (v: string) => setF(prev => ({ ...prev, [key]: v }))
  const handleCategoryChange = (v: string) => setF(prev => ({ ...prev, category: v, amount: autoCalc ? String(calcAmount(v, parseInt(prev.crew) || 0)) : prev.amount }))
  const handleCrewChange = (v: string) => setF(prev => ({ ...prev, crew: v, amount: autoCalc ? String(calcAmount(prev.category, parseInt(v) || 0)) : prev.amount }))
  const extraTotal = extraItems.reduce((s, e) => s + e.amount, 0)
  const totalExp = (parseInt(f.parkFee) || 0) + (parseInt(f.hwFee) || 0) + (parseInt(f.meal) || 0) + (parseInt(f.hotelFee) || 0) + (parseInt(f.shinkansenFee) || 0) + extraTotal
  const portList = [...new Set(pastReports.map(r => r.port).filter(Boolean))].sort()
  const shipList = [...new Set(pastReports.map(r => r.ship).filter(Boolean))].sort()

  const handlePdfSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    const pdfs = files.filter(f => f.type === 'application/pdf')
    if (pdfs.length !== files.length) { alert('PDFファイルのみ選択できます'); return }
    const remaining = 5 - pdfNames.length
    const toAdd = pdfs.slice(0, remaining)
    if (pdfs.length > remaining) alert('最大5枚までです')
    toAdd.forEach(file => {
      const reader = new FileReader()
      reader.onload = (ev) => {
        setF(prev => ({ ...prev, vouchers: [...prev.vouchers, ev.target?.result as string] }))
        setPdfNames(prev => [...prev, file.name])
      }
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  const handleHwPdfSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.type !== 'application/pdf') { alert('PDFファイルを選択してください'); return }
    const reader = new FileReader()
    reader.onload = (ev) => { setF(prev => ({ ...prev, hwVoucher: ev.target?.result as string })); setHwPdfName(file.name) }
    reader.readAsDataURL(file)
    e.target.value = ''
  }
  const removePdf = (i: number) => {
    setF(prev => ({ ...prev, vouchers: prev.vouchers.filter((_, idx) => idx !== i) }))
    setPdfNames(prev => prev.filter((_, idx) => idx !== i))
  }

  const addExtraItem = useCallback(() => setExtraItems(prev => [...prev, { label: '', amount: 0 }]), [])
  const removeExtraItem = useCallback((i: number) => setExtraItems(prev => prev.filter((_, idx) => idx !== i)), [])
  const setExtraLabel = useCallback((i: number, label: string) => setExtraItems(prev => prev.map((e, idx) => idx === i ? { ...e, label } : e)), [])
  const setExtraAmount = useCallback((i: number, amount: number) => setExtraItems(prev => prev.map((e, idx) => idx === i ? { ...e, amount } : e)), [])

  const handleSubmit = async () => {
    setError('')
    if (!f.date || !f.port || !f.ship || !f.category || !f.amount) { setError('必須項目（稼働日・港名・船名・対応区分・売上金額）を入力してください'); return }
    setSubmitting(true)
    const ok = await onSubmit({ date: f.date, port: f.port, ship: f.ship, crew: parseInt(f.crew) || 0, category: f.category, work: f.work, amount: parseInt(f.amount) || 0, park_place: f.parkPlace, park_fee: parseInt(f.parkFee) || 0, hw_from1: f.hwFrom1, hw_to1: f.hwTo1, hw_from2: f.hwFrom2, hw_to2: f.hwTo2, hw_fee: parseInt(f.hwFee) || 0, hw_voucher: f.hwVoucher, meal: parseInt(f.meal) || 0, hotel_fee: parseInt(f.hotelFee) || 0,
        shinkansen_fee: parseInt(f.shinkansenFee) || 0,
        other_exp: parseInt(f.otherExp) || 0, expenses: totalExp, extra_expenses: extraItems.length > 0 ? extraItems : undefined, voucher: f.vouchers.join(","), bill_month: f.billMonth, notes: f.notes, invoiced: false, paid: false })
    if (ok) { setF({ ...EMPTY, date: new Date().toISOString().slice(0, 10), billMonth: new Date().toISOString().slice(0, 7) }); setPdfNames([]); localStorage.removeItem('marine_daily_draft'); setSection('basic'); setExtraItems([]) }
    setSubmitting(false)
  }

  const inputSt: React.CSSProperties = { padding: isMobile ? '12px 14px' : '8px 10px', border: '1px solid var(--border-dark)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text)', fontSize: isMobile ? 16 : 13, width: '100%', outline: 'none' }

  if (isMobile) {
    const steps = [
      { key: 'basic', label: '基本情報', icon: '🚢' },
      { key: 'transport', label: '交通費', icon: '🚗' },
      { key: 'sales', label: '売上', icon: '💰' },
    ] as const
    return (
      <div style={{ padding: '16px', paddingBottom: 100 }}>
        <div style={{ display: 'flex', gap: 0, marginBottom: 20, background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
          {steps.map((s, i) => (
            <button key={s.key} onClick={() => setSection(s.key)}
              style={{ flex: 1, padding: '12px 4px', border: 'none', borderRight: i < steps.length - 1 ? '1px solid var(--border)' : 'none', background: section === s.key ? 'var(--accent)' : 'var(--surface)', color: section === s.key ? '#fff' : 'var(--text-muted)', cursor: 'pointer', fontSize: 11, fontWeight: section === s.key ? 600 : 400, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <span style={{ fontSize: 18 }}>{s.icon}</span>
              {s.label}
            </button>
          ))}
        </div>
        {error && <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger-border)', borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontSize: 13 }}>⚠ {error}</div>}
        {section === 'basic' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card>
              <CardTitle>🚢 基本情報</CardTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Field label="稼働日 *"><input type="date" value={f.date} onChange={e => set('date')(e.target.value)} style={inputSt} /></Field>
                <Field label="港名 *"><AutoInput value={f.port} onChange={set('port')} placeholder="横浜港" suggestions={portList} /></Field>
                <Field label="船名 *"><AutoInput value={f.ship} onChange={set('ship')} placeholder="第一丸" suggestions={shipList} /></Field>
                <div style={{ display: 'grid', gridTemplateColumns: "1fr", gap: 12 }}>
                  <Field label="船員人数"><input type="number" value={f.crew} onChange={e => handleCrewChange(e.target.value)} placeholder="5" style={inputSt} /></Field>
                  <Field label="請求対象月"><input type="month" value={f.billMonth} onChange={e => set('billMonth')(e.target.value)} style={inputSt} /></Field>
                </div>
                <Field label="対応区分 *">
                  <select value={f.category} onChange={e => handleCategoryChange(e.target.value)} style={{ ...inputSt, cursor: 'pointer' }}>
                    <option value="">選択してください</option>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="業務内容"><input value={f.work} onChange={e => set('work')(e.target.value)} placeholder="業務の概要" style={inputSt} /></Field>
                <Field label="Voucher / PDF領収書（最大5枚）">
                  <input ref={fileRef} type="file" accept="application/pdf" multiple style={{ display: 'none' }} onChange={handlePdfSelect} />
                  {pdfNames.length < 5 && (
                    <button type="button" onClick={() => fileRef.current?.click()}
                      style={{ padding: '12px 14px', borderRadius: 12, border: '2px dashed var(--border-dark)', background: 'var(--surface2)', cursor: 'pointer', fontSize: 14, color: 'var(--text-muted)', width: '100%', textAlign: 'left', marginBottom: pdfNames.length ? 8 : 0 }}>
                      📎 PDFを追加（{pdfNames.length}/5枚）
                    </button>
                  )}
                  {pdfNames.map((name, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: 'var(--success-bg)', border: '1px solid var(--success)', marginBottom: 6 }}>
                      <span style={{ flex: 1, fontSize: 13, color: 'var(--success)' }}>✅ {name}</span>
                      <button type="button" onClick={() => removePdf(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16 }}>×</button>
                    </div>
                  ))}
                </Field>
              </div>
            </Card>
            <button onClick={() => setSection('transport')} style={{ width: '100%', padding: '16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>次へ：交通費入力 →</button>
          </div>
        )}
        {section === 'transport' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card>
              <CardTitle>🚗 交通費・立替</CardTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Field label="駐車場場所"><input value={f.parkPlace} onChange={e => set('parkPlace')(e.target.value)} placeholder="横浜港第3駐車場" style={inputSt} /></Field>
                <Field label="駐車場料金（円）"><input type="number" value={f.parkFee} onChange={e => set('parkFee')(e.target.value)} placeholder="0" style={inputSt} /></Field>
                <Divider />
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>高速道路</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Field label="行き 出発地"><input value={f.hwFrom1} onChange={e => set('hwFrom1')(e.target.value)} placeholder="横浜IC" style={inputSt} /></Field>
                  <Field label="行き 到着地"><input value={f.hwTo1} onChange={e => set('hwTo1')(e.target.value)} placeholder="東京IC" style={inputSt} /></Field>
                  <Field label="帰り 出発地"><input value={f.hwFrom2} onChange={e => set('hwFrom2')(e.target.value)} placeholder="東京IC" style={inputSt} /></Field>
                  <Field label="帰り 到着地"><input value={f.hwTo2} onChange={e => set('hwTo2')(e.target.value)} placeholder="横浜IC" style={inputSt} /></Field>
                </div>
                <Field label="高速料金合計（円）"><input type="number" value={f.hwFee} onChange={e => set('hwFee')(e.target.value)} placeholder="0" style={inputSt} /></Field>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Field label="食事代（円）"><input type="number" value={f.meal} onChange={e => set('meal')(e.target.value)} placeholder="0" style={inputSt} /></Field>
          <Field label="ホテル代金（円）"><input type="number" value={f.hotelFee} onChange={e => set('hotelFee')(e.target.value)} placeholder="0" style={inputSt} /></Field>
          <Field label="新幹線代金（円）"><input type="number" value={f.shinkansenFee} onChange={e => set('shinkansenFee')(e.target.value)} placeholder="0" style={inputSt} /></Field>
                </div>
                <ExtraItemsSection items={extraItems} onAdd={addExtraItem} onRemove={removeExtraItem} onLabelChange={setExtraLabel} onAmountChange={setExtraAmount} inputSt={inputSt} isMobile={isMobile} />
                {totalExp > 0 && (
                  <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '12px 14px', fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>立替合計</span>
                    <strong>¥{totalExp.toLocaleString()}</strong>
                  </div>
                )}
              </div>
            </Card>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <button onClick={() => setSection('basic')} style={{ padding: '14px', background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border-dark)', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>← 戻る</button>
              <button onClick={() => setSection('sales')} style={{ padding: '14px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>次へ：売上 →</button>
            </div>
          </div>
        )}
        {section === 'sales' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card>
              <CardTitle>💰 売上金額</CardTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'var(--surface2)', borderRadius: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={autoCalc} onChange={e => { setAutoCalc(e.target.checked); if (e.target.checked && f.category) setF(prev => ({ ...prev, amount: String(calcAmount(prev.category, parseInt(prev.crew) || 0)) })) }} style={{ width: 20, height: 20 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>対応区分・船員人数から自動計算</div>
                    {autoCalc && f.category && <div style={{ fontSize: 12, color: 'var(--accent)', marginTop: 2 }}>計算結果: ¥{calcAmount(f.category, parseInt(f.crew) || 0).toLocaleString()}</div>}
                  </div>
                </label>
                <Field label="売上金額（円）*"><input type="number" value={f.amount} onChange={e => { setAutoCalc(false); set('amount')(e.target.value) }} placeholder="10000" style={{ ...inputSt, fontSize: 20, fontWeight: 600, color: 'var(--accent)' }} /></Field>
                <Field label="備考"><input value={f.notes} onChange={e => set('notes')(e.target.value)} placeholder="特記事項" style={inputSt} /></Field>
              </div>
            </Card>
            <Card>
              <CardTitle>📋 送信内容確認</CardTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                {[['稼働日', f.date], ['港名', f.port || '未入力'], ['船名', f.ship || '未入力'], ['対応区分', f.category || '未選択'], ['売上金額', f.amount ? `¥${parseInt(f.amount).toLocaleString()}` : '未入力'], ['立替合計', `¥${totalExp.toLocaleString()}`]].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                    <span style={{ fontWeight: 500 }}>{v}</span>
                  </div>
                ))}
              </div>
            </Card>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
              <button onClick={() => setSection('transport')} style={{ padding: '14px', background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border-dark)', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>← 戻る</button>
              <button onClick={handleSubmit} disabled={submitting} style={{ padding: '16px', background: submitting ? 'var(--text-muted)' : 'var(--success)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer' }}>
                {submitting ? '送信中...' : '📨 日報を送信'}
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ padding: '20px 22px' }}>
      <PageHeader title="日報作成" sub="送信すると売上・請求データへ自動連携（Supabase保存）" />
      {error && <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger-border)', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 14, fontSize: 12 }}>⚠ {error}</div>}
      <Card>
        <CardTitle>🚢 基本情報</CardTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 10 }}>
          <Field label="稼働日" required><Input type="date" value={f.date} onChange={set('date')} /></Field>
          <Field label="港名" required><AutoInput value={f.port} onChange={set('port')} placeholder="横浜港" suggestions={portList} /></Field>
          <Field label="船名" required><AutoInput value={f.ship} onChange={set('ship')} placeholder="第一丸" suggestions={shipList} /></Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 10 }}>
          <Field label="船員人数"><Input type="number" value={f.crew} onChange={handleCrewChange} placeholder="5" min="0" /></Field>
          <Field label="対応区分" required><Select value={f.category} onChange={handleCategoryChange}><option value="">選択してください</option>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</Select></Field>
          <Field label="業務内容"><Input value={f.work} onChange={set('work')} placeholder="業務の概要" /></Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Voucher / PDF領収書（最大5枚）">
            <input ref={fileRef} type="file" accept="application/pdf" multiple style={{ display: 'none' }} onChange={handlePdfSelect} />
            {pdfNames.length < 5 && (
              <button type="button" onClick={() => fileRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 'var(--radius)', border: '1px dashed var(--border-dark)', background: 'var(--surface2)', cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)', marginBottom: pdfNames.length ? 6 : 0 }}>
                📎 PDFを追加（{pdfNames.length}/5枚）
              </button>
            )}
            {pdfNames.map((name, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 'var(--radius)', background: 'var(--success-bg)', border: '1px solid var(--success)', marginBottom: 4 }}>
                <span style={{ flex: 1, fontSize: 11, color: 'var(--success)' }}>✅ {name}</span>
                <button type="button" onClick={() => removePdf(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14, padding: 0 }}>×</button>
              </div>
            ))}
          </Field>
          <Field label="請求対象月"><Input type="month" value={f.billMonth} onChange={set('billMonth')} /></Field>
        </div>
      </Card>
      <Card>
        <CardTitle>🚗 交通費・立替</CardTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <Field label="駐車場場所"><Input value={f.parkPlace} onChange={set('parkPlace')} placeholder="横浜港第3駐車場" /></Field>
          <Field label="駐車場料金合計（円）"><Input type="number" value={f.parkFee} onChange={set('parkFee')} placeholder="0" min="0" /></Field>
        </div>
        <Divider />
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 500 }}>高速道路</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 10 }}>
          <Field label="行き 出発地"><Input value={f.hwFrom1} onChange={set('hwFrom1')} placeholder="横浜IC" /></Field>
          <Field label="行き 到着地"><Input value={f.hwTo1} onChange={set('hwTo1')} placeholder="東京IC" /></Field>
          <Field label="帰り 出発地"><Input value={f.hwFrom2} onChange={set('hwFrom2')} placeholder="東京IC" /></Field>
          <Field label="帰り 到着地"><Input value={f.hwTo2} onChange={set('hwTo2')} placeholder="横浜IC" /></Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
          <Field label="高速料金合計（円）"><Input type="number" value={f.hwFee} onChange={set('hwFee')} placeholder="0" min="0" /></Field>
          <Field label="食事代（円）"><Input type="number" value={f.meal} onChange={set('meal')} placeholder="0" min="0" /></Field>
          <Field label="ホテル代金（円）"><Input type="number" value={f.hotelFee} onChange={set('hotelFee')} placeholder="0" min="0" /></Field>
          <Field label="新幹線代金（円）"><Input type="number" value={f.shinkansenFee} onChange={set('shinkansenFee')} placeholder="0" min="0" /></Field>
        </div>
        <ExtraItemsSection items={extraItems} onAdd={addExtraItem} onRemove={removeExtraItem} onLabelChange={setExtraLabel} onAmountChange={setExtraAmount} inputSt={inputSt} isMobile={isMobile} />
        {totalExp > 0 && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)', textAlign: 'right' }}>立替合計: <strong style={{ color: 'var(--text)' }}>¥{totalExp.toLocaleString()}</strong></div>}
      </Card>
      <Card>
        <CardTitle>💰 売上金額</CardTitle>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <input type="checkbox" checked={autoCalc} onChange={e => { setAutoCalc(e.target.checked); if (e.target.checked && f.category) setF(prev => ({ ...prev, amount: String(calcAmount(prev.category, parseInt(prev.crew) || 0)) })) }} />
            対応区分・船員人数から自動計算
          </label>
          {autoCalc && f.category && <span style={{ fontSize: 11, color: 'var(--accent)', background: 'var(--accent-bg)', padding: '2px 8px', borderRadius: 'var(--radius)', border: '1px solid var(--accent-border)' }}>自動計算: ¥{calcAmount(f.category, parseInt(f.crew) || 0).toLocaleString()}</span>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="売上金額（円）" required><Input type="number" value={f.amount} onChange={v => { setAutoCalc(false); set('amount')(v) }} placeholder="10000" min="0" /></Field>
          <Field label="備考"><Input value={f.notes} onChange={set('notes')} placeholder="特記事項" /></Field>
        </div>
      </Card>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <Btn onClick={() => { setF({ ...EMPTY, date: new Date().toISOString().slice(0, 10), billMonth: new Date().toISOString().slice(0, 7) }); setPdfNames([]); localStorage.removeItem('marine_daily_draft'); setExtraItems([]) }}>↺ クリア</Btn>
        <Btn variant="primary" onClick={handleSubmit} disabled={submitting}>{submitting ? '送信中...' : '📨 日報送信'}</Btn>
      </div>
    </div>
  )
}

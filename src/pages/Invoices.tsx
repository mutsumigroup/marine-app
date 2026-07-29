import { useState, useCallback } from 'react'
import { Btn, PageHeader } from '../components/UI'
import { generateInvoicePDF } from '../lib/pdf'
import type { Invoice, Report, Settings } from '../types'

interface Props {
  invoices: Invoice[]
  reports: Report[]
  settings: Settings
  onSend: (id: string) => Promise<boolean>
  onPaid: (id: string) => Promise<boolean>
  onRevert: (id: string, status: string) => Promise<boolean>
  onUpdateInvoice: (id: string, updates: Pick<Invoice, 'subtotal' | 'tax' | 'expenses' | 'total'>) => Promise<boolean>
}

const STATUS_ALL = ['未請求', '作成済', '送信済', '入金待ち', '入金済'] as const

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    未請求:   ['#fff7e6', '#d97706'],
    作成済:   ['#f3f0ff', '#7c3aed'],
    送信済:   ['#eff6ff', '#2563eb'],
    入金待ち: ['#fef2f2', '#dc2626'],
    入金済:   ['#f0fdf4', '#16a34a'],
  }
  const [bg, color] = map[status] ?? ['#f3f4f6', '#6b7280']
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 10px', borderRadius: 999,
      fontSize: 11, fontWeight: 600, background: bg, color,
    }}>
      {status}
    </span>
  )
}

function EditableAmount({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 10, color: '#999' }}>{label}</span>
        <input autoFocus value={draft} onChange={e => setDraft(e.target.value)}
          onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
          style={{ width: 110, textAlign: 'right', padding: '4px 8px', border: '1.5px solid #2563eb', borderRadius: 5, fontSize: 13, background: '#eff6ff', color: '#1d4ed8', outline: 'none', fontFamily: 'inherit' }} />
      </div>
    )
  }
  return (
    <div onClick={open} title="クリックして編集" style={{ display: 'flex', flexDirection: 'column', gap: 2, cursor: 'text' }}>
      <span style={{ fontSize: 10, color: '#999' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: '#222', borderBottom: '1px dashed #bbb', paddingBottom: 1, display: 'inline-block' }}>
        ¥{value.toLocaleString()}
      </span>
    </div>
  )
}

function InvoiceSheet({ inv, reports, settings, onClose, onSend, onUpdateInvoice, processing }: {
  inv: Invoice; reports: Report[]; settings: Settings
  onClose: () => void; onSend: (id: string) => Promise<void>
  onUpdateInvoice: (id: string, updates: Pick<Invoice, 'subtotal' | 'tax' | 'expenses' | 'total'>) => Promise<boolean>
  processing: boolean
}) {
  const monthReports = reports.filter(r => r.bill_month === inv.billing_month)
  const [subtotal, setSubtotal] = useState(inv.subtotal)
  const [expenses, setExpenses] = useState(inv.expenses)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  const tax = Math.round(subtotal * 0.1)
  const bizTotal = subtotal + tax
  const total = bizTotal + expenses

  const handleSubtotal = useCallback((v: number) => { setSubtotal(v); setDirty(true) }, [])
  const handleExpenses = useCallback((v: number) => { setExpenses(v); setDirty(true) }, [])
  const handleSave = async () => { setSaving(true); await onUpdateInvoice(inv.id, { subtotal, tax, expenses, total }); setDirty(false); setSaving(false) }

  const catSum: Record<string, { count: number; crew: number }> = {}
  monthReports.forEach(r => { if (!catSum[r.category]) catSum[r.category] = { count: 0, crew: 0 }; catSum[r.category].count++; catSum[r.category].crew += r.crew })
  const pr = settings.prices ?? {}
  const rows = Object.entries(catSum).map(([cat, d]) => { const p = pr[cat] ?? { ship: 10000, crew: 1000 }; const line = d.count * p.ship + d.crew * (p.crew ?? 0); return { cat, count: d.count, crew: d.crew, shipP: p.ship, crewP: p.crew ?? 0, line } })

  const parkTotal = monthReports.reduce((s, r) => s + r.park_fee, 0)
  const hwTotal = monthReports.reduce((s, r) => s + r.hw_fee, 0)
  const mealTotal = monthReports.reduce((s, r) => s + r.meal, 0)
  const othTotal = monthReports.reduce((s, r) => s + r.other_exp, 0)
  const fixedExp = settings.fixed_expenses ?? []
  const today = new Date().toLocaleDateString('ja-JP')
  const due = new Date(Date.now() + (settings.pay_days || 30) * 86400000).toLocaleDateString('ja-JP')

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 300, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '24px 16px' }}>
      <div style={{ background: '#fff', color: '#222', borderRadius: 10, width: '100%', maxWidth: 660, boxShadow: '0 12px 48px rgba(0,0,0,.22)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', background: '#f7f7f5', borderBottom: '0.5px solid #ddd' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>請求書 — {inv.billing_month}分</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <StatusBadge status={inv.status} />
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#999' }}>✕</button>
          </div>
        </div>
        <div style={{ padding: '24px 28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
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
          <div style={{ borderTop: '0.5px solid #ccc', marginBottom: 16 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 10, color: '#999', marginBottom: 3 }}>請求先</div>
              <div style={{ fontSize: 16, fontWeight: 500 }}>{settings.client_name} 御中</div>
            </div>
            <div style={{ textAlign: 'right', fontSize: 11, color: '#666', lineHeight: 1.8 }}>
              <div>件名: {inv.billing_month}分 業務委託費</div>
              <div>請求日: {today}</div>
              <div>支払期限: {due}</div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1a1a1a', color: '#fff', borderRadius: 6, padding: '10px 16px', marginBottom: 20 }}>
            <div style={{ fontSize: 12 }}>ご請求金額（税込）</div>
            <div style={{ fontSize: 20, fontWeight: 500 }}>¥{total.toLocaleString()}</div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#666', letterSpacing: '.3px', textTransform: 'uppercase', marginBottom: 6 }}>業務明細</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr style={{ borderBottom: '1px solid #ddd' }}>
                {['対応区分','件数','船員','単価（船/人）','金額'].map((h,i) => (
                  <th key={h} style={{ padding: '6px 8px', fontWeight: 500, fontSize: 11, color: '#666', textAlign: i===4?'right':'left', borderBottom: '0.5px solid #ccc' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>{rows.map((r,i) => (
                <tr key={i} style={{ borderBottom: '0.5px solid #eee' }}>
                  <td style={{ padding: '7px 8px' }}>{r.cat}</td>
                  <td style={{ padding: '7px 8px' }}>{r.count}隻</td>
                  <td style={{ padding: '7px 8px' }}>{r.crew}名</td>
                  <td style={{ padding: '7px 8px', color: '#888' }}>¥{r.shipP.toLocaleString()} / ¥{r.crewP.toLocaleString()}</td>
                  <td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 500 }}>¥{r.line.toLocaleString()}</td>
                </tr>
              ))}</tbody>
            </table>
            <div style={{ marginTop: 10, padding: '10px 12px', background: '#fafafa', borderRadius: 6, border: '0.5px solid #eee' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <EditableAmount label="業務小計（クリックして編集）" value={subtotal} onChange={handleSubtotal} />
                <div style={{ fontSize: 10, color: '#bbb', marginTop: 14 }}>← 変更すると消費税・合計も自動更新</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#666', marginBottom: 4 }}>
                <span>消費税（10%）</span><span>¥{tax.toLocaleString()}</span>
              </div>
              <div style={{ borderTop: '0.5px solid #ddd', paddingTop: 6, marginTop: 4, display: 'flex', justifyContent: 'space-between', fontWeight: 600, fontSize: 13 }}>
                <span>業務請求小計</span><span>¥{bizTotal.toLocaleString()}</span>
              </div>
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#666', letterSpacing: '.3px', textTransform: 'uppercase', marginBottom: 6 }}>立替金精算</div>
            {[['駐車場料金',parkTotal],['高速料金',hwTotal],['食事代',mealTotal],['その他立替',othTotal],...fixedExp.map((e: {label:string;amount:number}) => [e.label,e.amount])].filter(([,v])=>(v as number)>0).map(([k,v],i)=>(
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#555', marginBottom: 3 }}>
                <span>{k as string}</span><span>¥{(v as number).toLocaleString()}</span>
              </div>
            ))}
            <div style={{ marginTop: 8, padding: '10px 12px', background: '#fafafa', borderRadius: 6, border: '0.5px solid #eee' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <EditableAmount label="立替金合計（クリックして編集）" value={expenses} onChange={handleExpenses} />
                <div style={{ fontSize: 10, color: '#bbb', marginTop: 14 }}>← 最終請求額に反映</div>
              </div>
            </div>
          </div>
          <div style={{ background: '#f7f7f5', borderRadius: 6, padding: '12px 16px', marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#666', marginBottom: 4 }}><span>業務請求金額（税込）</span><span>¥{bizTotal.toLocaleString()}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#666', marginBottom: 4 }}><span>立替金精算</span><span>¥{expenses.toLocaleString()}</span></div>
            <div style={{ borderTop: '0.5px solid #ccc', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 600 }}>
              <span>最終請求金額</span><span>¥{total.toLocaleString()}</span>
            </div>
          </div>
          <div style={{ fontSize: 11, color: '#555', lineHeight: 1.8, borderTop: '0.5px solid #ddd', paddingTop: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 2 }}>お振込先</div>
            <div>{settings.bank}</div><div>{settings.account}</div>
          </div>
          {dirty && (
            <div style={{ marginTop: 16, padding: '8px 12px', background: '#fffbeb', border: '1px solid #f59e0b', borderRadius: 6, fontSize: 12, color: '#92400e', display: 'flex', alignItems: 'center', gap: 8 }}>
              ✏️ 金額が変更されています。「保存」を押してSupabaseに反映してください。
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '12px 20px', background: '#f7f7f5', borderTop: '0.5px solid #ddd' }}>
          <Btn onClick={onClose}>閉じる</Btn>
          {dirty && <Btn variant="primary" disabled={saving} onClick={handleSave}>{saving ? '保存中...' : '💾 保存'}</Btn>}
          {['未請求', '作成済'].includes(inv.status) && (
            <Btn variant="success" disabled={processing} onClick={async () => { await onSend(inv.id); onClose() }}>
              {processing ? '処理中...' : '📤 PDF生成・送信'}
            </Btn>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Invoices({ invoices, reports, settings, onSend, onPaid, onRevert, onUpdateInvoice }: Props) {
  const [filter, setFilter] = useState('')
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [processing, setProcessing] = useState<string | null>(null)

  const filtered = filter ? invoices.filter(i => i.status === filter) : invoices
  const sorted = [...filtered].sort((a, b) => b.billing_month.localeCompare(a.billing_month))
  const previewInv = previewId ? invoices.find(i => i.id === previewId) ?? null : null

  const handleSend = async (id: string) => { setProcessing(id); const inv = invoices.find(i => i.id === id)!; const doc = generateInvoicePDF(inv, reports, settings); doc.save(`invoice-${inv.billing_month}.pdf`); await onSend(id); setProcessing(null) }
  const handlePaid = async (id: string) => { setProcessing(id); await onPaid(id); setProcessing(null) }
  const handleRevert = async (id: string, status: string) => { if (!confirm(`ステータスを「${status}」に戻しますか？`)) return; setProcessing(id); await onRevert(id, status); setProcessing(null) }

  const totalAmt = invoices.reduce((s, i) => s + i.total, 0)
  const waitAmt = invoices.filter(i => ['送信済','入金待ち'].includes(i.status)).reduce((s, i) => s + i.total, 0)
  const paidAmt = invoices.filter(i => i.status === '入金済').reduce((s, i) => s + i.total, 0)
  const unpaidCnt = invoices.filter(i => i.status === '未請求').length

  return (
    <div style={{ padding: '20px 22px', maxWidth: 900 }}>
      <PageHeader title="請求書管理" sub="月次請求書の作成・送信・管理（Supabase）" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 20 }}>
        {[{label:'請求総額',value:`¥${totalAmt.toLocaleString()}`,color:'#1a1a1a'},{label:'入金待ち',value:`¥${waitAmt.toLocaleString()}`,color:'#dc2626'},{label:'入金済',value:`¥${paidAmt.toLocaleString()}`,color:'#16a34a'},{label:'未請求件数',value:`${unpaidCnt}件`,color:'#d97706'}].map(c => (
          <div key={c.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 14px', boxShadow: 'var(--shadow)' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 3 }}>{c.label}</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        <Btn size="sm" variant={filter===''?'primary':'default'} onClick={() => setFilter('')}>すべて</Btn>
        {STATUS_ALL.map(s => <Btn key={s} size="sm" variant={filter===s?'primary':'default'} onClick={() => setFilter(s)}>{s}</Btn>)}
      </div>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
        {sorted.length === 0
          ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>請求書がありません</div>
          : sorted.map((inv, idx) => {
            const monthReports = reports.filter(r => r.bill_month === inv.billing_month)
            return (
              <div key={inv.id} style={{ borderBottom: idx<sorted.length-1?'0.5px solid var(--border)':'none', padding: '14px 18px', transition: 'background .1s' }}
                onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background='var(--surface2,#f9f9f9)'}
                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background=''}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, minWidth: 70 }}>{inv.billing_month}</div>
                  <StatusBadge status={inv.status} />
                  <div style={{ marginLeft: 'auto', fontSize: 16, fontWeight: 600 }}>¥{inv.total.toLocaleString()}</div>
                </div>
                <div style={{ display: 'flex', gap: 20, fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, flexWrap: 'wrap' }}>
                  <span>業務小計 <strong style={{color:'var(--text)'}}>¥{inv.subtotal.toLocaleString()}</strong></span>
                  <span>消費税 <strong style={{color:'var(--text)'}}>¥{inv.tax.toLocaleString()}</strong></span>
                  <span>立替 <strong style={{color:'var(--text)'}}>¥{inv.expenses.toLocaleString()}</strong></span>
                  <span>件数 <strong style={{color:'var(--text)'}}>{monthReports.length}件</strong></span>
                  {inv.paid_date && <span>入金日 <strong style={{color:'var(--text)'}}>{inv.paid_date}</strong></span>}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <Btn size="sm" onClick={() => setPreviewId(inv.id)}>👁 確認・編集</Btn>
                  {['未請求','作成済'].includes(inv.status) && <Btn size="sm" variant="success" disabled={processing===inv.id} onClick={() => handleSend(inv.id)}>{processing===inv.id?'処理中...':'📤 PDF生成・送信'}</Btn>}
                  {['送信済','入金待ち'].includes(inv.status) && <Btn size="sm" variant="primary" disabled={processing===inv.id} onClick={() => handlePaid(inv.id)}>{processing===inv.id?'処理中...':'✓ 入金済にする'}</Btn>}
                  {inv.status==='入金済' && <Btn size="sm" variant="ghost" disabled={processing===inv.id} onClick={() => handleRevert(inv.id,'送信済')} style={{fontSize:11,color:'var(--text-muted)',border:'1px dashed var(--border-dark)'}}>↩ 送信済に戻す</Btn>}
                  {['送信済','入金待ち','作成済'].includes(inv.status) && <Btn size="sm" variant="ghost" disabled={processing===inv.id} onClick={() => handleRevert(inv.id,'未請求')} style={{fontSize:11,color:'var(--text-muted)',border:'1px dashed var(--border-dark)'}}>↩ 未請求に戻す</Btn>}
                </div>
              </div>
            )
          })
        }
      </div>
      {previewInv && <InvoiceSheet inv={previewInv} reports={reports} settings={settings} onClose={() => setPreviewId(null)} onSend={handleSend} onUpdateInvoice={onUpdateInvoice} processing={processing===previewInv.id} />}
    </div>
  )
}

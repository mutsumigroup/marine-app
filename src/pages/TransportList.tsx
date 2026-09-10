import { useState, useEffect } from 'react'
import { Card, PageHeader, Select } from '../components/UI'
import { supabase } from '../lib/supabase'
import type { TransportReport } from '../types/transport'
import { TENKO_OPTIONS } from '../lib/fareTable'
import { sendEmail } from '../lib/email'

function SentBadge({ sent }: { sent: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: sent ? '#f0fdf4' : '#fff7e6', color: sent ? '#16a34a' : '#d97706' }}>
      {sent ? '送信済' : '未送信'}
    </span>
  )
}

function EditModal({ report, onClose, onSave, onDelete, dailyMail, fareMap }: {
  report: TransportReport
  onClose: () => void
  onSave: (updated: TransportReport) => void
  onDelete: (id: string) => void
  dailyMail: string
  fareMap: Record<string, Record<string, number>>
}) {
  const [f, setF] = useState({
    date: report.date,
    fromArea: report.from_area,
    toArea: report.to_area,
    tenkoIdx: Math.max(0, TENKO_OPTIONS.findIndex(o => o.value === report.tenko_fee && o.label === report.tenko_label)),
    toll: String(report.toll_fee || ''),
    passengers: report.passengers,
    notes: report.notes,
    billMonth: report.bill_month,
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState('')

  const set = (key: string) => (v: string | number) => setF(prev => ({ ...prev, [key]: v }))

  const fromAreas = Object.keys(fareMap).sort()
  const toAreas = f.fromArea && fareMap[f.fromArea] ? Object.keys(fareMap[f.fromArea]).sort() : []
  const fare = (f.fromArea && f.toArea && fareMap[f.fromArea]?.[f.toArea] !== undefined) ? fareMap[f.fromArea][f.toArea] : null
  const tenkoOpt = TENKO_OPTIONS[f.tenkoIdx] ?? TENKO_OPTIONS[0]
  const tenkoFee = tenkoOpt.value
  const tollFee = parseInt(f.toll) || 0
  const total = (fare ?? 0) + tenkoFee

  const handleSave = async () => {
    setSaving(true)
    const updated: TransportReport = { ...report, date: f.date, from_area: f.fromArea, to_area: f.toArea, fare: fare ?? 0, tenko_label: tenkoOpt.label, tenko_fee: tenkoFee, toll_fee: tollFee, passengers: f.passengers, notes: f.notes, total, bill_month: f.billMonth }
    const { error } = await supabase.from('transport_reports').update(updated).eq('id', report.id)
    if (!error) onSave(updated)
    setSaving(false)
  }

  const handleSendEmail = async () => {
    setSending(true); setSendResult('')
    try {
      let toEmail = dailyMail
      if (!toEmail) {
        const { data: s } = await supabase.from('settings').select('daily_mail').limit(1).single()
        toEmail = s?.daily_mail ?? ''
      }
      if (!toEmail) { alert('送信先メールアドレスが設定されていません。'); setSending(false); return }
      const lines = ['【送迎日報】', `稼働日：${f.date}`, f.fromArea && f.toArea ? `ルート：${f.fromArea} → ${f.toArea}` : '運行：点呼のみ', f.fromArea && f.toArea ? `旅客運送報酬：¥${(fare ?? 0).toLocaleString()}` : '', `点呼手当：${tenkoOpt.label}${tenkoFee > 0 ? `（¥${tenkoFee.toLocaleString()}）` : ''}`, `高速代等（立替）：¥${tollFee.toLocaleString()} ※別途実費精算`, `合計手当：¥${total.toLocaleString()}`, f.notes ? `備考：${f.notes}` : ''].filter(Boolean).join('\n')
      await sendEmail({ to_email: toEmail, subject: `【送迎日報】${f.date}${f.fromArea && f.toArea ? ` ${f.fromArea}→${f.toArea}` : ' 点呼のみ'}`, message: lines })
      setSendResult('success')
    } catch { setSendResult('error') }
    setSending(false)
  }

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setDeleting(true)
    await supabase.from('transport_reports').delete().eq('id', report.id)
    onDelete(report.id)
    setDeleting(false)
  }

  const inp: React.CSSProperties = { padding: '7px 10px', border: '1px solid var(--border-dark)', borderRadius: 'var(--radius)', fontSize: 13, background: 'var(--surface2)', color: 'var(--text)', width: '100%', appearance: 'none' as const }
  const btn = (variant: 'primary' | 'secondary' | 'danger' | 'success'): React.CSSProperties => ({ padding: '8px 16px', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 500, cursor: 'pointer', border: variant === 'secondary' ? '1px solid var(--border)' : 'none', background: variant === 'primary' ? 'var(--navy)' : variant === 'danger' ? 'var(--danger)' : variant === 'success' ? '#16a34a' : 'var(--surface2)', color: variant === 'secondary' ? 'var(--text)' : '#fff' })

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--surface)', borderRadius: 12, width: '90%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>🚗 送迎日報 編集</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
        </div>
        <div style={{ padding: '16px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>稼働日</div>
              <input type="date" style={inp} value={f.date} onChange={e => set('date')(e.target.value)} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>乗客人数</div>
              <select style={inp} value={f.passengers} onChange={e => set('passengers')(e.target.value)}>
                <option value="—（点呼のみ）">—（点呼のみ）</option>
                <option value="1名">1名</option><option value="2名">2名</option><option value="3名">3名</option><option value="4名">4名</option><option value="5名以上">5名以上</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>出発エリア</div>
              <select style={inp} value={f.fromArea} onChange={e => setF(p => ({ ...p, fromArea: e.target.value, toArea: '' }))}>
                <option value="">-- 選択 --</option>
                {fromAreas.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>到着エリア</div>
              <select style={inp} value={f.toArea} onChange={e => set('toArea')(e.target.value)} disabled={!f.fromArea}>
                <option value="">-- 選択 --</option>
                {toAreas.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>
          <div style={{ background: fare !== null ? 'var(--success-bg)' : 'var(--surface2)', border: `1px solid ${fare !== null ? 'var(--success)' : 'var(--border)'}`, borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>旅客運送報酬（自動計算）<br /><span style={{ fontSize: 13, color: fare !== null ? 'var(--success)' : 'var(--text-muted)' }}>{f.fromArea && f.toArea ? `${f.fromArea} → ${f.toArea}` : '—'}</span></div>
            <div style={{ fontSize: 22, fontWeight: 700, color: fare !== null ? 'var(--success)' : 'var(--text-muted)' }}>{fare !== null ? `¥${fare.toLocaleString()}` : '¥ —'}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>点呼手当</div>
              <select style={inp} value={String(f.tenkoIdx)} onChange={e => set('tenkoIdx')(parseInt(e.target.value))}>
                {TENKO_OPTIONS.map((o, i) => <option key={i} value={i}>{o.label}{o.value > 0 ? ` ¥${o.value.toLocaleString()}` : ''}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>高速代・駐車場（立替）</div>
              <input type="number" style={inp} value={f.toll} onChange={e => set('toll')(e.target.value)} placeholder="0" />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>備考</div>
            <input style={inp} value={f.notes} onChange={e => set('notes')(e.target.value)} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>請求対象月</div>
            <input type="month" style={inp} value={f.billMonth} onChange={e => set('billMonth')(e.target.value)} />
          </div>
          <div style={{ background: 'var(--surface2)', borderRadius: 'var(--radius)', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>合計手当</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--navy)' }}>¥{total.toLocaleString()}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '12px 20px', borderTop: '1px solid var(--border)', justifyContent: 'space-between' }}>
          <button style={btn('danger')} onClick={handleDelete} disabled={deleting}>{confirmDelete ? '本当に削除する' : '🗑 削除'}</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={btn('secondary')} onClick={onClose}>キャンセル</button>
            <button style={{ ...btn('success'), border: '1px solid #16a34a' }} onClick={handleSendEmail} disabled={sending}>
              {sending ? '送信中...' : sendResult === 'success' ? '✅ 送信済' : sendResult === 'error' ? '❌ 失敗' : '📤 メール送信'}
            </button>
            <button style={btn('primary')} onClick={handleSave} disabled={saving}>{saving ? '保存中...' : '💾 保存'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function TransportList({ dailyMail = '' }: { dailyMail?: string }) {
  const [reports, setReports] = useState<TransportReport[]>([])
  const [loading, setLoading] = useState(true)
  const [filterYear, setFilterYear] = useState('')
  const [filterMonth, setFilterMonth] = useState('')
  const [editReport, setEditReport] = useState<TransportReport | null>(null)
  const [fareMap, setFareMap] = useState<Record<string, Record<string, number>>>({})

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const { data, error } = await supabase.from('transport_reports').select('*').order('date', { ascending: false })
      if (!error && data) setReports(data as TransportReport[])
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    const loadFare = async () => {
      const { data } = await supabase.from('transport_fare_settings').select('*')
      if (data && data.length > 0) {
        const map: Record<string, Record<string, number>> = {}
        data.forEach((d: any) => { if (!map[d.from_area]) map[d.from_area] = {}; map[d.from_area][d.to_area] = d.fare })
        setFareMap(map)
      } else {
        const { FARE_TABLE } = await import('../lib/fareTable')
        setFareMap(FARE_TABLE as Record<string, Record<string, number>>)
      }
    }
    loadFare()
  }, [])

  const years = [...new Set(reports.map(r => r.bill_month?.slice(0, 4)))].filter(Boolean).sort().reverse()
  const months = [...new Set(reports.filter(r => !filterYear || r.bill_month?.startsWith(filterYear)).map(r => r.bill_month))].sort().reverse()
  const filtered = reports.filter(r => (!filterYear || r.bill_month?.startsWith(filterYear)) && (!filterMonth || r.bill_month === filterMonth))

  const totalFare = filtered.reduce((s, r) => s + (r.fare ?? 0), 0)
  const totalTenko = filtered.reduce((s, r) => s + (r.tenko_fee ?? 0), 0)
  const totalAmount = filtered.reduce((s, r) => s + (r.total ?? 0), 0)

  const handleSave = (updated: TransportReport) => { setReports(prev => prev.map(r => r.id === updated.id ? updated : r)); setEditReport(null) }
  const handleDelete = (id: string) => { setReports(prev => prev.filter(r => r.id !== id)); setEditReport(null) }

  return (
    <div style={{ padding: '20px 22px' }}>
      <PageHeader title="送迎日報一覧" sub="送迎業務（二種免許）の日報一覧" />
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <Select value={filterYear} onChange={v => { setFilterYear(v); setFilterMonth('') }}>
          <option value="">すべての年</option>
          {years.map(y => <option key={y} value={y}>{y}年</option>)}
        </Select>
        <Select value={filterMonth} onChange={setFilterMonth}>
          <option value="">すべての月</option>
          {months.map(m => <option key={m} value={m}>{m}</option>)}
        </Select>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {[{ label: '件数', value: `${filtered.length}件` }, { label: '旅客運送報酬', value: `¥${totalFare.toLocaleString()}`, color: 'var(--accent)' }, { label: '点呼手当', value: `¥${totalTenko.toLocaleString()}` }, { label: '合計手当', value: `¥${totalAmount.toLocaleString()}`, color: 'var(--accent)', bold: true }].map(c => (
          <div key={c.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 12px', fontSize: 12 }}>
            {c.label}: <strong style={{ color: c.color ?? 'inherit', fontWeight: c.bold ? 700 : 600 }}>{c.value}</strong>
          </div>
        ))}
      </div>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '8px 12px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>💡 行をクリックすると編集できます</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <thead>
              <tr style={{ background: 'var(--surface2)' }}>
                {[['稼働日','90px'],['出発エリア','110px'],['到着エリア','110px'],['乗客','60px'],['旅客運送報酬','100px'],['点呼手当','120px'],['高速代等','80px'],['合計手当','90px'],['状態','70px']].map(([h,w]) => (
                  <th key={h} style={{ padding: '7px 8px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textAlign: 'left', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', width: w }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>読み込み中...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>送迎日報がありません</td></tr>
              ) : filtered.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                  onClick={() => setEditReport(r)}
                  onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'var(--accent-bg)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = '' }}>
                  <td style={{ padding: '10px 8px', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.date}</td>
                  <td style={{ padding: '10px 8px', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.from_area || '—'}</td>
                  <td style={{ padding: '10px 8px', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.to_area || '—'}</td>
                  <td style={{ padding: '10px 8px', fontSize: 12 }}>{r.passengers || '—'}</td>
                  <td style={{ padding: '10px 8px', fontSize: 12, textAlign: 'right' }}>{r.fare > 0 ? `¥${r.fare.toLocaleString()}` : '—'}</td>
                  <td style={{ padding: '10px 8px', fontSize: 11, textAlign: 'right' }}>{r.tenko_fee > 0 ? <><div>¥{r.tenko_fee.toLocaleString()}</div><div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{r.tenko_label}</div></> : '—'}</td>
                  <td style={{ padding: '10px 8px', fontSize: 12, textAlign: 'right', color: 'var(--text-muted)' }}>{r.toll_fee > 0 ? `¥${r.toll_fee.toLocaleString()}` : '—'}</td>
                  <td style={{ padding: '10px 8px', fontSize: 12, textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>¥{(r.total ?? 0).toLocaleString()}</td>
                  <td style={{ padding: '10px 8px' }}><SentBadge sent={r.sent} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {editReport && <EditModal report={editReport} onClose={() => setEditReport(null)} onSave={handleSave} onDelete={handleDelete} dailyMail={dailyMail} fareMap={fareMap} />}
    </div>
  )
}

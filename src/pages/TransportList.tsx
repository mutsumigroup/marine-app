import { useState, useEffect } from 'react'
import { Card, PageHeader, Select } from '../components/UI'
import { supabase } from '../lib/supabase'
import type { TransportReport } from '../types/transport'

// ステータスバッジ
function SentBadge({ sent }: { sent: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '2px 8px',
      borderRadius: 999, fontSize: 11, fontWeight: 600,
      background: sent ? '#f0fdf4' : '#fff7e6',
      color: sent ? '#16a34a' : '#d97706',
    }}>
      {sent ? '送信済' : '未送信'}
    </span>
  )
}

export default function TransportList() {
  const [reports, setReports] = useState<TransportReport[]>([])
  const [loading, setLoading] = useState(true)
  const [filterMonth, setFilterMonth] = useState('')

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

  const months = [...new Set(reports.map(r => r.bill_month))].sort().reverse()
  const filtered = filterMonth ? reports.filter(r => r.bill_month === filterMonth) : reports

  const totalFare   = filtered.reduce((s, r) => s + (r.fare ?? 0), 0)
  const totalTenko  = filtered.reduce((s, r) => s + (r.tenko_fee ?? 0), 0)
  const totalAmount = filtered.reduce((s, r) => s + (r.total ?? 0), 0)

  return (
    <div style={{ padding: '20px 22px' }}>
      <PageHeader title="送迎日報一覧" sub="送迎業務（二種免許）の日報一覧" />

      {/* フィルター */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <Select value={filterMonth} onChange={setFilterMonth}>
          <option value="">すべての月</option>
          {months.map(m => <option key={m} value={m}>{m}</option>)}
        </Select>
      </div>

      {/* サマリー */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {[
          { label: '件数',         value: `${filtered.length}件` },
          { label: '旅客運送手当', value: `¥${totalFare.toLocaleString()}`,   color: 'var(--accent)' },
          { label: '点呼手当',     value: `¥${totalTenko.toLocaleString()}` },
          { label: '合計手当',     value: `¥${totalAmount.toLocaleString()}`, color: 'var(--accent)', bold: true },
        ].map(c => (
          <div key={c.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 12px', fontSize: 12 }}>
            {c.label}: <strong style={{ color: c.color ?? 'inherit', fontWeight: c.bold ? 700 : 600 }}>{c.value}</strong>
          </div>
        ))}
      </div>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '8px 12px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
          💡 送迎業務（二種免許）の日報一覧
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface2)' }}>
                {['稼働日', '出発エリア', '到着エリア', '乗客', '旅客運送手当', '点呼手当', '高速代等（立替）', '合計手当', '状態'].map(h => (
                  <th key={h} style={{ padding: '7px 10px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textAlign: 'left', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '.3px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>読み込み中...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>送迎日報がありません</td></tr>
              ) : filtered.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = '#f0f6ff' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = '' }}>
                  <td style={{ padding: '10px 10px', fontSize: 12, whiteSpace: 'nowrap' }}>{r.date}</td>
                  <td style={{ padding: '10px 10px', fontSize: 12 }}>{r.from_area || '—'}</td>
                  <td style={{ padding: '10px 10px', fontSize: 12 }}>{r.to_area || '—'}</td>
                  <td style={{ padding: '10px 10px', fontSize: 12 }}>{r.passengers || '—'}</td>
                  <td style={{ padding: '10px 10px', fontSize: 12, textAlign: 'right' }}>
                    {r.fare > 0 ? `¥${r.fare.toLocaleString()}` : '—'}
                  </td>
                  <td style={{ padding: '10px 10px', fontSize: 12, textAlign: 'right' }}>
                    {r.tenko_fee > 0 ? <><div>¥{r.tenko_fee.toLocaleString()}</div><div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{r.tenko_label}</div></> : '—'}
                  </td>
                  <td style={{ padding: '10px 10px', fontSize: 12, textAlign: 'right', color: 'var(--text-muted)' }}>
                    {r.toll_fee > 0 ? `¥${r.toll_fee.toLocaleString()}` : '—'}
                  </td>
                  <td style={{ padding: '10px 10px', fontSize: 12, textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>
                    ¥{(r.total ?? 0).toLocaleString()}
                  </td>
                  <td style={{ padding: '10px 10px' }}>
                    <SentBadge sent={r.sent} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

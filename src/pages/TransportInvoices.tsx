import { useState, useEffect } from 'react'
import { Btn, PageHeader } from '../components/UI'
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

interface MonthSummary {
  month: string
  reports: TransportReport[]
  totalFare: number
  totalTenko: number
  total: number
  status: '未請求' | '送信済' | '入金済'
}

export default function TransportInvoices() {
  const [reports, setReports] = useState<TransportReport[]>([])
  const [loading, setLoading] = useState(true)

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
      totalFare: reps.reduce((s, r) => s + (r.fare ?? 0), 0),
      totalTenko: reps.reduce((s, r) => s + (r.tenko_fee ?? 0), 0),
      total: reps.reduce((s, r) => s + (r.total ?? 0), 0),
      status: '未請求' as const,
    }))

  const totalAll = summaries.reduce((s, m) => s + m.total, 0)

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>読み込み中...</div>

  return (
    <div>
      {/* サマリーカード */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 20 }}>
        {[
          { label: '送迎請求総額',   value: `¥${totalAll.toLocaleString()}`,     color: '#1a1a1a' },
          { label: '月数',           value: `${summaries.length}ヶ月`,            color: '#2563eb' },
          { label: '総件数',         value: `${reports.length}件`,                color: '#d97706' },
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
              <StatusBadge status={s.status} />
              <div style={{ marginLeft: 'auto', fontSize: 16, fontWeight: 600 }}>¥{s.total.toLocaleString()}</div>
            </div>
            <div style={{ display: 'flex', gap: 20, fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, flexWrap: 'wrap' }}>
              <span>旅客運送手当 <strong style={{ color: 'var(--text)' }}>¥{s.totalFare.toLocaleString()}</strong></span>
              <span>点呼手当 <strong style={{ color: 'var(--text)' }}>¥{s.totalTenko.toLocaleString()}</strong></span>
              <span>件数 <strong style={{ color: 'var(--text)' }}>{s.reports.length}件</strong></span>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Btn size="sm" variant="success">📤 PDF生成・送信</Btn>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

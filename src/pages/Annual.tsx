import { Card, CardTitle, StatGrid, StatCard, ProgressBar, BarChart, Table, TR, Empty, Badge, PageHeader } from '../components/UI'
import type { Report, Invoice, Settings } from '../types'

interface Props { reports: Report[]; invoices: Invoice[]; settings: Settings }

export default function Annual({ reports, invoices, settings }: Props) {
  const yr = String(new Date().getFullYear())
  const reps = reports.filter(r => r.bill_month?.startsWith(yr))
  const total = reps.reduce((s, r) => s + r.amount, 0)
  const goal = settings.client_annual_goal
  const remaining = Math.max(0, goal - total)
  const rate = goal > 0 ? Math.min(100, Math.round(total / goal * 100)) : 0

  const monthData = Array.from({ length: 12 }, (_, i) => {
    const k = `${yr}-${String(i + 1).padStart(2, '0')}`
    return { label: `${i + 1}月`, value: reps.filter(r => r.bill_month === k).reduce((s, r) => s + r.amount, 0) }
  })

  return (
    <div style={{ padding: '20px 22px' }}>
      <PageHeader title="年間売上管理" sub={`${settings.client_name} — ${yr}年`} />

      <StatGrid>
        <StatCard label="年間目標" value={`¥${goal.toLocaleString()}`} />
        <StatCard label="現在請求額" value={`¥${total.toLocaleString()}`} color="accent" />
        <StatCard label="目標残高" value={`¥${remaining.toLocaleString()}`} color="warning" />
        <StatCard label="達成率" value={`${rate}%`} color="success" />
      </StatGrid>

      <Card>
        <CardTitle>📈 {settings.client_name} — {yr}年 進捗</CardTitle>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
          <span style={{ color: 'var(--text-muted)' }}>達成率 {rate}%</span>
          <span>¥{total.toLocaleString()} / ¥{goal.toLocaleString()}</span>
        </div>
        <ProgressBar value={rate} />
        <div style={{ height: 1, background: 'var(--border)', margin: '14px 0' }} />
        <CardTitle>📊 月別売上</CardTitle>
        <BarChart data={monthData} />
      </Card>

      <Card>
        <CardTitle>📋 月別内訳</CardTitle>
        <Table head={['月', '売上', '立替', '件数', '請求状況']}>
          {monthData.map((m, i) => {
            const k = `${yr}-${String(i + 1).padStart(2, '0')}`
            const mReps = reps.filter(r => r.bill_month === k)
            const mExp = mReps.reduce((s, r) => s + r.expenses, 0)
            const inv = invoices.find(i2 => i2.billing_month === k)
            return (
              <TR key={k} cells={[
                `${i + 1}月`,
                m.value > 0 ? <strong key="v">¥{m.value.toLocaleString()}</strong> : '—',
                mExp > 0 ? `¥${mExp.toLocaleString()}` : '—',
                mReps.length > 0 ? `${mReps.length}件` : '—',
                inv ? <Badge key="b" status={inv.status} /> : '—',
              ]} />
            )
          })}
        </Table>
      </Card>

      {/* URL for email */}
      <Card>
        <CardTitle>🔗 年間売上状況URL（日報メールに自動添付）</CardTitle>
        <div style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 12, color: 'var(--accent)', fontFamily: 'monospace' }}>
          {window.location.origin}/annual
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
          このURLを日報メールに添付することで、取引先が年間進捗をリアルタイムで確認できます。
        </p>
      </Card>
    </div>
  )
}

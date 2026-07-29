import { useNavigate } from 'react-router-dom'
import { Card, CardTitle, StatGrid, StatCard, ProgressBar, BarChart, Table, Badge, PageHeader } from '../components/UI'
import type { Report, Invoice, Settings } from '../types'
interface Props { reports: Report[]; invoices: Invoice[]; settings: Settings }
export default function Annual({ reports, invoices, settings }: Props) {
  const navigate = useNavigate()
  const yr = String(new Date().getFullYear())
  const now = new Date()
  const currentMonth = now.getMonth() + 1 // 1-12
  const reps = reports.filter(r => r.bill_month?.startsWith(yr))
  const total = reps.reduce((s, r) => s + r.amount, 0)
  const goal = settings.client_annual_goal
  const remaining = Math.max(0, goal - total)
  const rate = goal > 0 ? Math.min(100, Math.round(total / goal * 100)) : 0
  const monthData = Array.from({ length: 12 }, (_, i) => {
    const k = `${yr}-${String(i + 1).padStart(2, '0')}`
    return { label: `${i + 1}月`, value: reps.filter(r => r.bill_month === k).reduce((s, r) => s + r.amount, 0) }
  })

  // 月次目安の計算
  const monthlyGoal = goal > 0 ? Math.round(goal / 12) : 0
  const expectedTotal = monthlyGoal * currentMonth
  const gap = total - expectedTotal // マイナスなら不足
  const remainingMonths = 12 - currentMonth
  const neededPerMonth = remainingMonths > 0 && remaining > 0
    ? Math.ceil(remaining / remainingMonths)
    : 0
  const diff = neededPerMonth - monthlyGoal // 月次目安と通常目標の差

  return (
    <div style={{ padding: '20px 22px' }}>
      <PageHeader title="売上・目標管理" sub={`${settings.client_name} — ${yr}年`} />
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

        {/* 月次目安（さりげなく） */}
        {monthlyGoal > 0 && remainingMonths > 0 && (
          <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--surface2)', borderRadius: 8, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.8 }}>
              {gap < 0 ? (
                <>
                  <span>📌 {currentMonth}月時点で目標より </span>
                  <span style={{ color: 'var(--warning)', fontWeight: 600 }}>¥{Math.abs(gap).toLocaleString()} 不足</span>
                  <span>しています。</span>
                  <span style={{ marginLeft: 8 }}>残り{remainingMonths}ヶ月の月次目安: </span>
                  <span style={{ fontWeight: 600, color: 'var(--text)' }}>¥{neededPerMonth.toLocaleString()}</span>
                  <span style={{ color: 'var(--text-light)', marginLeft: 4 }}>（通常より+¥{diff.toLocaleString()}）</span>
                </>
              ) : (
                <>
                  <span>✅ {currentMonth}月時点でペースは順調です。</span>
                  <span style={{ marginLeft: 8 }}>残り{remainingMonths}ヶ月の月次目安: </span>
                  <span style={{ fontWeight: 600, color: 'var(--text)' }}>¥{neededPerMonth.toLocaleString()}</span>
                </>
              )}
            </div>
          </div>
        )}
      </Card>
      <Card>
        <CardTitle>📋 月別内訳</CardTitle>
        <Table head={['月', '売上', '立替', '件数', '請求状況']}>
          {monthData.map((m, i) => {
            const k = `${yr}-${String(i + 1).padStart(2, '0')}`
            const mReps = reps.filter(r => r.bill_month === k)
            const mExp = mReps.reduce((s, r) => s + r.expenses, 0)
            const inv = invoices.find(i2 => i2.billing_month === k)
            const hasData = m.value > 0 || mReps.length > 0
            return (
              <tr key={k}
                onClick={() => navigate(`/reports?month=${k}`)}
                style={{ cursor: hasData ? 'pointer' : 'default', borderBottom: '1px solid var(--border)' }}
                onMouseEnter={e => { if (hasData) (e.currentTarget as HTMLTableRowElement).style.background = 'var(--accent-bg)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = '' }}
              >
                <td style={{ padding: '8px 10px', fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>{i + 1}月</td>
                <td style={{ padding: '8px 10px', fontSize: 13 }}>{m.value > 0 ? <strong>¥{m.value.toLocaleString()}</strong> : '—'}</td>
                <td style={{ padding: '8px 10px', fontSize: 13 }}>{mExp > 0 ? `¥${mExp.toLocaleString()}` : '—'}</td>
                <td style={{ padding: '8px 10px', fontSize: 13 }}>{mReps.length > 0 ? `${mReps.length}件` : '—'}</td>
                <td style={{ padding: '8px 10px' }}>{inv ? <Badge status={inv.status} /> : '—'}</td>
              </tr>
            )
          })}
        </Table>
      </Card>
      <Card>
        <CardTitle>🔗 売上・目標管理URL（日報メールに自動添付）</CardTitle>
        <div style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 12, color: 'var(--accent)', fontFamily: 'monospace' }}>
          {window.location.origin}/annual
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
          このURLを日報メールに添付することで、取引先が売上・目標進捗をリアルタイムで確認できます。
        </p>
      </Card>
    </div>
  )
}

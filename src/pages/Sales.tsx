import { useState } from 'react'
import { Card, Table, TR, Empty, Select, StatGrid, StatCard, PageHeader } from '../components/UI'
import type { Report } from '../types'

interface Props { reports: Report[] }

export default function Sales({ reports }: Props) {
  const [filterMonth, setFilterMonth] = useState('')
  const months = [...new Set(reports.map(r => r.bill_month))].sort().reverse()
  const filtered = filterMonth ? reports.filter(r => r.bill_month === filterMonth) : reports
  const sorted = [...filtered].sort((a, b) => b.date.localeCompare(a.date))

  const tot = filtered.reduce((s, r) => s + r.amount, 0)
  const exp = filtered.reduce((s, r) => s + r.expenses, 0)

  return (
    <div style={{ padding: '20px 22px' }}>
      <PageHeader title="売上管理" sub="日報から自動登録（Supabase）">
        <Select value={filterMonth} onChange={setFilterMonth}>
          <option value="">すべての月</option>
          {months.map(m => <option key={m}>{m}</option>)}
        </Select>
      </PageHeader>

      <StatGrid>
        <StatCard label="売上合計" value={`¥${tot.toLocaleString()}`} />
        <StatCard label="立替合計" value={`¥${exp.toLocaleString()}`} color="warning" />
        <StatCard label="件数" value={`${filtered.length}件`} color="accent" />
        <StatCard label="売上＋立替" value={`¥${(tot + exp).toLocaleString()}`} color="success" />
      </StatGrid>

      <Card>
        <Table head={['稼働日', '港', '船名', '船員', '対応区分', '売上金額', '立替金額', '請求月']}>
          {sorted.length === 0 ? <Empty label="データがありません" /> : sorted.map(r => (
            <TR key={r.id} cells={[
              r.date, r.port, r.ship, `${r.crew}名`, r.category,
              <strong key="a">¥{r.amount.toLocaleString()}</strong>,
              `¥${r.expenses.toLocaleString()}`,
              r.bill_month,
            ]} />
          ))}
        </Table>
      </Card>
    </div>
  )
}

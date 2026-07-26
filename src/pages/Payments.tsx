import { useState } from 'react'
import { Card, Table, TR, Empty, Badge, Btn, StatGrid, StatCard, PageHeader } from '../components/UI'
import type { Invoice } from '../types'

interface Props { invoices: Invoice[]; onPaid: (id: string) => Promise<boolean> }

export default function Payments({ invoices, onPaid }: Props) {
  const [processing, setProcessing] = useState<string | null>(null)
  const list = invoices.filter(i => ['送信済', '入金待ち', '入金済'].includes(i.status)).sort((a, b) => b.billing_month.localeCompare(a.billing_month))
  const tot = list.reduce((s, i) => s + i.total, 0)
  const paid = list.filter(i => i.status === '入金済').reduce((s, i) => s + i.total, 0)
  const wait = list.filter(i => i.status !== '入金済').reduce((s, i) => s + i.total, 0)

  const handlePaid = async (id: string) => {
    setProcessing(id)
    await onPaid(id)
    setProcessing(null)
  }

  return (
    <div style={{ padding: '20px 22px' }}>
      <PageHeader title="入金管理" sub="請求ごとの入金状況（Supabase）" />
      <StatGrid>
        <StatCard label="請求総額" value={`¥${tot.toLocaleString()}`} />
        <StatCard label="入金済" value={`¥${paid.toLocaleString()}`} color="success" />
        <StatCard label="入金待ち" value={`¥${wait.toLocaleString()}`} color="danger" />
        <StatCard label="入金率" value={`${tot > 0 ? Math.round(paid / tot * 100) : 0}%`} color="accent" />
      </StatGrid>
      <Card>
        <Table head={['請求書番号', '請求月', '合計', '入金日', '状況', '操作']}>
          {list.length === 0 ? <Empty label="データがありません" /> : list.map(inv => (
            <TR key={inv.id}
              cells={[
                <span key="id" style={{ fontFamily: 'monospace', fontSize: 10 }}>{inv.id}</span>,
                inv.billing_month,
                <strong key="t">¥{inv.total.toLocaleString()}</strong>,
                inv.paid_date || '—',
              ]}
              badge={<Badge status={inv.status} />}
              actions={inv.status !== '入金済'
                ? [<Btn key="p" size="sm" variant="success" disabled={processing === inv.id} onClick={() => handlePaid(inv.id)}>
                    {processing === inv.id ? '処理中...' : '✓ 入金済'}
                  </Btn>]
                : [<span key="done" style={{ fontSize: 10, color: 'var(--text-light)' }}>完了</span>]
              }
            />
          ))}
        </Table>
      </Card>
    </div>
  )
}

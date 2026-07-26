import { useNavigate } from 'react-router-dom'
import { Btn, StatGrid, StatCard, Card, CardTitle, BarChart, ProgressBar, PageHeader } from '../components/UI'
import type { Report, Invoice, Settings } from '../types'

interface Props { reports: Report[]; invoices: Invoice[]; settings: Settings; reload: () => void }

export default function Dashboard({ reports, invoices, settings, reload }: Props) {
  const navigate = useNavigate()
  const now = new Date()
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const yr = String(now.getFullYear())

  const mSales = reports.filter(r => r.bill_month === ym).reduce((s, r) => s + r.amount, 0)
  const ySales = reports.filter(r => r.bill_month?.startsWith(yr)).reduce((s, r) => s + r.amount, 0)
  const goal = settings.client_annual_goal
  const rate = goal > 0 ? Math.round(ySales / goal * 100) : 0
  const uninv = reports.filter(r => !r.invoiced).length
  const waitAmt = invoices.filter(i => ['送信済', '入金待ち'].includes(i.status)).reduce((s, i) => s + i.total, 0)

  const monthData = Array.from({ length: 12 }, (_, i) => {
    const k = `${yr}-${String(i + 1).padStart(2, '0')}`
    return { label: `${i + 1}月`, value: reports.filter(r => r.bill_month === k).reduce((s, r) => s + r.amount, 0) }
  })

  const recent = [...reports].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6)

  return (
    <div style={{ padding: '20px 22px' }}>
      <PageHeader title="ダッシュボード" sub={now.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}>
        <Btn variant="default" size="sm" onClick={reload}>↻ 更新</Btn>
        <Btn variant="primary" onClick={() => navigate('/daily')}>＋ 日報を作成</Btn>
      </PageHeader>

      <StatGrid>
        <StatCard label="今月売上" value={`¥${mSales.toLocaleString()}`} color="accent" />
        <StatCard label="年間売上" value={`¥${ySales.toLocaleString()}`} />
        <StatCard label="年間目標" value={`¥${goal.toLocaleString()}`} />
        <StatCard label="達成率" value={`${rate}%`} sub={`残 ¥${Math.max(0, goal - ySales).toLocaleString()}`} color="success" />
        <StatCard label="未請求件数" value={`${uninv}件`} color="warning" />
        <StatCard label="入金待ち" value={`¥${waitAmt.toLocaleString()}`} color="danger" />
      </StatGrid>

      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 14 }}>
        <Card>
          <CardTitle>📊 月別売上（万円）</CardTitle>
          <BarChart data={monthData} />
        </Card>
        <Card>
          <CardTitle>🎯 年間目標進捗</CardTitle>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>{settings.client_name}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
            <span style={{ color: 'var(--text-muted)' }}>達成率</span>
            <span style={{ fontWeight: 600 }}>{rate}%</span>
          </div>
          <ProgressBar value={rate} />
          <div style={{ fontSize: 10, color: 'var(--text-light)', marginTop: 4, marginBottom: 12 }}>
            ¥{ySales.toLocaleString()} / ¥{goal.toLocaleString()}
          </div>
          <div style={{ height: 1, background: 'var(--border)', margin: '10px 0' }} />
          {[
            ['年間目標', `¥${goal.toLocaleString()}`],
            ['現在請求額', `¥${ySales.toLocaleString()}`],
            ['目標残高', `¥${Math.max(0, goal - ySales).toLocaleString()}`],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 5 }}>
              <span style={{ color: 'var(--text-muted)' }}>{k}</span>
              <span style={{ fontWeight: k === '目標残高' ? 600 : 400, color: k === '目標残高' ? 'var(--accent)' : 'var(--text)' }}>{v}</span>
            </div>
          ))}
        </Card>
      </div>

      <Card style={{ marginTop: 14 }}>
        <CardTitle>🕐 最近の日報</CardTitle>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--surface2)' }}>
                {['稼働日','港名','船名','人数','対応区分','業務内容','駐車場','高速料金','食事代','Voucher','売上金額'].map(h => (
                  <th key={h} style={{ padding: '7px 8px', fontSize: 10, fontWeight: 600, color: h === '売上金額' ? 'var(--accent)' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.3px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', textAlign: 'left', background: h === '売上金額' ? 'var(--accent-bg)' : undefined }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recent.length === 0
                ? <tr><td colSpan={11} style={{ padding: 24, textAlign: 'center', color: 'var(--text-light)' }}>日報がありません</td></tr>
                : recent.map(r => {
                  const catColors: Record<string, {bg:string;color:string;border:string}> = {
                    '乗船': {bg:'#fccaca',color:'#9b1c1c',border:'#f87171'},
                    '下船': {bg:'#bfdbfe',color:'#1e40af',border:'#60a5fa'},
                    'センディング': {bg:'#fde68a',color:'#92400e',border:'#f59e0b'},
                    '転船': {bg:'#bbf7d0',color:'#14532d',border:'#4ade80'},
                  }
                  const c = catColors[r.category]
                  return (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'var(--surface2)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = '' }}>
                      <td style={{ padding: '7px 8px' }}>{r.date}</td>
                      <td style={{ padding: '7px 8px', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.port}</td>
                      <td style={{ padding: '7px 8px', maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.ship}>{r.ship}</td>
                      <td style={{ padding: '7px 8px', textAlign: 'center' }}>{r.crew}</td>
                      <td style={{ padding: '7px 8px' }}>
                        {c
                          ? <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: c.bg, color: c.color, border: `1px solid ${c.border}`, whiteSpace: 'nowrap' }}>{r.category}</span>
                          : <span style={{ fontSize: 12 }}>{r.category}</span>
                        }
                      </td>
                      <td style={{ padding: '7px 8px', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: 11 }} title={r.work}>{r.work || '—'}</td>
                      <td style={{ padding: '7px 8px', fontSize: 11 }}>{r.park_fee > 0 ? `¥${r.park_fee.toLocaleString()}` : '—'}</td>
                      <td style={{ padding: '7px 8px', fontSize: 11 }}>{r.hw_fee > 0 ? `¥${r.hw_fee.toLocaleString()}` : '—'}</td>
                      <td style={{ padding: '7px 8px', fontSize: 11 }}>{r.meal > 0 ? `¥${r.meal.toLocaleString()}` : '—'}</td>
                      <td style={{ padding: '7px 8px', fontSize: 10, maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.voucher
                          ? r.voucher.startsWith('http') || r.voucher.startsWith('data:')
                            ? <a href={r.voucher} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline', fontSize: 10 }}>🔗 開く</a>
                            : <span style={{ color: 'var(--text-light)' }}>{r.voucher}</span>
                          : <span style={{ color: 'var(--text-light)' }}>—</span>
                        }
                      </td>
                      <td style={{ padding: '7px 8px', background: 'var(--accent-bg)' }}>
                        <strong style={{ color: 'var(--accent)', fontSize: 12 }}>¥{r.amount.toLocaleString()}</strong>
                      </td>
                    </tr>
                  )
                })
              }
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

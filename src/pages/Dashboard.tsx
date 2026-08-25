import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EditModal } from './ReportsList'
import { Btn, StatGrid, StatCard, Card, CardTitle, BarChart, ProgressBar, PageHeader } from '../components/UI'
import type { Report, Invoice, Settings } from '../types'

const MONTHLY_GOAL = 400000

interface Props { reports: Report[]; invoices: Invoice[]; settings: Settings; reload: () => void; onUpdateReport: (id: string, updates: Partial<Report>) => Promise<boolean>; onDeleteReport: (id: string) => Promise<boolean> }

export default function Dashboard({ reports, invoices, settings, reload, onUpdateReport, onDeleteReport }: Props) {
  const navigate = useNavigate()
  const [editReport, setEditReport] = useState<Report | null>(null)
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

  // ===================== 累計追跡（契約開始から通算） =====================
  const allMonths = [...new Set(reports.map(r => r.bill_month).filter(Boolean))].sort()
  const startMonth = allMonths[0] ?? ym

  const getMonthsBetween = (from: string, to: string) => {
    const result: string[] = []
    let [y, m] = from.split('-').map(Number)
    const [ey, em] = to.split('-').map(Number)
    while (y < ey || (y === ey && m <= em)) {
      result.push(`${y}-${String(m).padStart(2, '0')}`)
      m++; if (m > 12) { m = 1; y++ }
    }
    return result
  }

  const allPeriodMonthsRaw = getMonthsBetween(startMonth, ym)
  const allPeriodMonths = allPeriodMonthsRaw.length > 1 ? allPeriodMonthsRaw.slice(1) : allPeriodMonthsRaw
  const totalMonths = allPeriodMonths.length
  const totalSales = reports
    .filter(r => r.bill_month && r.bill_month >= allPeriodMonths[0] && r.bill_month <= ym)
    .reduce((s, r) => s + r.amount, 0)
  const totalGoal = totalMonths * MONTHLY_GOAL
  const totalDiff = totalSales - totalGoal
  const isAhead = totalDiff >= 0
  const achieveRate = totalGoal > 0 ? Math.min(100, Math.round(totalSales / totalGoal * 100)) : 0

  const maxBarVal = Math.max(
    ...allPeriodMonths.map(m => reports.filter(r => r.bill_month === m).reduce((s, r) => s + r.amount, 0)),
    MONTHLY_GOAL * 1.2
  )

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

      {/* 累計売上追跡 */}
      <div style={{ background: '#ffffff', border: '0.5px solid #E5E5E5', borderRadius: 12, padding: '20px 22px', marginBottom: 14 }}>

        {/* ヘッダー */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, color: '#222' }}>累計売上追跡</div>
            <div style={{ fontSize: 11, color: '#777', marginTop: 2 }}>
              {allPeriodMonths[0]} 〜 {ym}（{totalMonths}ヶ月目）· 月次目標 ¥40万
            </div>
          </div>
          <div style={{
            fontSize: 11, fontWeight: 500, padding: '5px 14px', borderRadius: 20,
            background: isAhead ? '#D1FAE5' : '#FEE2E2',
            color: isAhead ? '#065F46' : '#991B1B',
            border: `0.5px solid ${isAhead ? '#6EE7B7' : '#FCA5A5'}`
          }}>
            {isAhead ? `✅ ¥${totalDiff.toLocaleString()} 超過` : `⚠ ¥${Math.abs(totalDiff).toLocaleString()} 不足`}
          </div>
        </div>

        {/* 3枚メトリクス */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
          <div style={{ background: '#F8F8F8', borderRadius: 8, padding: '14px 16px', textAlign: 'center', border: '0.5px solid #E5E5E5' }}>
            <div style={{ fontSize: 11, color: '#777', marginBottom: 5 }}>累計目標</div>
            <div style={{ fontSize: 20, fontWeight: 500, color: '#222' }}>¥{totalGoal.toLocaleString()}</div>
            <div style={{ fontSize: 10, color: '#999', marginTop: 3 }}>{totalMonths}ヶ月 × ¥400,000</div>
          </div>
          <div style={{ background: '#F8F8F8', borderRadius: 8, padding: '14px 16px', textAlign: 'center', border: '0.5px solid #E5E5E5' }}>
            <div style={{ fontSize: 11, color: '#777', marginBottom: 5 }}>累計売上実績</div>
            <div style={{ fontSize: 20, fontWeight: 500, color: '#185FA5' }}>¥{totalSales.toLocaleString()}</div>
            <div style={{ fontSize: 10, color: '#999', marginTop: 3 }}>達成率 {achieveRate}%</div>
          </div>
          <div style={{
            background: isAhead ? '#F0FDF4' : '#FEF2F2', borderRadius: 8, padding: '14px 16px', textAlign: 'center',
            border: `0.5px solid ${isAhead ? '#6EE7B7' : '#FECACA'}`
          }}>
            <div style={{ fontSize: 11, color: isAhead ? '#065F46' : '#991B1B', marginBottom: 5 }}>
              {isAhead ? '累計超過額' : '累計不足額'}
            </div>
            <div style={{ fontSize: 20, fontWeight: 500, color: isAhead ? '#059669' : '#DC2626' }}>
              {isAhead ? '+' : '-'}¥{Math.abs(totalDiff).toLocaleString()}
            </div>
            <div style={{ fontSize: 10, color: isAhead ? '#065F46' : '#B91C1C', marginTop: 3 }}>
              {isAhead ? '翌月以降の余裕分' : '翌月以降で巻き返し'}
            </div>
          </div>
        </div>

        {/* 月別棒グラフ */}
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: Math.max(500, allPeriodMonths.length * 48) }}>

            {/* バー */}
            <div style={{ position: 'relative', display: 'flex', gap: 4, alignItems: 'flex-end', height: 130, paddingBottom: 0 }}>
              {(() => {
                const goalLineH = Math.round((MONTHLY_GOAL / maxBarVal) * 120)
                return (
                  <div style={{
                    position: 'absolute',
                    bottom: goalLineH,
                    left: 0, right: 0,
                    borderTop: '2.5px dashed #eda100',
                    zIndex: 2, pointerEvents: 'none'
                  }}>
                    <span style={{ position: 'absolute', right: 4, top: -16, fontSize: 9, color: '#854F0B', background: '#ffffff', padding: '0 3px' }}>
                      目標 ¥40万
                    </span>
                  </div>
                )
              })()}
              {allPeriodMonths.map(month => {
                const sales = reports.filter(r => r.bill_month === month).reduce((s, r) => s + r.amount, 0)
                const barH = Math.round((sales / maxBarVal) * 120)
                const isOver = sales >= MONTHLY_GOAL
                const label = month.slice(2).replace('-', '/')
                return (
                  <div key={month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: 130 }}>
                    <div
                      title={`${month}: ¥${sales.toLocaleString()}`}
                      style={{
                        width: '75%', height: Math.max(barH, 2),
                        background: isOver ? '#1baf7a' : '#3987e5',
                        borderRadius: '3px 3px 0 0',
                      }}
                    />
                  </div>
                )
              })}
            </div>

            {/* 月ラベル */}
            <div style={{ display: 'flex', gap: 4, marginTop: 5 }}>
              {allPeriodMonths.map(month => {
                const sales = reports.filter(r => r.bill_month === month).reduce((s, r) => s + r.amount, 0)
                const isOver = sales >= MONTHLY_GOAL
                const label = month.slice(2).replace('-', '/')
                return (
                  <div key={month} style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: '#999' }}>{label}</div>
                    <div style={{ fontSize: 9, fontWeight: 500, color: isOver ? '#0F6E56' : '#185FA5' }}>
                      {sales > 0 ? `${Math.round(sales / 10000)}万` : '—'}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* 凡例 */}
        <div style={{ display: 'flex', gap: 20, justifyContent: 'center', fontSize: 11, color: '#777', marginTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: '#1baf7a', display: 'inline-block' }} />目標達成月（¥40万以上）
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: '#3987e5', display: 'inline-block' }} />未達月（¥40万未満）
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ display: 'inline-block', width: 18, borderTop: '2.5px dashed #eda100', verticalAlign: 'middle', marginRight: 2 }} />月次目標ライン
          </div>
        </div>

        {/* 累計進捗バー */}
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '0.5px solid #E5E5E5' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 6 }}>
            <span style={{ color: '#777' }}>累計達成率</span>
            <span style={{ fontWeight: 500, color: isAhead ? '#059669' : '#DC2626' }}>
              {achieveRate}% ／ {isAhead ? `¥${totalDiff.toLocaleString()} 超過中` : `あと ¥${Math.abs(totalDiff).toLocaleString()} の巻き返しが必要`}
            </span>
          </div>
          <div style={{ height: 10, background: '#F0F0F0', borderRadius: 5, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${achieveRate}%`, background: isAhead ? '#1baf7a' : '#3987e5', borderRadius: 5, transition: 'width .5s' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#999', marginTop: 4 }}>
            <span>¥{totalSales.toLocaleString()}</span>
            <span>目標 ¥{totalGoal.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,3fr) minmax(0,2fr)', gap: 14 }}>
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
        <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '4px 0 10px' }}>💡 行をクリックすると編集できます</div>
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
                    <tr key={r.id} onClick={() => setEditReport(r)} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = '#f0f6ff' }}
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
                          ? (() => {
                              const parts = r.voucher.split('|||')
                              const links = parts.filter(p => p.startsWith('http') || p.startsWith('data:'))
                              const texts = parts.filter(p => !p.startsWith('http') && !p.startsWith('data:'))
                              return <>
                                {links.map((url, i) => (
                                  <button key={i} onClick={e => { e.stopPropagation(); if(url.startsWith('data:')){const a=url.split(',');const m=a[0].match(/:(.*?);/)?.[1]??'application/pdf';const b=atob(a[1]);const n=b.length;const u=new Uint8Array(n);for(let j=0;j<n;j++)u[j]=b.charCodeAt(j);window.open(URL.createObjectURL(new Blob([u],{type:m})),'_blank')}else{window.open(url,'_blank')}}}
                                    style={{ color: 'var(--accent)', textDecoration: 'underline', fontSize: 10, display: 'block', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                                    🔗 PDF{links.length > 1 ? i+1 : ''}
                                  </button>
                                ))}
                                {texts.length > 0 && <span style={{ color: 'var(--text-light)', fontSize: 10 }}>{texts.join(', ')}</span>}
                              </>
                            })()
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
      {editReport && <EditModal report={editReport} onClose={() => { setEditReport(null); reload() }} onSave={onUpdateReport} onDelete={onDeleteReport} prices={settings.prices} />}
      {editReport && <EditModal report={editReport} onClose={() => { setEditReport(null); reload() }} onSave={onUpdateReport} onDelete={onDeleteReport} prices={settings.prices} />}
    </div>
  )
}

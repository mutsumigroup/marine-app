import { useState } from 'react'
import { Card, Table, TR, Empty, Badge, Btn, Modal, PageHeader } from '../components/UI'
import { generateInvoicePDF } from '../lib/pdf'
import type { Invoice, Report, Settings } from '../types'

interface Props {
  invoices: Invoice[]
  reports: Report[]
  settings: Settings
  onSend: (id: string) => Promise<boolean>
  onPaid: (id: string) => Promise<boolean>
  onRevert: (id: string, status: InvoiceStatus) => Promise<boolean>
}

const STATUS_ALL = ['未請求', '作成済', '送信済', '入金待ち', '入金済'] as const

export default function Invoices({ invoices, reports, settings, onSend, onPaid, onRevert }: Props) {
  const [filter, setFilter] = useState('')
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [processing, setProcessing] = useState<string | null>(null)
  const [alertMsg, setAlertMsg] = useState('')

  const filtered = filter ? invoices.filter(i => i.status === filter) : invoices
  const sorted = [...filtered].sort((a, b) => b.billing_month.localeCompare(a.billing_month))
  const previewInv = previewId ? invoices.find(i => i.id === previewId) : null

  const handleSend = async (id: string) => {
    setProcessing(id)
    // PDF生成
    const inv = invoices.find(i => i.id === id)!
    const doc = generateInvoicePDF(inv, reports, settings)
    doc.save(`${id}.pdf`)
    await onSend(id)
    setProcessing(null)
  }

  const handlePaid = async (id: string) => {
    setProcessing(id)
    await onPaid(id)
    setProcessing(null)
  }

  const handleRevert = async (id: string, status: InvoiceStatus) => {
    if (!confirm(`ステータスを「${status}」に戻しますか？`)) return
    setProcessing(id)
    await onRevert(id, status)
    setProcessing(null)
  }

  // 請求書プレビュー HTML
  const renderPreview = (inv: Invoice) => {
    const monthReports = reports.filter(r => r.bill_month === inv.billing_month)
    const catSum: Record<string, { count: number; crew: number }> = {}
    monthReports.forEach(r => {
      if (!catSum[r.category]) catSum[r.category] = { count: 0, crew: 0 }
      catSum[r.category].count++
      catSum[r.category].crew += r.crew
    })
    const pr = settings.prices ?? {}
    let bizTotal = 0
    const rows = Object.entries(catSum).map(([cat, d]) => {
      const p = pr[cat] ?? { ship: 10000, crew: 1000 }
      const line = d.count * p.ship + d.crew * (p.crew ?? 0)
      bizTotal += line
      return { cat, count: d.count, crew: d.crew, shipP: p.ship, crewP: p.crew ?? 0, line }
    })
    const parkTotal = monthReports.reduce((s, r) => s + r.park_fee, 0)
    const hwTotal = monthReports.reduce((s, r) => s + r.hw_fee, 0)
    const mealTotal = monthReports.reduce((s, r) => s + r.meal, 0)
    const othTotal = monthReports.reduce((s, r) => s + r.other_exp, 0)
    const today = new Date().toLocaleDateString('ja-JP')
    const due = new Date(Date.now() + (settings.pay_days || 30) * 86400000).toLocaleDateString('ja-JP')
    return { rows, bizTotal, parkTotal, hwTotal, mealTotal, othTotal, fixedExp: (settings.fixed_expenses ?? []), today, due }
  }

  return (
    <div style={{ padding: '20px 22px' }}>
      <PageHeader title="請求書管理" sub="月次請求書の作成・送信・管理（Supabase）" />

      {alertMsg && (
        <div style={{ background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success-border)', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 14, fontSize: 12 }}>
          ✓ {alertMsg}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        <Btn size="sm" variant={filter === '' ? 'primary' : 'default'} onClick={() => setFilter('')}>すべて</Btn>
        {STATUS_ALL.map(s => (
          <Btn key={s} size="sm" variant={filter === s ? 'primary' : 'default'} onClick={() => setFilter(s)}>{s}</Btn>
        ))}
      </div>

      <Card>
        <Table head={['請求書番号', '請求月', '業務金額', '立替', '合計（税込）', 'ステータス', '操作']}>
          {sorted.length === 0 ? <Empty label="請求書がありません" /> : sorted.map(inv => (
            <TR key={inv.id}
              cells={[
                <span key="id" style={{ fontFamily: 'monospace', fontSize: 10 }}>{inv.id}</span>,
                inv.billing_month,
                `¥${inv.subtotal.toLocaleString()}`,
                `¥${inv.expenses.toLocaleString()}`,
                <strong key="t">¥{inv.total.toLocaleString()}</strong>,
              ]}
              badge={<Badge status={inv.status} />}
              actions={<>
                <Btn size="sm" onClick={() => setPreviewId(inv.id)}>👁 確認</Btn>
                {['未請求', '作成済'].includes(inv.status) && (
                  <Btn size="sm" variant="success" disabled={processing === inv.id} onClick={() => handleSend(inv.id)}>
                    {processing === inv.id ? '処理中...' : '📤 請求書作成済'}
                  </Btn>
                )}
                {['送信済', '入金待ち'].includes(inv.status) && (
                  <Btn size="sm" variant="primary" disabled={processing === inv.id} onClick={() => handlePaid(inv.id)}>
                    {processing === inv.id ? '処理中...' : '✓ 入金済'}
                  </Btn>
                )}
                {inv.status === '入金済' && (
                  <Btn size="sm" variant="ghost" disabled={processing === inv.id} onClick={() => handleRevert(inv.id, '送信済')}
                    style={{ fontSize: 10, color: 'var(--text-muted)', border: '1px dashed var(--border-dark)' }}>
                    ↩ 送信済に戻す
                  </Btn>
                )}
                {['送信済', '入金待ち', '作成済'].includes(inv.status) && (
                  <Btn size="sm" variant="ghost" disabled={processing === inv.id} onClick={() => handleRevert(inv.id, '未請求')}
                    style={{ fontSize: 10, color: 'var(--text-muted)', border: '1px dashed var(--border-dark)' }}>
                    ↩ 未請求に戻す
                  </Btn>
                )}
              </>}
            />
          ))}
        </Table>
      </Card>

      {/* Invoice Preview Modal */}
      <Modal open={!!previewInv} onClose={() => setPreviewId(null)} title={`請求書 — ${previewId}`}>
        {previewInv && (() => {
          const { rows, bizTotal, parkTotal, hwTotal, mealTotal, othTotal, fixedExp, today, due } = renderPreview(previewInv)
          const fixedTotal = fixedExp.reduce((s: number, e: {label: string; amount: number}) => s + e.amount, 0)
          const expTotal = parkTotal + hwTotal + mealTotal + othTotal + fixedTotal
          return (
            <>
              <div style={{ background: '#fff', color: '#222', padding: 20, borderRadius: 6, fontSize: 11, lineHeight: 1.6, border: '1px solid #ddd' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 12, borderBottom: '2px solid #1a3a5c', marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: 3, color: '#1a3a5c' }}>請　求　書</div>
                    <div style={{ fontSize: 9, color: '#666', marginTop: 2 }}>登録番号: {settings.invoice_no}</div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 9, color: '#444' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1a3a5c' }}>{settings.company_name}</div>
                    <div>{settings.address}</div>
                    <div>{settings.tel} | {settings.email}</div>
                  </div>
                </div>
                {/* Client */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 8, color: '#888' }}>請求先</div>
                  <div style={{ fontSize: 14, fontWeight: 700, borderBottom: '1px solid #333', display: 'inline-block', paddingBottom: 1 }}>{settings.client_name} 御中</div>
                </div>
                {/* Meta */}
                <div style={{ display: 'flex', gap: 20, marginBottom: 10, fontSize: 9, color: '#555' }}>
                  <div>件名: {previewInv.billing_month}分 業務委託費</div>
                  <div>請求日: {today}</div>
                  <div>支払期限: {due}</div>
                </div>
                {/* Banner */}
                <div style={{ background: '#1a3a5c', color: '#fff', padding: '6px 10px', borderRadius: '3px 3px 0 0', fontSize: 10, display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                  <span>ご請求金額（税込）</span>
                  <span style={{ fontSize: 15 }}>¥{previewInv.total.toLocaleString()}</span>
                </div>
                <div style={{ border: '1px solid #1a3a5c', borderTop: 'none', padding: 10, marginBottom: 10 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#1a3a5c', borderBottom: '1px solid #ccc', paddingBottom: 3, marginBottom: 6 }}>業務明細</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                    <thead><tr style={{ background: '#1a3a5c' }}>
                      {['対応区分', '件数', '船員', '単価（船/人）', '金額'].map(h => (
                        <th key={h} style={{ padding: '4px 6px', color: '#fff', textAlign: h === '金額' ? 'right' : 'left', fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>{rows.map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '4px 6px' }}>{r.cat}</td>
                        <td style={{ padding: '4px 6px' }}>{r.count}隻</td>
                        <td style={{ padding: '4px 6px' }}>{r.crew}名</td>
                        <td style={{ padding: '4px 6px' }}>¥{r.shipP.toLocaleString()} / ¥{r.crewP.toLocaleString()}</td>
                        <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 700 }}>¥{r.line.toLocaleString()}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                  <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid #ddd', fontSize: 9 }}>
                    {[['業務小計', bizTotal], ['消費税（10%）', previewInv.tax], ['業務請求小計', bizTotal + previewInv.tax]].map(([k, v], i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2, fontWeight: i === 2 ? 700 : 400, borderTop: i === 2 ? '1px solid #bbb' : 'none', paddingTop: i === 2 ? 3 : 0 }}>
                        <span>{k}</span><span>¥{(v as number).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Expenses */}
                {expTotal > 0 && (
                  <div style={{ border: '1px solid #ddd', padding: 10, marginBottom: 10, borderRadius: 3 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, borderBottom: '1px solid #eee', paddingBottom: 3, marginBottom: 6 }}>立替金精算</div>
                    {[[' 駐車場料金', parkTotal], ['高速料金', hwTotal], ['食事代', mealTotal], ['その他立替', othTotal], ...fixedExp.map((e: {label: string; amount: number}) => [e.label, e.amount])].filter(([, v]) => (v as number) > 0).map(([k, v], i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, marginBottom: 2 }}>
                        <span>{k}</span><span>¥{(v as number).toLocaleString()}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, fontWeight: 700, borderTop: '1px solid #aaa', marginTop: 3, paddingTop: 3 }}>
                      <span>立替金合計</span><span>¥{expTotal.toLocaleString()}</span>
                    </div>
                  </div>
                )}
                {/* Grand total */}
                <div style={{ background: '#f0f4f8', borderLeft: '3px solid #1a3a5c', padding: '8px 12px', marginBottom: 10, fontSize: 9 }}>
                  {[['業務請求金額（税込）', bizTotal + previewInv.tax], ['立替金精算', expTotal]].map(([k, v], i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span style={{ color: '#555' }}>{k}</span><span>¥{(v as number).toLocaleString()}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, borderTop: '1px solid #1a3a5c', marginTop: 4, paddingTop: 4, color: '#1a3a5c' }}>
                    <span>最終請求金額</span><span>¥{previewInv.total.toLocaleString()}</span>
                  </div>
                </div>
                {/* Bank */}
                <div style={{ background: '#f9f9f9', border: '1px solid #ddd', padding: '8px 10px', borderRadius: 3, fontSize: 9 }}>
                  <div style={{ fontWeight: 700, marginBottom: 2 }}>お振込先</div>
                  <div>{settings.bank}</div><div>{settings.account}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
                <Btn onClick={() => setPreviewId(null)}>閉じる</Btn>
                {['未請求', '作成済'].includes(previewInv.status) && (
                  <Btn variant="success" disabled={!!processing} onClick={async () => { await handleSend(previewInv.id); setPreviewId(null) }}>
                    📤 PDF生成・送信
                  </Btn>
                )}
              </div>
            </>
          )
        })()}
      </Modal>
    </div>
  )
}

import { useState, useCallback } from 'react'
import { Badge, Btn, PageHeader } from '../components/UI'
import { generateInvoicePDF } from '../lib/pdf'
import type { Invoice, Report, Settings } from '../types'

interface Props {
  invoices: Invoice[]
  reports: Report[]
  settings: Settings
  onSend: (id: string) => Promise<boolean>
  onPaid: (id: string) => Promise<boolean>
  onRevert: (id: string, status: string) => Promise<boolean>
}

const STATUS_ALL = ['未請求', '作成済', '送信済', '入金待ち', '入金済'] as const

// ── インライン編集可能なセル ──────────────────────────────────────
function EditCell({
  value,
  onSave,
  align = 'right',
  prefix = '',
}: {
  value: number
  onSave: (v: number) => void
  align?: 'left' | 'right'
  prefix?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value))

  const commit = useCallback(() => {
    const n = parseInt(draft.replace(/[^0-9]/g, ''), 10)
    if (!isNaN(n)) onSave(n)
    setEditing(false)
  }, [draft, onSave])

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
        style={{
          width: 100, textAlign: 'right', padding: '3px 6px',
          border: '1.5px solid var(--accent)', borderRadius: 4,
          fontSize: 12, fontFamily: 'inherit', background: 'var(--accent-bg)',
          color: 'var(--accent)', outline: 'none',
        }}
      />
    )
  }
  return (
    <span
      title="クリックして編集"
      onClick={() => { setDraft(String(value)); setEditing(true) }}
      style={{
        cursor: 'text', display: 'inline-block', textAlign: align,
        padding: '2px 4px', borderRadius: 4, minWidth: 60,
        borderBottom: '1px dashed var(--border-dark)',
      }}
    >
      {prefix}{value.toLocaleString()}
    </span>
  )
}

// ── 請求書プレビュー（フルシート） ────────────────────────────────
function InvoiceSheet({
  inv,
  reports,
  settings,
  onClose,
  onSend,
  processing,
}: {
  inv: Invoice
  reports: Report[]
  settings: Settings
  onClose: () => void
  onSend: (id: string) => Promise<void>
  processing: boolean
}) {
  const monthReports = reports.filter(r => r.bill_month === inv.billing_month)

  // 業務明細の集計
  const catSum: Record<string, { count: number; crew: number }> = {}
  monthReports.forEach(r => {
    if (!catSum[r.category]) catSum[r.category] = { count: 0, crew: 0 }
    catSum[r.category].count++
    catSum[r.category].crew += r.crew
  })
  const pr = settings.prices ?? {}
  let bizSubtotal = 0
  const rows = Object.entries(catSum).map(([cat, d]) => {
    const p = pr[cat] ?? { ship: 10000, crew: 1000 }
    const line = d.count * p.ship + d.crew * (p.crew ?? 0)
    bizSubtotal += line
    return { cat, count: d.count, crew: d.crew, shipP: p.ship, crewP: p.crew ?? 0, line }
  })

  const parkTotal  = monthReports.reduce((s, r) => s + r.park_fee, 0)
  const hwTotal    = monthReports.reduce((s, r) => s + r.hw_fee, 0)
  const mealTotal  = monthReports.reduce((s, r) => s + r.meal, 0)
  const othTotal   = monthReports.reduce((s, r) => s + r.other_exp, 0)
  const fixedExp   = settings.fixed_expenses ?? []
  const fixedTotal = fixedExp.reduce((s: number, e: { label: string; amount: number }) => s + e.amount, 0)
  const expTotal   = parkTotal + hwTotal + mealTotal + othTotal + fixedTotal

  const bizTax   = Math.round(bizSubtotal * 0.1)
  const bizTotal = bizSubtotal + bizTax
  const grandTotal = bizTotal + expTotal

  const today = new Date().toLocaleDateString('ja-JP')
  const due   = new Date(Date.now() + (settings.pay_days || 30) * 86400000).toLocaleDateString('ja-JP')

  // 共通スタイル
  const s = {
    row: { display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 } as React.CSSProperties,
    divider: { borderTop: '0.5px solid #ccc', margin: '6px 0' } as React.CSSProperties,
    sectionTitle: { fontSize: 10, fontWeight: 600, color: '#666', letterSpacing: '.3px', textTransform: 'uppercase' as const, marginBottom: 6 },
  }

  return (
    // モーダル背景
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)',
        zIndex: 300, display: 'flex', alignItems: 'flex-start',
        justifyContent: 'center', overflowY: 'auto', padding: '24px 16px',
      }}
    >
      {/* シート本体 */}
      <div style={{
        background: '#fff', color: '#222', borderRadius: 10, width: '100%', maxWidth: 640,
        boxShadow: '0 12px 48px rgba(0,0,0,.22)', overflow: 'hidden',
      }}>
        {/* ── ヘッダーバー ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 20px', background: '#f7f7f5', borderBottom: '0.5px solid #ddd',
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>
            請求書 — {inv.billing_month}分
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <StatusBadge status={inv.status} />
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#999', lineHeight: 1 }}
            >✕</button>
          </div>
        </div>

        {/* ── 請求書本文 ── */}
        <div style={{ padding: '24px 28px' }}>

          {/* タイトル行 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 500, letterSpacing: '0.15em', color: '#1a1a1a' }}>請　求　書</div>
              <div style={{ fontSize: 10, color: '#888', marginTop: 4 }}>登録番号: {settings.invoice_no}</div>
            </div>
            <div style={{ textAlign: 'right', fontSize: 11, color: '#555', lineHeight: 1.7 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>{settings.company_name}</div>
              <div>{settings.address}</div>
              <div>{settings.tel} | {settings.email}</div>
            </div>
          </div>

          <div style={{ borderTop: '0.5px solid #ccc', marginBottom: 16 }} />

          {/* 請求先・メタ */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 10, color: '#999', marginBottom: 3 }}>請求先</div>
              <div style={{ fontSize: 16, fontWeight: 500 }}>{settings.client_name} 御中</div>
            </div>
            <div style={{ textAlign: 'right', fontSize: 11, color: '#666', lineHeight: 1.8 }}>
              <div>件名: {inv.billing_month}分 業務委託費</div>
              <div>請求日: {today}</div>
              <div>支払期限: {due}</div>
            </div>
          </div>

          {/* ご請求金額バナー */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: '#1a1a1a', color: '#fff',
            borderRadius: 6, padding: '10px 16px', marginBottom: 20,
          }}>
            <div style={{ fontSize: 12 }}>ご請求金額（税込）</div>
            <div style={{ fontSize: 20, fontWeight: 500 }}>¥{grandTotal.toLocaleString()}</div>
          </div>

          {/* ── 業務明細 ── */}
          <div style={{ marginBottom: 16 }}>
            <div style={s.sectionTitle}>業務明細</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #ddd' }}>
                  {['対応区分', '件数', '船員', '単価（船/人）', '金額'].map((h, i) => (
                    <th key={h} style={{
                      padding: '6px 8px', fontWeight: 500, fontSize: 11, color: '#666',
                      textAlign: i === 4 ? 'right' : 'left',
                      borderBottom: '0.5px solid #ccc', paddingBottom: 6,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '0.5px solid #eee' }}>
                    <td style={{ padding: '7px 8px' }}>{r.cat}</td>
                    <td style={{ padding: '7px 8px' }}>{r.count}隻</td>
                    <td style={{ padding: '7px 8px' }}>{r.crew}名</td>
                    <td style={{ padding: '7px 8px', color: '#888' }}>¥{r.shipP.toLocaleString()} / ¥{r.crewP.toLocaleString()}</td>
                    <td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 500 }}>¥{r.line.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '0.5px solid #ddd', fontSize: 12 }}>
              {[
                ['業務小計', bizSubtotal],
                ['消費税（10%）', bizTax],
              ].map(([k, v], i) => (
                <div key={i} style={{ ...s.row, color: '#666' }}>
                  <span>{k as string}</span><span>¥{(v as number).toLocaleString()}</span>
                </div>
              ))}
              <div style={s.divider} />
              <div style={{ ...s.row, fontWeight: 600 }}>
                <span>業務請求小計</span><span>¥{bizTotal.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* ── 立替金精算 ── */}
          {expTotal > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={s.sectionTitle}>立替金精算</div>
              {[
                ['駐車場料金', parkTotal],
                ['高速料金', hwTotal],
                ['食事代', mealTotal],
                ['その他立替', othTotal],
                ...fixedExp.map((e: { label: string; amount: number }) => [e.label, e.amount]),
              ]
                .filter(([, v]) => (v as number) > 0)
                .map(([k, v], i) => (
                  <div key={i} style={{ ...s.row, color: '#555', fontSize: 12 }}>
                    <span>{k as string}</span><span>¥{(v as number).toLocaleString()}</span>
                  </div>
                ))}
              <div style={s.divider} />
              <div style={{ ...s.row, fontWeight: 600, fontSize: 12 }}>
                <span>立替金合計</span><span>¥{expTotal.toLocaleString()}</span>
              </div>
            </div>
          )}

          {/* ── 最終請求 ── */}
          <div style={{
            background: '#f7f7f5', borderRadius: 6,
            padding: '12px 16px', marginBottom: 20,
          }}>
            {[
              ['業務請求金額（税込）', bizTotal],
              ['立替金精算', expTotal],
            ].map(([k, v], i) => (
              <div key={i} style={{ ...s.row, color: '#666', fontSize: 12 }}>
                <span>{k as string}</span><span>¥{(v as number).toLocaleString()}</span>
              </div>
            ))}
            <div style={{ borderTop: '0.5px solid #ccc', marginTop: 8, paddingTop: 8 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 600 }}>
              <span>最終請求金額</span><span>¥{grandTotal.toLocaleString()}</span>
            </div>
          </div>

          {/* ── お振込先 ── */}
          <div style={{
            fontSize: 11, color: '#555', lineHeight: 1.8,
            borderTop: '0.5px solid #ddd', paddingTop: 12,
          }}>
            <div style={{ fontWeight: 600, marginBottom: 2 }}>お振込先</div>
            <div>{settings.bank}</div>
            <div>{settings.account}</div>
          </div>
        </div>

        {/* ── フッターアクション ── */}
        <div style={{
          display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '12px 20px',
          background: '#f7f7f5', borderTop: '0.5px solid #ddd',
        }}>
          <Btn onClick={onClose}>閉じる</Btn>
          {['未請求', '作成済'].includes(inv.status) && (
            <Btn
              variant="success"
              disabled={processing}
              onClick={async () => { await onSend(inv.id); onClose() }}
            >
              {processing ? '処理中...' : '📤 PDF生成・送信'}
            </Btn>
          )}
        </div>
      </div>
    </div>
  )
}

// ── ステータスバッジ ───────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    未請求:  ['#fff7e6', '#d97706'],
    作成済:  ['#f3f0ff', '#7c3aed'],
    送信済:  ['#eff6ff', '#2563eb'],
    入金待ち: ['#fef2f2', '#dc2626'],
    入金済:  ['#f0fdf4', '#16a34a'],
  }
  const [bg, color] = map[status] ?? ['#f3f4f6', '#6b7280']
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 10px', borderRadius: 999,
      fontSize: 11, fontWeight: 600,
      background: bg, color,
    }}>
      {status}
    </span>
  )
}

// ── メインページ ──────────────────────────────────────────────────
export default function Invoices({ invoices, reports, settings, onSend, onPaid, onRevert }: Props) {
  const [filter, setFilter]       = useState('')
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [processing, setProcessing] = useState<string | null>(null)

  const filtered = filter ? invoices.filter(i => i.status === filter) : invoices
  const sorted   = [...filtered].sort((a, b) => b.billing_month.localeCompare(a.billing_month))
  const previewInv = previewId ? invoices.find(i => i.id === previewId) ?? null : null

  const handleSend = async (id: string) => {
    setProcessing(id)
    const inv = invoices.find(i => i.id === id)!
    const doc = generateInvoicePDF(inv, reports, settings)
    doc.save(`invoice-${inv.billing_month}.pdf`)
    await onSend(id)
    setProcessing(null)
  }

  const handlePaid = async (id: string) => {
    setProcessing(id)
    await onPaid(id)
    setProcessing(null)
  }

  const handleRevert = async (id: string, status: string) => {
    if (!confirm(`ステータスを「${status}」に戻しますか？`)) return
    setProcessing(id)
    await onRevert(id, status)
    setProcessing(null)
  }

  // 集計サマリー
  const totalAmt   = invoices.reduce((s, i) => s + i.total, 0)
  const waitAmt    = invoices.filter(i => ['送信済', '入金待ち'].includes(i.status)).reduce((s, i) => s + i.total, 0)
  const paidAmt    = invoices.filter(i => i.status === '入金済').reduce((s, i) => s + i.total, 0)
  const unpaidCnt  = invoices.filter(i => i.status === '未請求').length

  return (
    <div style={{ padding: '20px 22px', maxWidth: 900 }}>
      <PageHeader title="請求書管理" sub="月次請求書の作成・送信・管理" />

      {/* ── サマリーカード ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 20 }}>
        {[
          { label: '請求総額',   value: `¥${totalAmt.toLocaleString()}`,  color: '#1a1a1a' },
          { label: '入金待ち',   value: `¥${waitAmt.toLocaleString()}`,   color: '#dc2626' },
          { label: '入金済',     value: `¥${paidAmt.toLocaleString()}`,   color: '#16a34a' },
          { label: '未請求件数', value: `${unpaidCnt}件`,                  color: '#d97706' },
        ].map(c => (
          <div key={c.label} style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: '12px 14px',
            boxShadow: 'var(--shadow)',
          }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 3 }}>{c.label}</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* ── フィルター ── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        <Btn size="sm" variant={filter === '' ? 'primary' : 'default'} onClick={() => setFilter('')}>すべて</Btn>
        {STATUS_ALL.map(s => (
          <Btn key={s} size="sm" variant={filter === s ? 'primary' : 'default'} onClick={() => setFilter(s)}>{s}</Btn>
        ))}
      </div>

      {/* ── 請求書一覧 ── */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', overflow: 'hidden',
        boxShadow: 'var(--shadow)',
      }}>
        {sorted.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            請求書がありません
          </div>
        ) : (
          sorted.map((inv, idx) => {
            const monthReports = reports.filter(r => r.bill_month === inv.billing_month)
            const isLast = idx === sorted.length - 1

            return (
              <div
                key={inv.id}
                style={{
                  borderBottom: isLast ? 'none' : '0.5px solid var(--border)',
                  padding: '14px 18px',
                  transition: 'background .1s',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'var(--surface2, #f9f9f9)'}
                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = ''}
              >
                {/* 上段: 請求月・ステータス・金額 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, minWidth: 70 }}>{inv.billing_month}</div>
                  <StatusBadge status={inv.status} />
                  <div style={{ marginLeft: 'auto', fontSize: 16, fontWeight: 600 }}>
                    ¥{inv.total.toLocaleString()}
                  </div>
                </div>

                {/* 中段: 内訳（インライン編集可） */}
                <div style={{
                  display: 'flex', gap: 24, fontSize: 12, color: 'var(--text-muted)',
                  marginBottom: 10, flexWrap: 'wrap',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span>業務小計</span>
                    <span style={{ color: 'var(--text)', fontWeight: 500 }}>¥{inv.subtotal.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span>消費税</span>
                    <span style={{ color: 'var(--text)' }}>¥{inv.tax.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span>立替</span>
                    <span style={{ color: 'var(--text)' }}>¥{inv.expenses.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span>件数</span>
                    <span style={{ color: 'var(--text)' }}>{monthReports.length}件</span>
                  </div>
                  {inv.paid_date && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>入金日</span>
                      <span style={{ color: 'var(--text)' }}>{inv.paid_date}</span>
                    </div>
                  )}
                </div>

                {/* 下段: アクションボタン */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <Btn size="sm" onClick={() => setPreviewId(inv.id)}>
                    👁 確認・印刷
                  </Btn>

                  {['未請求', '作成済'].includes(inv.status) && (
                    <Btn
                      size="sm"
                      variant="success"
                      disabled={processing === inv.id}
                      onClick={() => handleSend(inv.id)}
                    >
                      {processing === inv.id ? '処理中...' : '📤 PDF生成・送信'}
                    </Btn>
                  )}

                  {['送信済', '入金待ち'].includes(inv.status) && (
                    <Btn
                      size="sm"
                      variant="primary"
                      disabled={processing === inv.id}
                      onClick={() => handlePaid(inv.id)}
                    >
                      {processing === inv.id ? '処理中...' : '✓ 入金済にする'}
                    </Btn>
                  )}

                  {inv.status === '入金済' && (
                    <Btn
                      size="sm"
                      variant="ghost"
                      disabled={processing === inv.id}
                      onClick={() => handleRevert(inv.id, '送信済')}
                      style={{ fontSize: 11, color: 'var(--text-muted)', border: '1px dashed var(--border-dark)' }}
                    >
                      ↩ 送信済に戻す
                    </Btn>
                  )}

                  {['送信済', '入金待ち', '作成済'].includes(inv.status) && (
                    <Btn
                      size="sm"
                      variant="ghost"
                      disabled={processing === inv.id}
                      onClick={() => handleRevert(inv.id, '未請求')}
                      style={{ fontSize: 11, color: 'var(--text-muted)', border: '1px dashed var(--border-dark)' }}
                    >
                      ↩ 未請求に戻す
                    </Btn>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* ── 請求書プレビューモーダル ── */}
      {previewInv && (
        <InvoiceSheet
          inv={previewInv}
          reports={reports}
          settings={settings}
          onClose={() => setPreviewId(null)}
          onSend={handleSend}
          processing={processing === previewInv.id}
        />
      )}
    </div>
  )
}

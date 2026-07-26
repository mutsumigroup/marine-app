import { useState, useRef } from 'react'
import { Card, Table, Empty, Select, PageHeader } from '../components/UI'
import type { Report } from '../types'

interface Props {
  reports: Report[]
  onUpdateAmount: (id: string, amount: number) => Promise<boolean>
}

// インライン編集セル
function AmountCell({ report, onSave }: { report: Report; onSave: (id: string, amount: number) => Promise<boolean> }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(String(report.amount))
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const startEdit = () => {
    setVal(String(report.amount))
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 50)
  }

  const save = async () => {
    const num = parseInt(val) || 0
    if (num === report.amount) { setEditing(false); return }
    setSaving(true)
    await onSave(report.id, num)
    setSaving(false)
    setEditing(false)
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') save()
    if (e.key === 'Escape') setEditing(false)
  }

  if (editing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>¥</span>
        <input
          ref={inputRef}
          type="number"
          value={val}
          onChange={e => setVal(e.target.value)}
          onBlur={save}
          onKeyDown={onKey}
          disabled={saving}
          style={{
            width: 100, padding: '3px 6px', fontSize: 12,
            border: '1.5px solid var(--accent)', borderRadius: 'var(--radius)',
            background: 'var(--accent-bg)', color: 'var(--text)', outline: 'none',
          }}
        />
        {saving && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>保存中...</span>}
      </div>
    )
  }

  return (
    <div
      onClick={startEdit}
      title="クリックして編集"
      style={{
        cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '2px 6px', borderRadius: 'var(--radius)',
        border: '1px dashed transparent',
        transition: 'all .12s',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-dark)'
        ;(e.currentTarget as HTMLDivElement).style.background = 'var(--surface2)'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'transparent'
        ;(e.currentTarget as HTMLDivElement).style.background = 'transparent'
      }}
    >
      {report.amount > 0
        ? <strong style={{ color: 'var(--text)' }}>¥{report.amount.toLocaleString()}</strong>
        : <span style={{ color: 'var(--text-light)', fontSize: 11 }}>✏ 未入力</span>
      }
    </div>
  )
}

export default function ReportsList({ reports, onUpdateAmount }: Props) {
  const [filterMonth, setFilterMonth] = useState('')
  const months = [...new Set(reports.map(r => r.bill_month))].sort().reverse()
  const filtered = filterMonth ? reports.filter(r => r.bill_month === filterMonth) : reports
  const sorted = [...filtered].sort((a, b) => b.date.localeCompare(a.date))

  const totalAmount = filtered.reduce((s, r) => s + r.amount, 0)
  const zeroCount = filtered.filter(r => r.amount === 0).length

  return (
    <div style={{ padding: '20px 22px' }}>
      <PageHeader title="日報一覧" sub="Voucher右の金額セルをクリックして売上金額を入力できます">
        <Select value={filterMonth} onChange={setFilterMonth}>
          <option value="">すべての月</option>
          {months.map(m => <option key={m}>{m}</option>)}
        </Select>
      </PageHeader>

      {/* サマリー */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 12 }}>
          <span style={{ color: 'var(--text-muted)' }}>件数: </span>
          <strong>{filtered.length}件</strong>
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 12 }}>
          <span style={{ color: 'var(--text-muted)' }}>売上合計: </span>
          <strong style={{ color: 'var(--accent)' }}>¥{totalAmount.toLocaleString()}</strong>
        </div>
        {zeroCount > 0 && (
          <div style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 12, color: 'var(--warning)' }}>
            ⚠ 売上未入力: <strong>{zeroCount}件</strong>（クリックして入力してください）
          </div>
        )}
      </div>

      <Card>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent-border)', borderRadius: 4, padding: '1px 6px', fontSize: 10 }}>✏ ヒント</span>
          売上金額のセルをクリックすると直接編集できます。Enterで保存、Escでキャンセル。
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['稼働日', '港', '船名', '船員', '対応区分', '業務内容', '立替計', '請求月', 'Voucher', '売上金額 ✏'].map(h => (
                  <th key={h} style={{
                    textAlign: 'left', padding: '7px 10px', fontSize: 10, fontWeight: 600,
                    color: h === '売上金額 ✏' ? 'var(--accent)' : 'var(--text-muted)',
                    textTransform: 'uppercase', letterSpacing: '.4px',
                    borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
                    background: h === '売上金額 ✏' ? 'var(--accent-bg)' : 'transparent',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0
                ? <Empty label="日報がありません" />
                : sorted.map(r => (
                  <tr key={r.id}
                    style={{ borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'var(--surface2)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = '' }}
                  >
                    <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{r.date}</td>
                    <td style={{ padding: '8px 10px' }}>{r.port}</td>
                    <td style={{ padding: '8px 10px', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.ship}>{r.ship}</td>
                    <td style={{ padding: '8px 10px' }}>{r.crew}名</td>
                    <td style={{ padding: '8px 10px' }}>{r.category}</td>
                    <td style={{ padding: '8px 10px', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-muted)' }} title={r.work}>{r.work || '—'}</td>
                    <td style={{ padding: '8px 10px' }}>¥{r.expenses.toLocaleString()}</td>
                    <td style={{ padding: '8px 10px' }}>{r.bill_month}</td>
                    <td style={{ padding: '8px 10px', fontSize: 10, color: 'var(--text-light)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.voucher}>{r.voucher || '—'}</td>
                    <td style={{ padding: '6px 10px', background: 'var(--accent-bg)' }}>
                      <AmountCell report={r} onSave={onUpdateAmount} />
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

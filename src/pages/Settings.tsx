import { DEFAULT_DAILY_MAIL_SUBJECT, DEFAULT_DAILY_MAIL_BODY } from '../lib/email'
import { useState, useEffect } from 'react'
import { Card, CardTitle, Field, Input, Grid, Divider, Btn, PageHeader } from '../components/UI'
import { CATEGORIES } from '../types'
import type { Settings as SettingsType } from '../types'

interface Props { settings: SettingsType; onSave: (s: SettingsType) => Promise<boolean> }

export default function Settings({ settings, onSave }: Props) {
  const [f, setF] = useState<SettingsType>(settings)
  const [saving, setSaving] = useState(false)

  useEffect(() => { setF(settings) }, [settings])

  const set = (key: keyof SettingsType) => (v: string | number) =>
    setF(prev => ({ ...prev, [key]: v }))

  const setPrice = (cat: string, field: 'ship' | 'crew', val: string) =>
    setF(prev => ({
      ...prev,
      prices: { ...prev.prices, [cat]: { ...(prev.prices[cat] ?? { ship: 0, crew: 0 }), [field]: parseInt(val) || 0 } }
    }))

  // 固定費：追加
  const addFixedExpense = () =>
    setF(prev => ({
      ...prev,
      fixed_expenses: [...(prev.fixed_expenses ?? []), { label: '', amount: 0 }]
    }))

  // 固定費：ラベル変更
  const setFixedLabel = (idx: number, label: string) =>
    setF(prev => {
      const list = [...(prev.fixed_expenses ?? [])]
      list[idx] = { ...list[idx], label }
      return { ...prev, fixed_expenses: list }
    })

  // 固定費：金額変更
  const setFixedAmount = (idx: number, val: string) =>
    setF(prev => {
      const list = [...(prev.fixed_expenses ?? [])]
      list[idx] = { ...list[idx], amount: parseInt(val) || 0 }
      return { ...prev, fixed_expenses: list }
    })

  // 固定費：削除
  const removeFixedExpense = (idx: number) =>
    setF(prev => ({
      ...prev,
      fixed_expenses: (prev.fixed_expenses ?? []).filter((_, i) => i !== idx)
    }))

  const totalFixed = (f.fixed_expenses ?? []).reduce((sum, e) => sum + (e.amount || 0), 0)

  const handleSave = async () => {
    setSaving(true)
    await onSave(f)
    setSaving(false)
  }

  return (
    <div style={{ padding: '20px 22px' }}>
      <PageHeader title="設定" sub="変更はSupabaseへ保存されます" />

      <Card>
        <CardTitle>🏢 自社情報（請求書に表示）</CardTitle>
        <Grid cols={2} style={{ marginBottom: 10 }}>
          <Field label="会社名"><Input value={f.company_name} onChange={set('company_name')} /></Field>
          <Field label="住所"><Input value={f.address} onChange={set('address')} /></Field>
        </Grid>
        <Grid cols={2} style={{ marginBottom: 10 }}>
          <Field label="電話番号"><Input value={f.tel} onChange={set('tel')} /></Field>
          <Field label="メールアドレス"><Input type="email" value={f.email} onChange={set('email')} /></Field>
        </Grid>
        <Grid cols={2}>
          <Field label="インボイス登録番号"><Input value={f.invoice_no} onChange={set('invoice_no')} placeholder="T1234567890123" /></Field>
          <Field label="支払期限（請求日から何日後）"><Input type="number" value={f.pay_days} onChange={v => set('pay_days')(parseInt(v) || 30)} /></Field>
        </Grid>
        <Divider />
        <Grid cols={2}>
          <Field label="振込先銀行・支店"><Input value={f.bank} onChange={set('bank')} /></Field>
          <Field label="口座番号・名義"><Input value={f.account} onChange={set('account')} /></Field>
        </Grid>
      </Card>

      <Card>
        <CardTitle>🏷 取引先（1社）</CardTitle>
        <Grid cols={3}>
          <Field label="取引先名"><Input value={f.client_name} onChange={set('client_name')} /></Field>
          <Field label="メールアドレス"><Input type="email" value={f.client_email} onChange={set('client_email')} /></Field>
          <Field label="年間目標額（円）">
            <Input type="number" value={f.client_annual_goal} onChange={v => set('client_annual_goal')(parseInt(v) || 0)} />
          </Field>
        </Grid>
      </Card>

      <Card>
        <CardTitle>💴 対応区分 単価設定</CardTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {CATEGORIES.map(cat => (
            <div key={cat} style={{ background: 'var(--surface2)', padding: 10, borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 8, color: 'var(--navy)' }}>{cat}</div>
              <Grid cols={2}>
                <Field label="船単価（円）">
                  <Input type="number" value={f.prices[cat]?.ship ?? 10000} onChange={v => setPrice(cat, 'ship', v)} />
                </Field>
                <Field label="船員単価（円）">
                  <Input type="number" value={f.prices[cat]?.crew ?? 1000} onChange={v => setPrice(cat, 'crew', v)} />
                </Field>
              </Grid>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardTitle>📧 メール設定</CardTitle>
        <Grid cols={2}>
          <Field label="日報送信先メール"><Input type="email" value={f.daily_mail} onChange={set('daily_mail')} /></Field>
          <Field label="請求書送信先メール"><Input type="email" value={f.inv_mail} onChange={set('inv_mail')} /></Field>
        </Grid>
      </Card>

      <Card>
        <CardTitle>🏠 毎月固定費（請求書に自動追加）</CardTitle>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
          毎月変わらない固定の立替金精算を設定します。請求書に自動で含まれます。
        </div>

        {(f.fixed_expenses ?? []).map((expense, idx) => (
          <div key={idx} style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr auto',
            gap: 10,
            alignItems: 'flex-end',
            marginBottom: 10,
            background: 'var(--surface2)',
            padding: 12,
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)'
          }}>
            <Field label="項目名">
              <Input
                value={expense.label}
                onChange={v => setFixedLabel(idx, v as string)}
                placeholder="例: 自宅駐車場、通信費など"
              />
            </Field>
            <Field label="月額（円）">
              <Input
                type="number"
                value={expense.amount}
                onChange={v => setFixedAmount(idx, v as string)}
              />
            </Field>
            <button
              onClick={() => removeFixedExpense(idx)}
              style={{
                background: 'none',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '6px 10px',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                fontSize: 16,
                marginBottom: 2,
              }}
              title="削除"
            >
              🗑
            </button>
          </div>
        ))}

        <button
          onClick={addFixedExpense}
          style={{
            width: '100%',
            padding: '10px',
            border: '2px dashed var(--border)',
            borderRadius: 'var(--radius)',
            background: 'none',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            fontSize: 13,
            marginBottom: 12,
          }}
        >
          ＋ 固定費を追加
        </button>

        {(f.fixed_expenses ?? []).length > 0 && (
          <div style={{ padding: '10px 14px', background: 'var(--accent-bg)', borderRadius: 'var(--radius)', border: '1px solid var(--accent-border)', fontSize: 12, color: 'var(--accent)' }}>
            合計: ¥{totalFixed.toLocaleString()} / 月
          </div>
        )}
      </Card>


      <Card>
        <CardTitle>✉️ 日報メールテンプレート</CardTitle>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.7 }}>
          日報送信時のメール内容をカスタマイズできます。未入力の場合はデフォルト文面が使われます。<br />
          使える変数：{' '}
          {['{{date}}稼働日','{{ship}}船名','{{port}}港名','{{crew}}人数','{{category}}区分','{{work}}業務内容','{{amount}}売上','{{park_fee}}駐車場','{{hw_fee}}高速料金','{{meal}}食事代','{{expenses}}立替合計','{{bill_month}}請求月','{{link}}共有リンク'].map(v => (
            <span key={v} style={{ display:'inline-block', margin:'2px 4px 2px 0', background:'var(--accent-bg)', border:'1px solid var(--accent-border)', borderRadius:4, padding:'1px 6px', fontSize:11, fontFamily:'monospace', color:'var(--accent)' }}>{v}</span>
          ))}
        </div>
        <Grid cols={1} style={{ marginBottom: 10 }}>
          <Field label="件名">
            <Input value={f.mail_subject ?? ''} onChange={set('mail_subject')} placeholder={DEFAULT_DAILY_MAIL_SUBJECT} />
          </Field>
        </Grid>
        <Grid cols={1} style={{ marginBottom: 10 }}>
          <Field label="共有リンク（{{link}} に挿入されるURL）">
            <Input value={f.mail_link ?? ''} onChange={set('mail_link')} placeholder="https://（相手に確認してほしいページのURL）" />
          </Field>
        </Grid>
        <Field label="本文">
          <textarea
            value={f.mail_body ?? ''}
            onChange={e => set('mail_body')(e.target.value)}
            placeholder={DEFAULT_DAILY_MAIL_BODY}
            rows={16}
            style={{ width:'100%', padding:'8px 10px', border:'1px solid var(--border-dark)', borderRadius:'var(--radius)', background:'var(--surface)', color:'var(--text)', fontSize:12, fontFamily:'monospace', resize:'vertical', lineHeight:1.7, boxSizing:'border-box' }}
          />
        </Field>
      </Card>
      <div style={{ textAlign: 'right', marginTop: 4 }}>
        <Btn variant="success" onClick={handleSave} disabled={saving}>
          {saving ? '保存中...' : '✓ 設定を保存（Supabase）'}
        </Btn>
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { Card, CardTitle, Field, Input, Grid, Divider, Btn, PageHeader } from '../components/UI'
import { CATEGORIES } from '../types'
import type { Settings as SettingsType } from '../types'
import { DEFAULT_DAILY_TEMPLATE, DEFAULT_INVOICE_TEMPLATE } from '../lib/email'

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
        <Divider />
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)' }}>📝 日報メール文面テンプレート</div>
            <button onClick={() => setF(prev => ({ ...prev, daily_report_template: DEFAULT_DAILY_TEMPLATE }))}
              style={{ fontSize: 11, padding: '3px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              デフォルトに戻す
            </button>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.7, background: 'var(--surface2)', padding: '8px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            使えるプレースホルダー：<code>{'{date}'}</code> 日付 / <code>{'{port}'}</code> 港名 / <code>{'{ship}'}</code> 船名 / <code>{'{crew}'}</code> 人数 / <code>{'{category}'}</code> 区分 / <code>{'{work}'}</code> 業務内容 / <code>{'{bill_month}'}</code> 請求月 / <code>{'{amount}'}</code> 売上 / <code>{'{park_fee}'}</code> 駐車場 / <code>{'{hw_fee}'}</code> 高速 / <code>{'{meal}'}</code> 食事 / <code>{'{hotel_fee}'}</code> ホテル / <code>{'{shinkansen_fee}'}</code> 新幹線 / <code>{'{expenses}'}</code> 立替合計 / <code>{'{notes_line}'}</code> 備考行 / <code>{'{annual_url}'}</code> 日報URL
          </div>
          <textarea
            value={f.daily_report_template ?? DEFAULT_DAILY_TEMPLATE}
            onChange={e => setF(prev => ({ ...prev, daily_report_template: e.target.value }))}
            style={{ width: '100%', minHeight: 280, padding: '10px 12px', fontSize: 12, fontFamily: 'monospace', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text)', resize: 'vertical', lineHeight: 1.7, boxSizing: 'border-box' }}
          />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)' }}>📝 請求書メール文面テンプレート</div>
            <button onClick={() => setF(prev => ({ ...prev, invoice_template: DEFAULT_INVOICE_TEMPLATE }))}
              style={{ fontSize: 11, padding: '3px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              デフォルトに戻す
            </button>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.7, background: 'var(--surface2)', padding: '8px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            使えるプレースホルダー：<code>{'{client_name}'}</code> 取引先名 / <code>{'{billing_month}'}</code> 請求月 / <code>{'{invoice_id}'}</code> 請求書番号 / <code>{'{subtotal}'}</code> 税抜金額 / <code>{'{tax}'}</code> 消費税 / <code>{'{expenses}'}</code> 立替金 / <code>{'{total}'}</code> 合計 / <code>{'{invoice_url}'}</code> 請求書URL
          </div>
          <textarea
            value={f.invoice_template ?? DEFAULT_INVOICE_TEMPLATE}
            onChange={e => setF(prev => ({ ...prev, invoice_template: e.target.value }))}
            style={{ width: '100%', minHeight: 240, padding: '10px 12px', fontSize: 12, fontFamily: 'monospace', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text)', resize: 'vertical', lineHeight: 1.7, boxSizing: 'border-box' }}
          />
        </div>
      </Card>

      <Card>
        <CardTitle>💬 Google Chat通知設定（KY出発前報告）</CardTitle>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.6 }}>
          KY出発前報告の送信後にGoogle Chatへ自動通知します。<br />
          Google Chat のスペースで「Webhook URL」を取得して貼り付けてください。
        </div>
        <Field label="Google Chat Webhook URL">
          <Input
            value={f.gchat_webhook ?? ''}
            onChange={set('gchat_webhook')}
            placeholder="https://chat.googleapis.com/v1/spaces/..."
          />
        </Field>
        {f.gchat_webhook && (
          <div style={{ marginTop: 8, fontSize: 11, color: '#15803D', background: '#D1FAE5', borderRadius: 6, padding: '6px 10px' }}>
            ✅ Webhook URLが設定されています。KY報告送信時にGoogle Chatへ通知されます。
          </div>
        )}
        {!f.gchat_webhook && (
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)', background: 'var(--surface2)', borderRadius: 6, padding: '6px 10px' }}>
            ℹ️ URLを設定するまでGoogle Chat通知はスキップされます。
          </div>
        )}
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

      <div style={{ textAlign: 'right', marginTop: 4 }}>
        <Btn variant="success" onClick={handleSave} disabled={saving}>
          {saving ? '保存中...' : '✓ 設定を保存（Supabase）'}
        </Btn>
      </div>
    </div>
  )
}

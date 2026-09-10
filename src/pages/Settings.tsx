import { useState, useEffect } from 'react'
import { Card, CardTitle, Field, Input, Grid, Divider, Btn, PageHeader } from '../components/UI'
import { CATEGORIES } from '../types'
import type { Settings as SettingsType } from '../types'
import { supabase } from '../lib/supabase'
import { FARE_TABLE } from '../lib/fareTable'

interface Props { settings: SettingsType; onSave: (s: SettingsType) => Promise<boolean> }

// 送迎エリア管理の型
interface TransportArea {
  from: string
  to: string
  fare: number
}

export default function Settings({ settings, onSave }: Props) {
  const [f, setF] = useState<SettingsType>(settings)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'general' | 'transport'>('general')

  // 送迎エリア管理
  const [areas, setAreas] = useState<TransportArea[]>([])
  const [savingAreas, setSavingAreas] = useState(false)
  const [areaMsg, setAreaMsg] = useState('')

  useEffect(() => { setF(settings) }, [settings])

  // 料金テーブルをareas形式に変換して初期ロード
  useEffect(() => {
    const loadAreas = async () => {
      const { data } = await supabase
        .from('transport_fare_settings')
        .select('*')
        .order('from_area')
      if (data && data.length > 0) {
        setAreas(data.map((d: any) => ({ from: d.from_area, to: d.to_area, fare: d.fare })))
      } else {
        // 初回：fareTable.tsのデータをデフォルトとして展開
        const defaults: TransportArea[] = []
        Object.entries(FARE_TABLE).forEach(([from, tos]) => {
          Object.entries(tos).forEach(([to, fare]) => {
            defaults.push({ from, to, fare })
          })
        })
        setAreas(defaults)
      }
    }
    loadAreas()
  }, [])

  const set = (key: keyof SettingsType) => (v: string | number) =>
    setF(prev => ({ ...prev, [key]: v }))

  const setPrice = (cat: string, field: 'ship' | 'crew', val: string) =>
    setF(prev => ({
      ...prev,
      prices: { ...prev.prices, [cat]: { ...(prev.prices[cat] ?? { ship: 0, crew: 0 }), [field]: parseInt(val) || 0 } }
    }))

  const addFixedExpense = () =>
    setF(prev => ({ ...prev, fixed_expenses: [...(prev.fixed_expenses ?? []), { label: '', amount: 0 }] }))
  const setFixedLabel = (idx: number, label: string) =>
    setF(prev => { const list = [...(prev.fixed_expenses ?? [])]; list[idx] = { ...list[idx], label }; return { ...prev, fixed_expenses: list } })
  const setFixedAmount = (idx: number, val: string) =>
    setF(prev => { const list = [...(prev.fixed_expenses ?? [])]; list[idx] = { ...list[idx], amount: parseInt(val) || 0 }; return { ...prev, fixed_expenses: list } })
  const removeFixedExpense = (idx: number) =>
    setF(prev => ({ ...prev, fixed_expenses: (prev.fixed_expenses ?? []).filter((_, i) => i !== idx) }))
  const totalFixed = (f.fixed_expenses ?? []).reduce((sum, e) => sum + (e.amount || 0), 0)

  const handleSave = async () => {
    setSaving(true)
    await onSave(f)
    setSaving(false)
  }

  // 送迎エリアの操作
  const addArea = () => setAreas(prev => [...prev, { from: '', to: '', fare: 0 }])
  const updateArea = (idx: number, field: keyof TransportArea, val: string | number) =>
    setAreas(prev => { const list = [...prev]; list[idx] = { ...list[idx], [field]: field === 'fare' ? (parseInt(val as string) || 0) : val }; return list })
  const removeArea = (idx: number) => setAreas(prev => prev.filter((_, i) => i !== idx))

  const saveAreas = async () => {
    setSavingAreas(true)
    setAreaMsg('')
    try {
      // 全削除して再挿入
      await supabase.from('transport_fare_settings').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      const inserts = areas.filter(a => a.from && a.to).map(a => ({
        from_area: a.from, to_area: a.to, fare: a.fare
      }))
      if (inserts.length > 0) {
        const { error } = await supabase.from('transport_fare_settings').insert(inserts)
        if (error) throw error
      }
      setAreaMsg('success')
    } catch {
      setAreaMsg('error')
    }
    setSavingAreas(false)
  }

  // 出発地一覧（ユニーク）
  const fromList = [...new Set(areas.map(a => a.from))].filter(Boolean).sort()

  return (
    <div style={{ padding: '20px 22px' }}>
      <PageHeader title="設定" sub="変更はSupabaseへ保存されます" />

      {/* タブ */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        {([['general', '⚙️ 一般設定'], ['transport', '🚗 送迎エリア管理']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)}
            style={{ padding: '10px 20px', fontSize: 13, fontWeight: activeTab === key ? 600 : 400, color: activeTab === key ? 'var(--text)' : 'var(--text-muted)', background: 'none', border: 'none', borderBottom: activeTab === key ? '2px solid var(--navy)' : '2px solid transparent', cursor: 'pointer', marginBottom: -1 }}>
            {label}
          </button>
        ))}
      </div>

      {/* 一般設定タブ */}
      {activeTab === 'general' && <>
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
          <CardTitle>💬 Google Chat通知設定（KY出発前報告）</CardTitle>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.6 }}>
            KY出発前報告の送信後にGoogle Chatへ自動通知します。<br />
            Google Chat のスペースで「Webhook URL」を取得して貼り付けてください。
          </div>
          <Field label="Google Chat Webhook URL">
            <Input value={f.gchat_webhook ?? ''} onChange={set('gchat_webhook')} placeholder="https://chat.googleapis.com/v1/spaces/..." />
          </Field>
          {f.gchat_webhook ? (
            <div style={{ marginTop: 8, fontSize: 11, color: '#15803D', background: '#D1FAE5', borderRadius: 6, padding: '6px 10px' }}>✅ Webhook URLが設定されています。</div>
          ) : (
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)', background: 'var(--surface2)', borderRadius: 6, padding: '6px 10px' }}>ℹ️ URLを設定するまでGoogle Chat通知はスキップされます。</div>
          )}
        </Card>

        <Card>
          <CardTitle>🏠 毎月固定費（請求書に自動追加）</CardTitle>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>毎月変わらない固定の立替金精算を設定します。請求書に自動で含まれます。</div>
          {(f.fixed_expenses ?? []).map((expense, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, alignItems: 'flex-end', marginBottom: 10, background: 'var(--surface2)', padding: 12, borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
              <Field label="項目名"><Input value={expense.label} onChange={v => setFixedLabel(idx, v as string)} placeholder="例: 自宅駐車場、通信費など" /></Field>
              <Field label="月額（円）"><Input type="number" value={expense.amount} onChange={v => setFixedAmount(idx, v as string)} /></Field>
              <button onClick={() => removeFixedExpense(idx)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '6px 10px', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16, marginBottom: 2 }} title="削除">🗑</button>
            </div>
          ))}
          <button onClick={addFixedExpense} style={{ width: '100%', padding: '10px', border: '2px dashed var(--border)', borderRadius: 'var(--radius)', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, marginBottom: 12 }}>＋ 固定費を追加</button>
          {(f.fixed_expenses ?? []).length > 0 && (
            <div style={{ padding: '10px 14px', background: 'var(--accent-bg)', borderRadius: 'var(--radius)', border: '1px solid var(--accent-border)', fontSize: 12, color: 'var(--accent)' }}>合計: ¥{totalFixed.toLocaleString()} / 月</div>
          )}
        </Card>

        <div style={{ textAlign: 'right', marginTop: 4 }}>
          <Btn variant="success" onClick={handleSave} disabled={saving}>{saving ? '保存中...' : '✓ 設定を保存（Supabase）'}</Btn>
        </div>
      </>}

      {/* 送迎エリア管理タブ */}
      {activeTab === 'transport' && <>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <CardTitle>🚗 送迎エリア・料金管理</CardTitle>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                出発エリア・到着エリア・旅客運送報酬を設定します。送迎日報作成のプルダウンに反映されます。
              </div>
            </div>
            <Btn onClick={addArea}>＋ エリアを追加</Btn>
          </div>

          {/* 出発地でグループ表示 */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--surface2)' }}>
                  <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border)', width: '30%' }}>出発エリア</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border)', width: '30%' }}>到着エリア</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border)', width: '25%' }}>旅客運送報酬（円）</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border)', width: '15%' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {areas.map((area, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'var(--surface2)'}
                    onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = ''}>
                    <td style={{ padding: '6px 8px' }}>
                      <input
                        value={area.from}
                        onChange={e => updateArea(idx, 'from', e.target.value)}
                        placeholder="例: 羽田空港"
                        style={{ width: '100%', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 12, background: 'var(--surface)', color: 'var(--text)' }}
                        list="from-list"
                      />
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <input
                        value={area.to}
                        onChange={e => updateArea(idx, 'to', e.target.value)}
                        placeholder="例: 横浜港"
                        style={{ width: '100%', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 12, background: 'var(--surface)', color: 'var(--text)' }}
                      />
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <input
                        type="number"
                        value={area.fare}
                        onChange={e => updateArea(idx, 'fare', e.target.value)}
                        style={{ width: '100%', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 12, textAlign: 'right', background: 'var(--surface)', color: 'var(--text)' }}
                      />
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                      <button onClick={() => removeArea(idx)}
                        style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '4px 8px', cursor: 'pointer', color: 'var(--danger)', fontSize: 13 }}>
                        🗑
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* 出発地サジェスト */}
            <datalist id="from-list">
              {fromList.map(f => <option key={f} value={f} />)}
            </datalist>
          </div>

          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {areas.length}件のエリア設定
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {areaMsg === 'success' && <span style={{ fontSize: 12, color: 'var(--success)' }}>✅ 保存しました</span>}
              {areaMsg === 'error' && <span style={{ fontSize: 12, color: 'var(--danger)' }}>❌ 保存に失敗しました</span>}
              <Btn variant="success" onClick={saveAreas} disabled={savingAreas}>
                {savingAreas ? '保存中...' : '✓ エリア設定を保存'}
              </Btn>
            </div>
          </div>
        </Card>

        <div style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 12, color: 'var(--warning)' }}>
          ⚠️ 保存後、送迎日報作成画面の出発・到着エリアのプルダウンに反映されます。記載のない区間は「都度協議」となります。
        </div>
      </>}
    </div>
  )
}

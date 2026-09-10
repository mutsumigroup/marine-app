import { useState, useCallback } from 'react'
import { Card, CardTitle, Field, Input, Select, Btn, PageHeader } from '../components/UI'
import { FARE_TABLE, FROM_AREAS, getToAreas, getFare, TENKO_OPTIONS } from '../lib/fareTable'
import type { TransportReport } from '../types/transport'
import { supabase } from '../lib/supabase'
import { sendEmail } from '../lib/email'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface Props {
  settings: any
  onSuccess?: () => void
}

const today = () => new Date().toISOString().slice(0, 10)
const thisMonth = () => new Date().toISOString().slice(0, 7)

const EMPTY = {
  date: today(),
  fromArea: '',
  toArea: '',
  tenkoIdx: 0,
  toll: '',
  passengers: '—（点呼のみ）',
  notes: '',
  billMonth: thisMonth(),
}

export default function TransportForm({ settings, onSuccess }: Props) {
  const [f, setF] = useState(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const set = (key: keyof typeof EMPTY) => (v: string | number) =>
    setF(prev => ({ ...prev, [key]: v }))

  // 出発エリア変更時 → 到着エリアをリセット
  const handleFromChange = (v: string) => {
    setF(prev => ({ ...prev, fromArea: v, toArea: '' }))
  }

  const toAreas = getToAreas(f.fromArea)
  const fare = getFare(f.fromArea, f.toArea)
  const tenkoOpt = TENKO_OPTIONS[f.tenkoIdx]
  const tenkoFee = tenkoOpt?.value ?? 0
  const tollFee = parseInt(f.toll) || 0
  const total = (fare ?? 0) + tenkoFee

  // バリデーション: 点呼のみ or エリア選択済み
  const canSubmit = (f.fromArea && f.toArea) || tenkoFee > 0

  const handleSubmit = useCallback(async () => {
    setError('')
    if (!canSubmit) {
      setError('出発・到着エリアを選択するか、点呼手当を選択してください。')
      return
    }
    setSubmitting(true)
    try {
      const record: Omit<TransportReport, 'id' | 'created_at' | 'updated_at'> = {
        date: f.date,
        from_area: f.fromArea,
        to_area: f.toArea,
        fare: fare ?? 0,
        tenko_label: tenkoOpt?.label ?? 'なし',
        tenko_fee: tenkoFee,
        toll_fee: tollFee,
        passengers: f.passengers,
        notes: f.notes,
        total,
        bill_month: f.billMonth,
        sent: false,
      }

      // Supabaseへ保存
      const { error: dbErr } = await supabase
        .from('transport_reports')
        .insert([record])
      if (dbErr) throw new Error(dbErr.message)

      // メール送信
      if (settings.daily_mail) {
        const lines = [
          '【送迎日報】',
          `稼働日：${f.date}`,
          f.fromArea && f.toArea
            ? `ルート：${f.fromArea} → ${f.toArea}`
            : '運行：点呼のみ',
          f.fromArea && f.toArea
            ? `旅客運送報酬：¥${(fare ?? 0).toLocaleString()}`
            : '',
          `点呼手当：${tenkoOpt?.label ?? 'なし'}${tenkoFee > 0 ? `（¥${tenkoFee.toLocaleString()}）` : ''}`,
          `高速代等（立替）：¥${tollFee.toLocaleString()} ※別途実費精算`,
          `合計手当：¥${total.toLocaleString()}`,
          f.notes ? `備考：${f.notes}` : '',
        ].filter(Boolean).join('\n')

        await sendEmail({
          to_email: settings.daily_mail,
          subject: `【送迎日報】${f.date}${f.fromArea && f.toArea ? ` ${f.fromArea}→${f.toArea}` : ' 点呼のみ'}`,
          message: lines,
        }).catch(() => {/* メール失敗は無視してDB保存を優先 */})
      }

      setSuccess(true)
      setF({ ...EMPTY, date: today(), billMonth: thisMonth() })
      if (onSuccess) onSuccess()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }, [f, fare, tenkoFee, tollFee, total, canSubmit, tenkoOpt, settings, onSuccess])

  return (
    <div style={{ padding: '20px 22px' }}>
      <PageHeader title="送迎日報作成" sub="二種免許を使用した送迎業務の日報（旅客運送手当表に基づく自動計算）" />

      {error && (
        <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger-border)', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 14, fontSize: 12 }}>
          ⚠ {error}
        </div>
      )}
      {success && (
        <div style={{ background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success)', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 14, fontSize: 12 }}>
          ✅ 送迎日報を保存しました。
        </div>
      )}

      {/* 基本情報 */}
      <Card>
        <CardTitle>🚗 基本情報</CardTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <Field label="稼働日" required>
            <Input type="date" value={f.date} onChange={set('date')} />
          </Field>
          <Field label="乗客人数">
            <Select value={f.passengers} onChange={set('passengers')}>
              <option value="—（点呼のみ）">—（点呼のみ）</option>
              <option value="1名">1名</option>
              <option value="2名">2名</option>
              <option value="3名">3名</option>
              <option value="4名">4名</option>
              <option value="5名以上">5名以上</option>
            </Select>
          </Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="出発エリア（点呼のみの場合は選択不要）">
            <Select value={f.fromArea} onChange={handleFromChange}>
              <option value="">-- 選択してください --</option>
              {FROM_AREAS.map(a => <option key={a} value={a}>{a}</option>)}
            </Select>
          </Field>
          <Field label="到着エリア（点呼のみの場合は選択不要）">
            <select value={f.toArea} onChange={e => set('toArea')(e.target.value)} disabled={!f.fromArea} style={{ padding: '8px 10px', border: '1px solid var(--border-dark)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, width: '100%', opacity: !f.fromArea ? 0.5 : 1 }}>
              <option value="">-- {f.fromArea ? '選択してください' : '出発エリアを先に選択'} --</option>
              {toAreas.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </Field>
        </div>
      </Card>

      {/* 旅客運送手当 自動表示 */}
      <div style={{
        border: `1px solid ${fare !== null ? 'var(--success)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-lg)',
        padding: '14px 18px',
        marginBottom: 14,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: fare !== null ? 'var(--success-bg)' : 'var(--surface2)',
        transition: 'all 0.2s',
      }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>旅客運送報酬（自動計算）</div>
          <div style={{ fontSize: 13, color: fare !== null ? 'var(--success)' : 'var(--text-muted)' }}>
            {f.fromArea && f.toArea
              ? `${f.fromArea}  →  ${f.toArea}`
              : '出発・到着エリアを選択してください（点呼のみの場合は不要）'}
          </div>
        </div>
        <div style={{ fontSize: 26, fontWeight: 700, color: fare !== null ? 'var(--success)' : 'var(--text-muted)' }}>
          {fare !== null ? `¥${fare.toLocaleString()}` : '¥ —'}
        </div>
      </div>

      {/* 追加費用 */}
      <Card>
        <CardTitle>追加費用・点呼手当</CardTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <Field label="点呼手当（点呼のみ）">
            <Select value={String(f.tenkoIdx)} onChange={v => set('tenkoIdx')(parseInt(v))}>
              {TENKO_OPTIONS.map((opt, i) => (
                <option key={i} value={i}>
                  {opt.label}{opt.value > 0 ? ` ¥${opt.value.toLocaleString()}` : ''}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="高速代・駐車場（立替 ／ 別途実費精算）">
            <Input type="number" value={f.toll} onChange={set('toll')} placeholder="0" min="0" />
          </Field>
        </div>
        <Field label="備考">
          <Input value={f.notes} onChange={set('notes')} placeholder="特記事項があれば入力" />
        </Field>

        {/* 合計 */}
        <div style={{ background: 'var(--surface2)', borderRadius: 'var(--radius)', padding: '10px 14px', marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>合計手当</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              {[
                fare !== null && fare > 0 ? `旅客運送手当 ¥${fare.toLocaleString()}` : null,
                tenkoFee > 0 ? `点呼手当 ¥${tenkoFee.toLocaleString()}` : null,
              ].filter(Boolean).join(' ＋ ') || '—'}
            </div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)' }}>
            ¥{total.toLocaleString()}
          </div>
        </div>

        {/* 送信内容プレビュー */}
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>📄 送信内容プレビュー</div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px 12px', fontSize: 12, color: 'var(--text)', lineHeight: 1.9 }}>
            稼働日：{f.date}<br />
            {f.fromArea && f.toArea
              ? <><span>出発エリア：{f.fromArea}</span><br /><span>到着エリア：{f.toArea}</span><br /><span>旅客運送報酬：{fare !== null ? `¥${fare.toLocaleString()}` : '別途協議'}</span><br /></>
              : <><span>運行：点呼のみ</span><br /></>
            }
            点呼手当：{tenkoOpt?.label ?? 'なし'}{tenkoFee > 0 ? `（¥${tenkoFee.toLocaleString()}）` : ''}<br />
            高速代等（立替）：¥{tollFee.toLocaleString()} ※別途実費精算
            {f.notes && <><br />備考：{f.notes}</>}
          </div>
        </div>

        <div style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', borderRadius: 'var(--radius)', padding: '8px 12px', marginTop: 10, fontSize: 12, color: 'var(--warning)' }}>
          ⚠️ 高速道路料金・駐車料金等は別途実費精算。記載のない区間は都度協議。
        </div>
      </Card>

      <Field label="請求対象月">
        <Input type="month" value={f.billMonth} onChange={set('billMonth')} />
      </Field>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
        <Btn onClick={() => { setF({ ...EMPTY, date: today(), billMonth: thisMonth() }); setError(''); setSuccess(false) }}>↺ クリア</Btn>
        <Btn variant="primary" onClick={handleSubmit} disabled={submitting || !canSubmit}>
          {submitting ? '送信中...' : '📨 日報送信'}
        </Btn>
      </div>
    </div>
  )
}

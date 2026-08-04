import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardTitle, Field, Input, Select, Btn, PageHeader, useIsMobile } from '../components/UI'
import { CATEGORIES } from '../types'
import type { KyReport, PortMaster } from '../types'

interface Props {
  onSubmit: (data: Omit<KyReport, 'id' | 'created_at' | 'updated_at'>) => Promise<KyReport | null>
  portMasters: PortMaster[]
  pastReports?: { port: string; ship: string }[]
  operatorName?: string
}

const DRAFT_KEY = 'ky_draft'

export default function KyForm({ onSubmit, portMasters, pastReports = [], operatorName = '' }: Props) {
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  const today = new Date().toISOString().slice(0, 10)

  const [f, setF] = useState({
    date: today,
    port: '',
    ship: '',
    crew: 1,
    category: CATEGORIES[0] as string,
    work: '',
    operator_name: operatorName,
  })
  const [notesConfirmed, setNotesConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // 港マスターから該当港の情報を取得
  const portMaster = portMasters.find(p => p.name === f.port)

  // 下書き復元
  useEffect(() => {
    const draft = localStorage.getItem(DRAFT_KEY)
    if (draft) {
      try { setF(prev => ({ ...prev, ...JSON.parse(draft) })) } catch { /* ignore */ }
    }
  }, [])

  // 下書き自動保存
  useEffect(() => {
    if (!submitted) localStorage.setItem(DRAFT_KEY, JSON.stringify(f))
  }, [f, submitted])

  // 港変更時に確認チェックをリセット
  useEffect(() => { setNotesConfirmed(false) }, [f.port])

  const set = (key: keyof typeof f) => (v: string | number) =>
    setF(prev => ({ ...prev, [key]: v }))

  const shipSuggestions = [...new Set(pastReports.map(r => r.ship))].filter(Boolean)
  const portSuggestions = [
    ...new Set([
      ...portMasters.map(p => p.name),
      ...pastReports.map(r => r.port),
    ])
  ].filter(Boolean)

  const canSubmit = f.date && f.port && f.ship && f.crew > 0 && f.category && f.work && f.operator_name &&
    (!portMaster || notesConfirmed)

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    const result = await onSubmit({
      date: f.date,
      port: f.port,
      ship: f.ship,
      crew: Number(f.crew),
      category: f.category,
      work: f.work,
      operator_name: f.operator_name,
      notes_confirmed: notesConfirmed,
      port_notes_snapshot: portMaster?.notes ?? '',
      submitted_at: new Date().toLocaleString('ja-JP'),
    })
    setSubmitting(false)
    if (result) {
      setSubmitted(true)
      localStorage.removeItem(DRAFT_KEY)
      // 日報作成に自動連携データを渡してリダイレクト
      const ky = { date: f.date, port: f.port, ship: f.ship, crew: f.crew, category: f.category, work: f.work, ky_id: result.id }
      sessionStorage.setItem('ky_prefill', JSON.stringify(ky))
      setTimeout(() => navigate('/daily'), 1500)
    }
  }

  const inputSt: React.CSSProperties = {
    width: '100%', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
    padding: isMobile ? '12px 14px' : '8px 10px', fontSize: isMobile ? 16 : 13,
    background: 'var(--surface)', color: 'var(--text)', outline: 'none', boxSizing: 'border-box',
  }

  if (submitted) {
    return (
      <div style={{ padding: isMobile ? '20px 16px' : '32px 24px', maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>KY出発前報告を送信しました</div>
        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>日報作成画面に移動します...</div>
      </div>
    )
  }

  return (
    <div style={{ padding: isMobile ? '16px' : '24px 32px', maxWidth: 680, margin: '0 auto' }}>
      <PageHeader title="🚦 KY出発前報告" sub="出発前に安全確認を行い、内容を送信してください" />

      <Card style={{ marginBottom: 16 }}>
        <CardTitle>基本情報</CardTitle>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
          <Field label="担当者名 *">
            <input style={inputSt} value={f.operator_name} onChange={e => set('operator_name')(e.target.value)} placeholder="氏名を入力" />
          </Field>
          <Field label="稼働日 *">
            <input type="date" style={inputSt} value={f.date} onChange={e => set('date')(e.target.value)} />
          </Field>
          <Field label="港名 *">
            <select style={inputSt} value={f.port} onChange={e => set('port')(e.target.value)}>
              <option value="">港を選択</option>
              {portSuggestions.map(p => <option key={p} value={p}>{p}</option>)}
              <option value="__other__">その他（直接入力）</option>
            </select>
          </Field>
          {(f.port === '__other__' || (f.port && !portSuggestions.includes(f.port))) && (
            <Field label="港名（直接入力）">
              <input style={inputSt} value={f.port === '__other__' ? '' : f.port} onChange={e => set('port')(e.target.value)} placeholder="港名を入力" />
            </Field>
          )}
          <Field label="船名 *">
            <select style={inputSt} value={f.ship} onChange={e => set('ship')(e.target.value)}>
              <option value="">船を選択</option>
              {shipSuggestions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="船員人数 *">
            <input type="number" style={inputSt} value={f.crew} min={1} onChange={e => set('crew')(parseInt(e.target.value) || 1)} />
          </Field>
          <Field label="対応区分 *">
            <Select value={f.category} onChange={set('category')}>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</Select>
          </Field>
        </div>
        <Field label="業務内容 *">
          <textarea
            style={{ ...inputSt, minHeight: 80, resize: 'vertical' }}
            value={f.work}
            onChange={e => set('work')(e.target.value)}
            placeholder="業務内容を入力してください"
          />
        </Field>
      </Card>

      {/* 港の注意事項 */}
      {portMaster && (
        <Card style={{ marginBottom: 16, border: '1.5px solid #F59E0B', background: '#FFFBEB' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 20 }}>⚠️</span>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#92400E' }}>
              {f.port} の注意事項
            </div>
          </div>
          {portMaster.notes && (
            <div style={{ fontSize: 13, color: '#78350F', whiteSpace: 'pre-wrap', lineHeight: 1.7, marginBottom: 12, background: '#FEF3C7', borderRadius: 8, padding: '10px 14px' }}>
              {portMaster.notes}
            </div>
          )}
          {portMaster.pdfs?.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: '#92400E', fontWeight: 600, marginBottom: 6 }}>📄 関連PDF</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {portMaster.pdfs.map((pdf, i) => (
                  <button key={i} onClick={() => {
                    const [meta, b64] = pdf.split(',')
                    const mime = meta.match(/:(.*?);/)?.[1] ?? 'application/pdf'
                    const bin = atob(b64); const arr = new Uint8Array(bin.length)
                    for (let j = 0; j < bin.length; j++) arr[j] = bin.charCodeAt(j)
                    window.open(URL.createObjectURL(new Blob([arr], { type: mime })), '_blank')
                  }} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, border: '1px solid #F59E0B', background: '#FEF3C7', color: '#92400E', cursor: 'pointer', fontWeight: 600 }}>
                    🔗 PDF {portMaster.pdfs.length > 1 ? i + 1 : ''}
                  </button>
                ))}
              </div>
            </div>
          )}
          {portMaster.photos?.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: '#92400E', fontWeight: 600, marginBottom: 6 }}>📸 写真</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {portMaster.photos.map((photo, i) => (
                  <img key={i} src={photo} alt={`${f.port} 写真${i + 1}`} style={{ width: 100, height: 70, objectFit: 'cover', borderRadius: 6, border: '1px solid #F59E0B', cursor: 'pointer' }} onClick={() => window.open(photo, '_blank')} />
                ))}
              </div>
            </div>
          )}
          {/* 確認チェックボックス */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginTop: 8, padding: '10px 14px', background: notesConfirmed ? '#D1FAE5' : '#FEE2E2', borderRadius: 8, border: `1.5px solid ${notesConfirmed ? '#6EE7B7' : '#FCA5A5'}`, transition: 'all .2s' }}>
            <input type="checkbox" checked={notesConfirmed} onChange={e => setNotesConfirmed(e.target.checked)} style={{ width: 18, height: 18, accentColor: '#16A34A', cursor: 'pointer' }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: notesConfirmed ? '#15803D' : '#B91C1C' }}>
                {notesConfirmed ? '✅ 注意事項を確認しました' : '⬜ 注意事項を確認しました（必須）'}
              </div>
              <div style={{ fontSize: 11, color: notesConfirmed ? '#16A34A' : '#DC2626', marginTop: 2 }}>
                {notesConfirmed ? '送信できます' : 'このチェックが必須です。確認後にチェックしてください。'}
              </div>
            </div>
          </label>
        </Card>
      )}

      {!portMaster && f.port && f.port !== '__other__' && (
        <div style={{ marginBottom: 16, padding: '10px 14px', background: 'var(--surface2)', borderRadius: 8, fontSize: 12, color: 'var(--text-muted)' }}>
          ℹ️ この港の注意事項は未登録です。設定 → 港マスターから追加できます。
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <Btn variant="ghost" onClick={() => navigate('/')}>キャンセル</Btn>
        <Btn
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          style={{ opacity: canSubmit ? 1 : 0.5, minWidth: 140 }}
        >
          {submitting ? '送信中...' : '🚦 KY報告を送信して日報へ'}
        </Btn>
      </div>
    </div>
  )
}

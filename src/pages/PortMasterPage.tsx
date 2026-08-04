import { useState, useRef } from 'react'
import { Card, PageHeader, Btn, Field, useIsMobile } from '../components/UI'
import type { PortMaster } from '../types'

interface Props {
  portMasters: PortMaster[]
  onSave: (pm: Omit<PortMaster, 'created_at' | 'updated_at'>) => Promise<boolean>
  onDelete: (id: string) => Promise<boolean>
}

const EMPTY_PORT: Omit<PortMaster, 'id' | 'created_at' | 'updated_at'> = {
  name: '', notes: '', photos: [], pdfs: [], extra: {}
}

export default function PortMasterPage({ portMasters, onSave, onDelete }: Props) {
  const isMobile = useIsMobile()
  const [editing, setEditing] = useState<PortMaster | null>(null)
  const [form, setForm] = useState<Omit<PortMaster, 'id' | 'created_at' | 'updated_at'>>(EMPTY_PORT)
  const [saving, setSaving] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const photoRef = useRef<HTMLInputElement>(null)
  const pdfRef = useRef<HTMLInputElement>(null)

  const openNew = () => {
    setEditing({ id: crypto.randomUUID(), name: '', notes: '', photos: [], pdfs: [], extra: {} })
    setForm(EMPTY_PORT)
  }

  const openEdit = (pm: PortMaster) => {
    setEditing(pm)
    setForm({ name: pm.name, notes: pm.notes, photos: pm.photos ?? [], pdfs: pm.pdfs ?? [], extra: pm.extra ?? {} })
  }

  const handleSave = async () => {
    if (!editing) return
    setSaving(true)
    await onSave({ id: editing.id, ...form })
    setSaving(false)
    setEditing(null)
  }

  const addPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    files.forEach(file => {
      const reader = new FileReader()
      reader.onload = ev => setForm(prev => ({ ...prev, photos: [...prev.photos, ev.target?.result as string] }))
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  const addPdf = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter(f => f.type === 'application/pdf')
    files.forEach(file => {
      const reader = new FileReader()
      reader.onload = ev => setForm(prev => ({ ...prev, pdfs: [...prev.pdfs, ev.target?.result as string] }))
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  const openPdf = (dataUrl: string) => {
    const [meta, b64] = dataUrl.split(',')
    const mime = meta.match(/:(.*?);/)?.[1] ?? 'application/pdf'
    const bin = atob(b64); const arr = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
    window.open(URL.createObjectURL(new Blob([arr], { type: mime })), '_blank')
  }

  const inputSt: React.CSSProperties = {
    width: '100%', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
    padding: '8px 10px', fontSize: 13, background: 'var(--surface)', color: 'var(--text)',
    outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div style={{ padding: isMobile ? '16px' : '24px 32px' }}>
      <PageHeader title="🏔 港マスター" sub="港ごとの注意事項・写真・PDFを管理します" />

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Btn onClick={openNew}>＋ 港を追加</Btn>
      </div>

      {portMasters.length === 0 && !editing && (
        <Card style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🏔</div>
          <div>港マスターが登録されていません</div>
          <Btn onClick={openNew} style={{ marginTop: 16 }}>最初の港を登録</Btn>
        </Card>
      )}

      {/* 港一覧 */}
      {!editing && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {portMasters.map(pm => (
            <Card key={pm.id} style={{ padding: '14px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>🏔 {pm.name}</div>
                  {pm.notes && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.6, marginBottom: 6, background: 'var(--surface2)', padding: '8px 10px', borderRadius: 6 }}>
                      {pm.notes.length > 200 ? pm.notes.slice(0, 200) + '...' : pm.notes}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 11, color: 'var(--text-muted)' }}>
                    {pm.photos?.length > 0 && <span>📸 写真 {pm.photos.length}枚</span>}
                    {pm.pdfs?.length > 0 && <span>📄 PDF {pm.pdfs.length}件</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => openEdit(pm)} style={{ fontSize: 11, padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', fontWeight: 600 }}>編集</button>
                  {confirmId === pm.id ? (
                    <>
                      <button onClick={() => { onDelete(pm.id); setConfirmId(null) }} style={{ fontSize: 11, padding: '5px 10px', borderRadius: 6, border: 'none', background: '#DC2626', color: '#fff', cursor: 'pointer' }}>削除</button>
                      <button onClick={() => setConfirmId(null)} style={{ fontSize: 11, padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer' }}>取消</button>
                    </>
                  ) : (
                    <button onClick={() => setConfirmId(pm.id)} style={{ fontSize: 11, padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)', cursor: 'pointer' }}>削除</button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* 編集フォーム */}
      {editing && (
        <Card>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>
            {portMasters.find(p => p.id === editing.id) ? '✏️ 港を編集' : '➕ 港を新規登録'}
          </div>

          <Field label="港名 *">
            <input style={inputSt} value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} placeholder="例：横浜港、東京港" />
          </Field>

          <Field label="注意事項">
            <textarea
              style={{ ...inputSt, minHeight: 120, resize: 'vertical' }}
              value={form.notes}
              onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="KY確認前に表示される注意事項を入力してください。&#10;例：&#10;・岸壁端に注意&#10;・ヘルメット着用必須&#10;・〇〇連絡先: 000-0000-0000"
            />
          </Field>

          {/* 写真 */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>📸 写真</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              {form.photos.map((photo, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <img src={photo} alt={`写真${i + 1}`} style={{ width: 90, height: 65, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => window.open(photo, '_blank')} />
                  <button onClick={() => setForm(prev => ({ ...prev, photos: prev.photos.filter((_, j) => j !== i) }))}
                    style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', border: 'none', background: '#DC2626', color: '#fff', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>×</button>
                </div>
              ))}
              <button onClick={() => photoRef.current?.click()} style={{ width: 90, height: 65, borderRadius: 6, border: '1.5px dashed var(--border)', background: 'var(--surface2)', cursor: 'pointer', fontSize: 22, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>＋</button>
            </div>
            <input ref={photoRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={addPhoto} />
          </div>

          {/* PDF */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>📄 PDF資料</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {form.pdfs.map((pdf, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px' }}>
                  <button onClick={() => openPdf(pdf)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 12, textDecoration: 'underline', padding: 0 }}>
                    🔗 PDF{form.pdfs.length > 1 ? i + 1 : ''}
                  </button>
                  <button onClick={() => setForm(prev => ({ ...prev, pdfs: prev.pdfs.filter((_, j) => j !== i) }))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14, padding: '0 2px' }}>✕</button>
                </div>
              ))}
            </div>
            <input ref={pdfRef} type="file" accept="application/pdf" multiple style={{ display: 'none' }} onChange={addPdf} />
            <button onClick={() => pdfRef.current?.click()} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 6, border: '1px dashed var(--border)', background: 'var(--surface2)', cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)' }}>
              📎 PDFを追加
            </button>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Btn variant="ghost" onClick={() => setEditing(null)}>キャンセル</Btn>
            <Btn onClick={handleSave} disabled={saving || !form.name}>
              {saving ? '保存中...' : '💾 保存'}
            </Btn>
          </div>
        </Card>
      )}
    </div>
  )
}

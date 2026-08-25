import React, { useState, useRef, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Card, Select, PageHeader, Btn, Field, Input, Grid, Divider, useIsMobile } from '../components/UI'
import { CATEGORIES } from '../types'
import type { Report, Settings } from '../types'
import { sendEmail, buildDailyReportEmail } from '../lib/email'

interface Props {
  reports: Report[]
  onUpdateAmount: (id: string, amount: number) => Promise<boolean>
  onSavePdf: (id: string, url: string) => void
  onUpdateReport: (id: string, updates: Partial<Report>) => Promise<boolean>
  onDeleteReport: (id: string) => Promise<boolean>
  prices?: Record<string, { ship: number; crew: number }>
  settings?: Settings
}

interface HwParsed { from1: string; to1: string; from2: string; to2: string; fee: number }

async function parseEtcPdf(file: File): Promise<HwParsed | null> {
  try {
    // CDNからpdf.jsをロード（型定義不要）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfjsLib: any = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.min.mjs' as string)
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs'
    const ab = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: ab }).promise
    let fullText = ''
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const tc = await page.getTextContent()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fullText += tc.items.map((it: any) => it.str ?? '').join('\n') + '\n'
    }

    // 後納料金合計を取得（支払い総額行）
    const totalMatch = fullText.match(/支払い?総額[\s\S]*?[¥\\￥]?\s*([\d,]+)/)
    const total = totalMatch ? parseInt(totalMatch[1].replace(/,/g, '')) : 0

    // 利用IC行を抽出: 「出発IC 到着IC 通行料金 後納料金」の繰り返し
    // ETC明細のテキストは各セルが改行区切りで出るため行ベースでパース
    const lines = fullText.split('\n').map(l => l.trim()).filter(Boolean)

    // IC名っぽい行（漢字・カナを含む2文字以上）を拾う
    const icPattern = /^[^\d¥\\￥\s*]{2,}$/
    const numPattern = /^\d[\d,]*$/

    const rows: { from: string; to: string; fee: number }[] = []
    let i = 0
    while (i < lines.length) {
      if (icPattern.test(lines[i]) && i + 1 < lines.length && icPattern.test(lines[i + 1])) {
        const from = lines[i]
        const to = lines[i + 1]
        // 後続から数値を探す（通行料金 後納料金）
        let fee = 0
        let j = i + 2
        let numCount = 0
        while (j < lines.length && numCount < 4) {
          if (numPattern.test(lines[j].replace(/,/g, ''))) {
            numCount++
            if (numCount === 2) { // 2番目の数値が後納料金
              fee = parseInt(lines[j].replace(/,/g, ''))
            }
          } else if (icPattern.test(lines[j]) && icPattern.test(lines[j + 1] ?? '')) {
            break
          }
          j++
        }
        if (fee > 0 || numCount > 0) {
          rows.push({ from, to, fee })
          i = j
          continue
        }
      }
      i++
    }

    if (rows.length === 0) return null

    return {
      from1: rows[0]?.from ?? '',
      to1:   rows[0]?.to   ?? '',
      from2: rows[1]?.from ?? '',
      to2:   rows[1]?.to   ?? '',
      fee:   total || rows.reduce((s, r) => s + r.fee, 0),
    }
  } catch (e) {
    console.error('ETC PDF parse error', e)
    return null
  }
}

function HwPopup({ report, onClose, onSavePdf, settings, onUpdateReport }: { report: Report; onClose: () => void; onSavePdf: (id: string, url: string) => void; settings?: Settings; onUpdateReport?: (id: string, updates: Partial<Report>) => Promise<boolean> }) {
  const [hw, setHw] = useState({ from1: report.hw_from1, to1: report.hw_to1, from2: report.hw_from2, to2: report.hw_to2, fee: report.hw_fee })
  const [pdfUrl, setPdfUrl] = useState(report.hw_voucher ?? '')
  const [uploading, setUploading] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [parseResult, setParseResult] = useState<'success' | 'error' | null>(null)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<'success' | 'error' | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const etcFileRef = useRef<HTMLInputElement>(null)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || file.type !== 'application/pdf') return
    setUploading(true)
    const reader = new FileReader()
    reader.onload = (ev) => { const url = ev.target?.result as string; setPdfUrl(url); onSavePdf(report.id, url); setUploading(false) }
    reader.readAsDataURL(file)
  }

  const handleEtcPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setParsing(true)
    setParseResult(null)
    const parsed = await parseEtcPdf(file)
    if (parsed) {
      setHw(parsed)
      setParseResult('success')
    } else {
      setParseResult('error')
    }
    setParsing(false)
    e.target.value = ''
    // 領収書PDFとしても保存
    const reader = new FileReader()
    reader.onload = (ev) => { const url = ev.target?.result as string; setPdfUrl(url); onSavePdf(report.id, url) }
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    if (!onUpdateReport) return
    setSaving(true)
    await onUpdateReport(report.id, { hw_from1: hw.from1, hw_to1: hw.to1, hw_from2: hw.from2, hw_to2: hw.to2, hw_fee: hw.fee })
    setSaving(false)
  }
  const handleResend = async () => {
    if (!settings?.daily_mail) return
    setSending(true)
    setSendResult(null)
    try {
      const annualUrl = `https://mutsumigroup.github.io/marine-app/#/reports?month=${report.bill_month}`
      const baseMessage = buildDailyReportEmail({
        date: report.date,
        port: report.port,
        ship: report.ship,
        crew: report.crew,
        category: report.category,
        work: report.work ?? '',
        amount: report.amount,
        park_fee: report.park_fee,
        hw_fee: hw.fee,
        meal: report.meal,
        hotel_fee: report.hotel_fee ?? 0,
        shinkansen_fee: report.shinkansen_fee ?? 0,
        expenses: report.expenses,
        voucher: report.voucher ?? '',
        bill_month: report.bill_month,
        notes: report.notes ?? '',
      }, annualUrl, settings?.daily_report_template)
      const hwDetailUrl = `https://mutsumigroup.github.io/marine-app/#/reports?month=${report.bill_month}`
      const hwFrom = hw.from1 || hw.to1 ? `行き：${hw.from1 || '—'} → ${hw.to1 || '—'}` : ''
      const hwReturn = hw.from2 || hw.to2 ? `帰り：${hw.from2 || '—'} → ${hw.to2 || '—'}` : ''
      const hwDetail = [`■ 高速道路明細（反映済み）`, `高速料金合計：¥${hw.fee.toLocaleString()}`, hwFrom, hwReturn].filter(Boolean).join('\n')
      const message = `【高速道路料金反映済み】\n高速道路料金の詳細を更新しました。\n\n${hwDetail}\n\n高速明細の確認はこちら：\n${hwDetailUrl}\n\n` + baseMessage
      await sendEmail({
        to_email: settings.daily_mail,
        subject: `【日報・高速料金反映済み】${report.date} ${report.ship}`,
        message,
      })
      setSendResult('success')
    } catch {
      setSendResult('error')
    } finally {
      setSending(false)
    }
  }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'var(--surface)', borderRadius: 12, padding: '20px 24px', width: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,.18)', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>🛣 高速道路詳細</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)' }}>✕</button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>{report.date}　{report.ship}</div>

        {/* ETC明細PDF自動読み込み */}
        <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#1D4ED8', marginBottom: 6 }}>📄 ETC明細PDFから自動入力</div>
          {parseResult === 'success' && (
            <div style={{ fontSize: 12, color: '#0F6E56', background: '#E1F5EE', borderRadius: 6, padding: '5px 10px', marginBottom: 8 }}>✅ 読み取り成功！内容を確認して「保存」してください</div>
          )}
          {parseResult === 'error' && (
            <div style={{ fontSize: 12, color: '#b91c1c', background: '#fef2f2', borderRadius: 6, padding: '5px 10px', marginBottom: 8 }}>❌ 読み取りに失敗しました。手動で入力してください</div>
          )}
          <input ref={etcFileRef} type="file" accept="application/pdf" style={{ display: 'none' }} onChange={handleEtcPdf} />
          <button onClick={() => etcFileRef.current?.click()} disabled={parsing} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius)', border: 'none', background: '#2563EB', color: '#fff', cursor: parsing ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600, width: '100%', justifyContent: 'center' }}>
            {parsing ? '🔄 読み取り中...' : '📂 ETCご利用明細PDFを読み込む'}
          </button>
        </div>

        {/* 明細表示（編集可能） */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          {([['行き 出発地', 'from1'], ['行き 到着地', 'to1'], ['帰り 出発地', 'from2'], ['帰り 到着地', 'to2']] as const).map(([label, key]) => (
            <div key={key} style={{ background: 'var(--surface2)', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
              <input value={hw[key]} onChange={e => setHw(prev => ({ ...prev, [key]: e.target.value }))} style={{ width: '100%', border: 'none', background: 'transparent', fontSize: 13, fontWeight: 500, outline: 'none', color: 'var(--text)' }} placeholder="—" />
            </div>
          ))}
        </div>
        <div style={{ background: 'var(--accent-bg)', borderRadius: 8, padding: '12px 14px', border: '1px solid var(--accent-border)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>高速料金合計</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)' }}>¥</span>
              <input type="number" value={hw.fee} onChange={e => setHw(prev => ({ ...prev, fee: parseInt(e.target.value) || 0 }))} style={{ border: 'none', background: 'transparent', fontSize: 18, fontWeight: 700, color: 'var(--accent)', outline: 'none', width: 120 }} />
            </div>
          </div>
          <button onClick={handleSave} disabled={saving} style={{ padding: '8px 18px', borderRadius: 'var(--radius)', border: 'none', background: saving ? 'var(--surface2)' : '#16A34A', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
            {saving ? '保存中...' : '💾 保存'}
          </button>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10, color: 'var(--text-secondary)' }}>📎 領収書PDF</div>
          {pdfUrl && <div style={{ marginBottom: 10 }}><button onClick={() => { const [meta, b64] = pdfUrl.split(','); const mime = meta.match(/:(.*?);/)?.[1] ?? 'application/pdf'; const bin = atob(b64); const arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i); window.open(URL.createObjectURL(new Blob([arr], { type: mime })), '_blank') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 12, textDecoration: 'underline', padding: 0 }}>🔗 添付PDFを開く</button></div>}
          <input ref={fileRef} type="file" accept="application/pdf" style={{ display: 'none' }} onChange={handleFile} />
          <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius)', border: '1px dashed var(--border-dark)', background: 'var(--surface2)', cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)', width: '100%', justifyContent: 'center' }}>
            {uploading ? '読み込み中...' : '📄 領収書PDFをアップロード（別途）'}
          </button>
        </div>
        {settings?.daily_mail && (
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>📧 メール再送信</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
              高速道路料金（¥{report.hw_fee.toLocaleString()}）を反映済みとして日報メールを再送信します
            </div>
            {sendResult === 'success' && (
              <div style={{ fontSize: 12, color: '#0F6E56', background: '#E1F5EE', borderRadius: 6, padding: '6px 10px', marginBottom: 8 }}>
                ✅ メールを送信しました（{settings.daily_mail}）
              </div>
            )}
            {sendResult === 'error' && (
              <div style={{ fontSize: 12, color: '#b91c1c', background: '#fef2f2', borderRadius: 6, padding: '6px 10px', marginBottom: 8 }}>
                ❌ 送信に失敗しました。再度お試しください
              </div>
            )}
            <button
              onClick={handleResend}
              disabled={sending}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 'var(--radius)', border: 'none', background: sending ? 'var(--surface2)' : 'var(--accent)', color: sending ? 'var(--text-muted)' : '#fff', cursor: sending ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600, width: '100%', justifyContent: 'center' }}
            >
              {sending ? '送信中...' : '📤 高速道路反映済みメールを再送信'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export function EditModal({ report, onClose, onSave, onDelete, prices }: { report: Report; onClose: () => void; onSave: (id: string, updates: Partial<Report>) => Promise<boolean>; onDelete: (id: string) => Promise<boolean>; prices: Record<string, { ship: number; crew: number }> }) {
  const [f, setF] = useState({ ...report })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [autoCalc, setAutoCalc] = useState(true)
  const [voucherUploading, setVoucherUploading] = useState(false)
  const voucherFileRef = useRef<HTMLInputElement>(null)
  const set = (key: keyof Report) => (v: string) => setF(prev => ({ ...prev, [key]: v }))
  const setNum = (key: keyof Report) => (v: string) => setF(prev => ({ ...prev, [key]: parseInt(v) || 0 }))

  // Voucher（最大5枚）アップロード処理
  const voucherList = f.voucher ? f.voucher.split('|||').filter(Boolean) : []
  const handleVoucherFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter(fi => fi.type === 'application/pdf')
    if (!files.length) return
    const remaining = 5 - voucherList.length
    if (remaining <= 0) { alert('Voucherは最大5枚までです'); return }
    const toAdd = files.slice(0, remaining)
    setVoucherUploading(true)
    let loaded = 0
    const newDataUrls: string[] = []
    toAdd.forEach(file => {
      const reader = new FileReader()
      reader.onload = (ev) => {
        newDataUrls.push(ev.target?.result as string)
        loaded++
        if (loaded === toAdd.length) {
          const merged = [...voucherList, ...newDataUrls].join('|||')
          setF(prev => ({ ...prev, voucher: merged }))
          setVoucherUploading(false)
        }
      }
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }
  const openVoucherPdf = (dataUrl: string) => {
    const [meta, b64] = dataUrl.split(',')
    const mime = meta.match(/:(.*?);/)?.[1] ?? 'application/pdf'
    const binary = atob(b64)
    const arr = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i)
    window.open(URL.createObjectURL(new Blob([arr], { type: mime })), '_blank')
  }
  const removeVoucher = (idx: number) => {
    const next = voucherList.filter((_, i) => i !== idx).join('|||')
    setF(prev => ({ ...prev, voucher: next }))
  }
  const calcAmount = (cat: string, crew: number) => { const p = prices[cat] ?? { ship: 10000, crew: 1000 }; return p.ship + crew * (p.crew ?? 0) }
  const handleCategoryChange = (v: string) => { setF(prev => { const newAmount = autoCalc ? calcAmount(v, Number(prev.crew)) : prev.amount; return { ...prev, category: v, amount: newAmount } }) }
  const handleCrewChange = (v: string) => { setF(prev => { const crew = parseInt(v) || 0; const newAmount = autoCalc ? calcAmount(prev.category, crew) : prev.amount; return { ...prev, crew, amount: newAmount } }) }
  const handleDelete = async () => { setDeleting(true); const ok = await onDelete(report.id); setDeleting(false); if (ok) onClose() }
  const handleSave = async () => { setSaving(true); const exp = (parseInt(String(f.park_fee)) || 0) + (parseInt(String(f.hw_fee)) || 0) + (parseInt(String(f.meal)) || 0) + (parseInt(String(f.hotel_fee ?? 0)) || 0) + (parseInt(String(f.shinkansen_fee ?? 0)) || 0) + (f.extra_expenses ?? []).reduce((s, e) => s + e.amount, 0); const ok = await onSave(report.id, { ...f, other_exp: 0, expenses: exp }); setSaving(false); if (ok) onClose() }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'var(--surface)', borderRadius: 12, padding: '20px 24px', width: '100%', maxWidth: 680, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,.18)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>✏ 日報を編集</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)' }}>✕</button>
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 10 }}>基本情報</div>
        <Grid cols={3} style={{ marginBottom: 10 }}>
          <Field label="稼働日"><Input type="date" value={f.date} onChange={set('date')} /></Field>
          <Field label="港名"><Input value={f.port} onChange={set('port')} /></Field>
          <Field label="船名"><Input value={f.ship} onChange={set('ship')} /></Field>
        </Grid>
        <Grid cols={3} style={{ marginBottom: 10 }}>
          <Field label="船員人数"><Input type="number" value={String(f.crew)} onChange={handleCrewChange} /></Field>
          <Field label="対応区分"><select value={f.category} onChange={e => handleCategoryChange(e.target.value)} style={{ padding: '6px 9px', border: '1px solid var(--border-dark)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, width: '100%' }}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></Field>
          <Field label="業務内容"><Input value={f.work} onChange={set('work')} /></Field>
        </Grid>
        <Grid cols={2} style={{ marginBottom: 10 }}>
          <Field label={`Voucher（${voucherList.length}/5枚）`}>
            <div>
              {/* アップロード済みPDFリスト */}
              {voucherList.length > 0 && (
                <div style={{ marginBottom: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {voucherList.map((url, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', borderRadius: 6, padding: '3px 8px' }}>
                      <button
                        onClick={() => openVoucherPdf(url)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 12, padding: 0, textDecoration: 'underline' }}
                      >
                        🔗 PDF{voucherList.length > 1 ? i + 1 : ''}
                      </button>
                      <button
                        onClick={() => removeVoucher(i)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, padding: '0 2px', lineHeight: 1 }}
                        title="削除"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {/* アップロードボタン（5枚未満のときのみ表示） */}
              {voucherList.length < 5 && (
                <>
                  <input
                    ref={voucherFileRef}
                    type="file"
                    accept="application/pdf"
                    multiple
                    style={{ display: 'none' }}
                    onChange={handleVoucherFiles}
                  />
                  <button
                    onClick={() => voucherFileRef.current?.click()}
                    disabled={voucherUploading}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 'var(--radius)', border: '1px dashed var(--border-dark)', background: 'var(--surface2)', cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)', width: '100%', justifyContent: 'center' }}
                  >
                    {voucherUploading ? '読み込み中...' : `📎 PDFを追加（残り${5 - voucherList.length}枚）`}
                  </button>
                </>
              )}
            </div>
          </Field>
          <Field label="請求対象月"><Input type="month" value={f.bill_month} onChange={set('bill_month')} /></Field>
        </Grid>
        <Divider />
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 10 }}>交通費・立替</div>
        <Grid cols={2} style={{ marginBottom: 10 }}>
          <Field label="駐車場場所"><Input value={f.park_place} onChange={set('park_place')} /></Field>
          <Field label="駐車場料金（円）"><Input type="number" value={String(f.park_fee)} onChange={setNum('park_fee')} /></Field>
        </Grid>
        <Grid cols={4} style={{ marginBottom: 10 }}>
          <Field label="行き 出発地"><Input value={f.hw_from1} onChange={set('hw_from1')} /></Field>
          <Field label="行き 到着地"><Input value={f.hw_to1} onChange={set('hw_to1')} /></Field>
          <Field label="帰り 出発地"><Input value={f.hw_from2} onChange={set('hw_from2')} /></Field>
          <Field label="帰り 到着地"><Input value={f.hw_to2} onChange={set('hw_to2')} /></Field>
        </Grid>
        <Grid cols={3} style={{ marginBottom: 10 }}>
          <Field label="高速料金（円）"><Input type="number" value={String(f.hw_fee)} onChange={setNum('hw_fee')} /></Field>
          <Field label="食事代（円）"><Input type="number" value={String(f.meal)} onChange={setNum('meal')} /></Field>
          <Field label="ホテル代金（円）"><Input type="number" value={String(f.hotel_fee ?? 0)} onChange={setNum('hotel_fee')} /></Field>
          <Field label="新幹線代金（円）"><Input type="number" value={String(f.shinkansen_fee ?? 0)} onChange={setNum('shinkansen_fee')} /></Field>
        </Grid>
        <div style={{ marginTop: 8, marginBottom: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.4px' }}>追加立替項目</div>
            <button onClick={() => setF(prev => ({ ...prev, extra_expenses: [...(prev.extra_expenses ?? []), { label: '', amount: 0 }] }))}
              style={{ fontSize: 11, color: 'var(--accent)', background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', borderRadius: 'var(--radius)', padding: '2px 10px', cursor: 'pointer', fontWeight: 600 }}>
              ＋ 項目追加
            </button>
          </div>
          {(f.extra_expenses ?? []).map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                <input
                  value={item.label}
                  onChange={(e) => { const updated = [...f.extra_expenses!]; updated[i] = { ...updated[i], label: e.target.value }; setF(prev => ({ ...prev, extra_expenses: updated })) }}
                  style={{ flex: 1, padding: '6px 8px', border: '1px solid var(--border-dark)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13 }}
                  placeholder="項目名"
                />
                <input
                  type="number"
                  value={item.amount}
                  onChange={(e) => { const updated = [...f.extra_expenses!]; updated[i] = { ...updated[i], amount: parseInt(e.target.value) || 0 }; setF(prev => ({ ...prev, extra_expenses: updated })) }}
                  style={{ width: 100, padding: '6px 8px', border: '1px solid var(--border-dark)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--accent)', fontSize: 13, textAlign: 'right' }}
                  placeholder="金額"
                />
              <button
                onClick={() => setF(prev => ({ ...prev, extra_expenses: (prev.extra_expenses ?? []).filter((_, j) => j !== i) }))}
                style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: '#FEE2E2', color: '#DC2626', cursor: 'pointer', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                title="削除"
              >✕</button>
            </div>
          ))}
          {(f.extra_expenses ?? []).length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              合計: <strong style={{ color: 'var(--accent)', marginLeft: 6 }}>¥{(f.extra_expenses ?? []).reduce((s, e) => s + e.amount, 0).toLocaleString()}</strong>
            </div>
          )}
        </div>
        <Divider />
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 10 }}>売上</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <input type="checkbox" checked={autoCalc} onChange={e => { setAutoCalc(e.target.checked); if (e.target.checked) setF(prev => ({ ...prev, amount: calcAmount(prev.category, Number(prev.crew)) })) }} />
            対応区分・船員人数から自動計算
          </label>
          {autoCalc && <span style={{ fontSize: 11, color: 'var(--accent)', background: 'var(--accent-bg)', padding: '2px 8px', borderRadius: 'var(--radius)', border: '1px solid var(--accent-border)' }}>自動計算中 ¥{calcAmount(f.category, Number(f.crew)).toLocaleString()}</span>}
        </div>
        <Grid cols={2} style={{ marginBottom: 10 }}>
          <Field label="売上金額（円）"><Input type="number" value={String(f.amount)} onChange={v => { setAutoCalc(false); setNum('amount')(v) }} /></Field>
          <Field label="備考"><Input value={f.notes} onChange={set('notes')} /></Field>
        </Grid>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', marginTop: 16 }}>
          <div>
            {!confirmDelete ? <Btn onClick={() => setConfirmDelete(true)} disabled={deleting}>🗑 削除</Btn> : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--error, #dc2626)', fontWeight: 600 }}>本当に削除しますか？</span>
                <Btn onClick={handleDelete} disabled={deleting}>{deleting ? '削除中...' : '✓ はい、削除する'}</Btn>
                <Btn onClick={() => setConfirmDelete(false)}>キャンセル</Btn>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn onClick={onClose}>閉じる</Btn>
            <Btn variant="primary" onClick={handleSave} disabled={saving}>{saving ? '保存中...' : '✓ 保存する'}</Btn>
          </div>
        </div>
      </div>
    </div>
  )
}


// 業務内容ポップアップ
function ExtraExpenseCell({ items, otherExp = 0 }: { items: {label: string; amount: number}[]; otherExp?: number }) {
  const [show, setShow] = React.useState(false)
  const allItems = otherExp > 0 ? [{ label: 'その他立替', amount: otherExp }, ...items] : items
  const total = allItems.reduce((sum, e) => sum + e.amount, 0)
  if (total === 0) return <span style={{ color: 'var(--text-light)' }}>—</span>
  return (
    <>
      <div onClick={(e) => { e.stopPropagation(); setShow(true) }}
        style={{ cursor: 'pointer', color: 'var(--accent)', fontSize: 12, textDecoration: 'underline dotted', textUnderlineOffset: 3 }}>
        ¥{total.toLocaleString()}
      </div>
      {show && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setShow(false)}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px', maxWidth: 300, width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,.2)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 10 }}>追加立替項目</div>
            {allItems.map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < allItems.length - 1 ? '1px solid var(--border)' : 'none', fontSize: 13 }}>
                <span style={{ color: 'var(--text)' }}>{item.label}</span>
                <span style={{ color: 'var(--accent)', fontWeight: 600 }}>¥{item.amount.toLocaleString()}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0 0', marginTop: 6, fontSize: 13, fontWeight: 700 }}>
              <span>合計</span>
              <span style={{ color: 'var(--accent)' }}>¥{total.toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function WorkCell({ work }: { work: string }) {
  const [show, setShow] = React.useState(false)
  if (!work || work === '—') return <span style={{ color: 'var(--text-light)', fontSize: 11 }}>—</span>
  return (
    <>
      <div onClick={e => { e.stopPropagation(); setShow(true) }}
        style={{ cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)', textDecoration: 'underline dotted', textUnderlineOffset: 3 }}>
        {work}
      </div>
      {show && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setShow(false)}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px', maxWidth: 360, width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,.2)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px' }}>業務内容</div>
            <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text)' }}>{work}</div>
            <button onClick={() => setShow(false)} style={{ marginTop: 14, width: '100%', padding: '10px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-muted)' }}>閉じる</button>
          </div>
        </div>
      )}
    </>
  )
}

function HwCell({ report, onClick }: { report: Report; onClick: () => void }) {
  if (report.hw_fee === 0 && !report.hw_from1 && !report.hw_from2) return <span style={{ color: 'var(--text-light)', fontSize: 11 }}>—</span>
  return (
    <div onClick={onClick} title="クリックして高速詳細を表示" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 6px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--surface2)', transition: 'all .12s', fontSize: 11 }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--accent-bg)'; (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--accent-border)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--surface2)'; (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)' }}>
      🛣 {report.hw_fee > 0 ? `¥${report.hw_fee.toLocaleString()}` : '詳細'}
    </div>
  )
}

const TD: React.CSSProperties = { padding: '6px 8px', verticalAlign: 'middle', borderBottom: '1px solid var(--border)', fontSize: 12 }
const CAT_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  '乗船': { bg: '#fccaca', color: '#9b1c1c', border: '#f87171' },
  '下船': { bg: '#bfdbfe', color: '#1e40af', border: '#60a5fa' },
  'センディング': { bg: '#fde68a', color: '#92400e', border: '#f59e0b' },
  '転船': { bg: '#bbf7d0', color: '#14532d', border: '#4ade80' },
}
function CatBadge({ cat }: { cat: string }) {
  const c = CAT_COLORS[cat]
  if (!c) return <span style={{ fontSize: 12 }}>{cat}</span>
  return <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: c.bg, color: c.color, border: `1px solid ${c.border}`, whiteSpace: 'nowrap' }}>{cat}</span>
}

const COLS = [
  ['稼働日', '82px'], ['港名', '80px'], ['船名', '120px'], ['人数', '48px'],
  ['対応区分', '92px'], ['業務内容', '320px'], ['駐車場', '82px'],
  ['高速料金 🛣', '90px'], ['食事代', '76px'], ['ホテル代金', '80px'], ['新幹線代金', '80px'], ['VOUCHER', '80px'], ['追加立替', '80px'], ['売上金額', '114px'],
]

export default function ReportsList({ reports, onUpdateAmount, onSavePdf, onUpdateReport, onDeleteReport, prices = {}, settings }: Props) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [filterYear, setFilterYear] = useState('')
  const [filterMonth, setFilterMonth] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  // URLパラメータからcategoryを読み取る
  React.useEffect(() => {
    const cat = searchParams.get('category')
    if (cat) setFilterCategory(cat)
    const month = searchParams.get('month')
    if (month) {
      setFilterYear(month.slice(0, 4))
      setFilterMonth(month)
    }
  }, [searchParams])
  const fromInvoices = searchParams.get('from') === 'invoices'
  const backMonth = searchParams.get('month')
  const [hwReport, setHwReport] = useState<Report | null>(null)
  const [editReport, setEditReport] = useState<Report | null>(null)

  // URLの ?month= パラメータを初期値として使用
  useEffect(() => {
    const month = searchParams.get('month')
    if (month) {
      const year = month.slice(0, 4)
      setFilterYear(year)
      setFilterMonth(month)
      setSearchParams({}, { replace: true })
    }
  }, [])

  const years = [...new Set(reports.map(r => r.bill_month?.slice(0, 4)))].filter(Boolean).sort().reverse()
  const months = [...new Set(reports.filter(r => !filterYear || r.bill_month?.startsWith(filterYear)).map(r => r.bill_month))].sort().reverse()
  const filtered = reports.filter(r =>
    (!filterYear || r.bill_month?.startsWith(filterYear)) &&
    (!filterMonth || r.bill_month === filterMonth) &&
    (!filterCategory || r.category === filterCategory)
  )
  const sorted = [...filtered].sort((a, b) => b.date.localeCompare(a.date))
  const totalAmount = filtered.reduce((s, r) => s + r.amount, 0)
  const totalPark = filtered.reduce((s, r) => s + r.park_fee, 0)
  const totalHw = filtered.reduce((s, r) => s + r.hw_fee, 0)
  const totalMeal = filtered.reduce((s, r) => s + r.meal, 0)
  const totalHotel = filtered.reduce((s, r) => s + (r.hotel_fee ?? 0), 0)
  const totalShinkansen = filtered.reduce((s, r) => s + (r.shinkansen_fee ?? 0), 0)
  const zeroCount = filtered.filter(r => r.amount === 0).length

  return (
    <div style={{ padding: '16px 18px' }}>
      <PageHeader title="日報一覧" sub={filterMonth ? `${filterMonth} の日報` : '行をクリック→編集 / 高速料金をクリック→詳細'}>
        <Select value={filterYear} onChange={v => { setFilterYear(v); setFilterMonth('') }}>
          <option value="">すべての年</option>
          {years.map(y => <option key={y} value={y}>{y}年</option>)}
        </Select>
        <Select value={filterMonth} onChange={setFilterMonth}>
          <option value="">すべての月</option>
          {months.map(m => <option key={m} value={m}>{m}</option>)}
        </Select>
        <Select value={filterCategory} onChange={setFilterCategory}>
          <option value="">すべての区分</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </Select>
        {fromInvoices && backMonth && (
          <div style={{ padding: "8px 0 4px" }}>
            <button onClick={() => { window.location.href = "#/invoices" }} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer", fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>← {backMonth} 請求分に戻る</button>
          </div>
        )}
      </PageHeader>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 12px', fontSize: 12 }}>件数: <strong>{filtered.length}件</strong></div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 12px', fontSize: 12 }}>売上合計: <strong style={{ color: 'var(--accent)' }}>¥{totalAmount.toLocaleString()}</strong></div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 12px', fontSize: 12 }}>駐車場: <strong>¥{totalPark.toLocaleString()}</strong></div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 12px', fontSize: 12 }}>高速料金: <strong>¥{totalHw.toLocaleString()}</strong></div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 12px', fontSize: 12 }}>食事代: <strong>¥{totalMeal.toLocaleString()}</strong></div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 12px', fontSize: 12 }}>ホテル代金: <strong>¥{totalHotel.toLocaleString()}</strong></div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 12px', fontSize: 12 }}>新幹線代金: <strong>¥{totalShinkansen.toLocaleString()}</strong></div>
        {zeroCount > 0 && <div style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', borderRadius: 'var(--radius)', padding: '8px 12px', fontSize: 12, color: 'var(--warning)' }}>⚠ 売上未入力: <strong>{zeroCount}件</strong></div>}
      </div>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '8px 12px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>💡 行をクリックすると編集できます</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <thead>
              <tr style={{ background: 'var(--surface2)' }}>
                {COLS.map(([h, w]) => (
                  <th key={h} style={{ padding: '7px 8px', fontSize: 10, fontWeight: 600, color: h === '売上金額' ? 'var(--accent)' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.3px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', textAlign: 'left', width: w === 'auto' ? undefined : w, background: h === '売上金額' ? 'var(--accent-bg)' : undefined }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0
                ? <tr><td colSpan={COLS.length} style={{ padding: 32, textAlign: 'center', color: 'var(--text-light)' }}>日報がありません</td></tr>
                : sorted.map(r => (
                  <tr key={r.id} onClick={() => setEditReport(r)} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = '#f0f6ff' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = '' }}>
                    <td style={TD}>{r.date}</td>
                    <td style={{ ...TD, maxWidth: 76, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.port}</td>
                    <td style={{ ...TD, maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.ship}>{r.ship}</td>
                    <td style={{ ...TD, textAlign: 'center' }}>{r.crew}</td>
                    <td style={TD}><CatBadge cat={r.category} /></td>
                  <td style={{ ...TD, overflow: "visible", textOverflow: "clip", whiteSpace: "normal" }} onClick={(e) => e.stopPropagation()}><WorkCell work={r.work} />  </td>
                    <td style={{ ...TD, fontSize: 11 }}>{r.park_fee > 0 ? `¥${r.park_fee.toLocaleString()}` : '—'}</td>
                    <td style={TD} onClick={e => { e.stopPropagation(); setHwReport(r) }}><HwCell report={r} onClick={() => setHwReport(r)} /></td>
                    <td style={{ ...TD, fontSize: 11 }}>{r.meal > 0 ? `¥${r.meal.toLocaleString()}` : '—'}</td>
                    <td style={{ ...TD, fontSize: 11 }}>{r.hotel_fee > 0 ? `¥${r.hotel_fee.toLocaleString()}` : '—'}</td>
                    <td style={{ ...TD, fontSize: 11 }}>{r.shinkansen_fee > 0 ? `¥${r.shinkansen_fee.toLocaleString()}` : '—'}</td>
                    <td style={{ ...TD, fontSize: 10, maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                      {r.voucher ? (() => { const parts = r.voucher.split('|||'); const links = parts.filter(p => p.startsWith('http') || p.startsWith('data:')); const texts = parts.filter(p => !p.startsWith('http') && !p.startsWith('data:')); return <>{links.map((url, i) => <button key={i} onClick={() => { if(url.startsWith('data:')){const a=url.split(',');const m=a[0].match(/:(.*?);/)?.[1]??'application/pdf';const b=atob(a[1]);const n=b.length;const u=new Uint8Array(n);for(let j=0;j<n;j++)u[j]=b.charCodeAt(j);window.open(URL.createObjectURL(new Blob([u],{type:m})),'_blank')}else{window.open(url,'_blank')}}} style={{ color: 'var(--accent)', textDecoration: 'underline', fontSize: 10, display: 'block', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>🔗 PDF{links.length > 1 ? i+1 : ''}</button>)}{texts.length > 0 && <span style={{ color: 'var(--text-light)', fontSize: 10 }}>{texts.join(', ')}</span>}</> })() : <span style={{ color: 'var(--text-light)' }}>—</span>}
                    </td>
                <td style={{ ...TD, fontSize: 11 }} onClick={(e) => e.stopPropagation()}>
                  <ExtraExpenseCell items={r.extra_expenses ?? []} otherExp={r.other_exp ?? 0} />
                </td>
                    <td style={{ ...TD, background: 'var(--accent-bg)' }} onClick={e => e.stopPropagation()}>
                      {r.amount > 0 ? <strong style={{ color: 'var(--accent)', fontSize: 12 }}>¥{r.amount.toLocaleString()}</strong> : <span style={{ color: 'var(--text-light)', fontSize: 11 }}>未入力</span>}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>

      {hwReport && <HwPopup report={hwReport} onClose={() => setHwReport(null)} onSavePdf={onSavePdf} settings={settings} onUpdateReport={onUpdateReport} />}
      {editReport && <EditModal report={editReport} onClose={() => setEditReport(null)} onSave={onUpdateReport} onDelete={onDeleteReport} prices={prices} />}
    </div>
  )
}


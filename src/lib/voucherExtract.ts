// Voucher / 領収書PDFから立替金額（食事代・ホテル代金）を自動抽出する。
// - Voucher（文字情報あり）: "Meal allowance : Total JPY 2,500" などを読み取り
// - ホテル領収書（スキャン画像の場合あり）: 文字情報が無い／読めない場合はOCR(tesseract.js)で金額を読み取り
// すべてブラウザ内で処理し、PDFは外部へ送信しない（OCRエンジン/言語データのみCDNから取得）。

export interface VoucherExtract {
  meal: number
  hotel: number
  notes: string[]
}

const toNum = (s: string) => parseInt(s.replace(/[^\d]/g, ''), 10) || 0

/** Voucher/RECEIPTページのテキストから食事代・ホテル代を抽出 */
export function parseVoucherPageText(text: string): { isVoucher: boolean; meal: number; hotel: number } {
  const t = text.replace(/\s+/g, ' ')
  const isVoucher = /VOUCHER\s*\/?\s*RECEIPT/i.test(t)
  if (!isVoucher) return { isVoucher: false, meal: 0, hotel: 0 }
  let meal = 0
  let hotel = 0
  for (const m of t.matchAll(/Meal\s+allowance\s*:?\s*Total\s*JPY\s*([\d,\s]+\d)/gi)) meal += toNum(m[1])
  for (const m of t.matchAll(/(?:Hotel|Accommodation|Lodging|Room)[^:]{0,30}:?\s*Total\s*JPY\s*([\d,\s]+\d)/gi)) hotel += toNum(m[1])
  return { isVoucher, meal, hotel }
}

/** ホテル領収書らしいか */
export function looksLikeHotelReceipt(text: string): boolean {
  return /NAVIOS|HOTEL|ROOM\s*CH|STATEMENT|ご請求明細|宿泊|ホテル|RECEIPT/i.test(text) && /ROOM|HOTEL|NAVIOS|宿泊|ホテル/i.test(text)
}

/** 領収書テキストから合計金額を推定（キーワード行の最大値） */
export function parseReceiptAmount(text: string): number {
  const lines = text.split(/\n/)
  const keyword = /(CREDIT|AMOUNT|CONSUMPTION|GRAND\s*TOTAL|TOTAL|合計|請求金額|お支払|領収)/i
  const numRe = /\d{1,3}(?:\s*[,，、]\s*\d{3})+/g
  const yenRe = /[¥￥]\s*(\d{1,3}(?:\s*[,，、]\s*\d{3})+|\d{3,7})/g
  let best = 0
  for (const line of lines) {
    if (!keyword.test(line) && !/[¥￥]/.test(line)) continue
    for (const m of line.matchAll(numRe)) best = Math.max(best, toNum(m[0]))
    for (const m of line.matchAll(yenRe)) best = Math.max(best, toNum(m[1]))
  }
  return best
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const b64 = dataUrl.split(',')[1] ?? ''
  const bin = atob(b64.replace(/\s/g, ''))
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

const MAX_OCR_PAGES = 4

export async function extractVoucherAmounts(dataUrl: string): Promise<VoucherExtract> {
  const result: VoucherExtract = { meal: 0, hotel: 0, notes: [] }
  if (!dataUrl.startsWith('data:')) return result

  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const workerUrl = (await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

  const doc = await pdfjs.getDocument({ data: dataUrlToBytes(dataUrl) }).promise
  type OcrWorker = { recognize: (img: HTMLCanvasElement) => Promise<{ data: { text: string } }>; terminate: () => Promise<unknown> }
  let ocr: OcrWorker | null = null
  let ocrPages = 0

  try {
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p)
      const content = await page.getTextContent()
      const text = content.items
        .map((it) => { const i = it as { str?: string; hasEOL?: boolean }; return (i.str ?? '') + (i.hasEOL ? '\n' : ' ') })
        .join('')

      const v = parseVoucherPageText(text)
      if (v.isVoucher) {
        result.meal += v.meal
        result.hotel += v.hotel
        continue
      }

      // Voucher以外のページ：領収書として金額を探す（文字情報 → だめならOCR）
      let receiptText = text
      let amount = looksLikeHotelReceipt(receiptText) ? parseReceiptAmount(receiptText) : 0
      if (amount === 0 && ocrPages < MAX_OCR_PAGES) {
        ocrPages++
        try {
          const viewport = page.getViewport({ scale: 2 })
          const canvas = document.createElement('canvas')
          canvas.width = Math.floor(viewport.width)
          canvas.height = Math.floor(viewport.height)
          await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise
          if (!ocr) {
            const { createWorker } = await import('tesseract.js')
            ocr = (await createWorker('eng')) as unknown as OcrWorker
          }
          const { data } = await ocr.recognize(canvas)
          receiptText = receiptText + '\n' + data.text
          if (looksLikeHotelReceipt(receiptText)) amount = parseReceiptAmount(data.text)
        } catch (err) {
          result.notes.push(`${p}ページ目のOCRに失敗しました: ${(err as Error).message}`)
        }
      }
      if (amount > 0) result.hotel += amount
      else if (looksLikeHotelReceipt(receiptText)) result.notes.push(`${p}ページ目はホテル領収書のようですが金額を読み取れませんでした`)
    }
  } finally {
    if (ocr) { try { await ocr.terminate() } catch { /* ignore */ } }
    try { await doc.destroy() } catch { /* ignore */ }
  }
  return result
}

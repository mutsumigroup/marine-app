import { useEffect, useRef, useState } from 'react'

/**
 * PDFプレビュー用モーダル。
 * iframeでのネイティブPDF表示はスマホ（特にiOS）で画面幅に収まらず、
 * 横に見切れてしまうことがあるため、pdfjsでページをcanvasに描画し、
 * 必ず画面幅にフィットさせて表示する。
 */
export default function PdfPreviewModal({ src, onClose }: { src: string; onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const container = containerRef.current
    if (!container) return
    while (container.firstChild) container.removeChild(container.firstChild)
    setLoading(true)
    setError(null)

    ;(async () => {
      try {
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
        const workerUrl = (await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')).default
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

        const doc = await pdfjs.getDocument({ url: src }).promise
        if (cancelled) return

        const cssWidth = Math.min((container.clientWidth || window.innerWidth) - 16, 900)
        const dpr = Math.min(window.devicePixelRatio || 1, 2)

        for (let i = 1; i <= doc.numPages; i++) {
          if (cancelled) return
          const page = await doc.getPage(i)
          const baseViewport = page.getViewport({ scale: 1 })
          const scale = (cssWidth / baseViewport.width) * dpr
          const viewport = page.getViewport({ scale })

          const canvas = document.createElement('canvas')
          canvas.width = Math.ceil(viewport.width)
          canvas.height = Math.ceil(viewport.height)
          canvas.style.width = `${cssWidth}px`
          canvas.style.maxWidth = '100%'
          canvas.style.height = 'auto'
          canvas.style.display = 'block'
          canvas.style.margin = '0 auto 12px'
          canvas.style.boxShadow = '0 1px 6px rgba(0,0,0,0.3)'
          canvas.style.background = '#fff'

          const ctx = canvas.getContext('2d')
          if (!ctx) continue
          await page.render({ canvasContext: ctx, viewport }).promise
          if (cancelled) return
          container.appendChild(canvas)
        }
        if (!cancelled) setLoading(false)
      } catch (e) {
        console.error('PDFプレビュー描画エラー:', e)
        if (!cancelled) { setError('PDFを表示できませんでした'); setLoading(false) }
      }
    })()

    return () => { cancelled = true }
  }, [src])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column', background: '#525659' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#1e293b', color: '#fff', flexShrink: 0, paddingTop: 'max(10px, env(safe-area-inset-top))' }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>📄 PDFプレビュー</span>
        <button onClick={onClose}
          style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 20, padding: '6px 18px', cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
          ✕ 閉じる
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', position: 'relative', WebkitOverflowScrolling: 'touch' as any }}>
        {(loading || error) && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, padding: 20, textAlign: 'center' }}>
            {error ?? '読み込み中...'}
          </div>
        )}
        <div ref={containerRef} style={{ padding: '12px 8px' }} />
      </div>
    </div>
  )
}

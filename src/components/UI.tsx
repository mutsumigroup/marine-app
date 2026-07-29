import type { CSSProperties, ReactNode } from 'react'
import type { Toast } from '../types'

// スマホ判定フック
import { useState, useEffect } from 'react'
export function useIsMobile() {
  const [mobile, setMobile] = useState(window.innerWidth < 640)
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 640)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return mobile
}

export function Btn({ onClick, children, variant = 'default', size = 'md', disabled, type = 'button', style }: { onClick?: () => void; children: ReactNode; variant?: 'default' | 'primary' | 'success' | 'danger' | 'ghost'; size?: 'sm' | 'md'; disabled?: boolean; type?: 'button' | 'submit'; style?: CSSProperties }) {
  const base: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, cursor: disabled ? 'not-allowed' : 'pointer', borderRadius: 'var(--radius)', fontWeight: 500, whiteSpace: 'nowrap', transition: 'all .15s', opacity: disabled ? .55 : 1, border: '1px solid transparent', padding: size === 'sm' ? '4px 10px' : '7px 14px', fontSize: size === 'sm' ? 12 : 13 }
  const variants: Record<string, CSSProperties> = { default: { background: 'var(--surface)', border: '1px solid var(--border-dark)', color: 'var(--text)' }, primary: { background: 'var(--accent)', color: '#fff' }, success: { background: 'var(--success)', color: '#fff' }, danger: { background: 'var(--danger)', color: '#fff' }, ghost: { background: 'transparent', color: 'var(--text-muted)' } }
  return <button type={type} onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant], ...style }}>{children}</button>
}

export function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px 18px', boxShadow: 'var(--shadow)', marginBottom: 14, ...style }}>{children}</div>
}

export function CardTitle({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>{children}</div>
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10, marginBottom: 16 }}>{children}</div>
}

export function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: 'accent' | 'success' | 'warning' | 'danger' | 'purple' }) {
  const colors: Record<string, string> = { accent: 'var(--accent)', success: 'var(--success)', warning: 'var(--warning)', danger: 'var(--danger)', purple: 'var(--purple)' }
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 14px', boxShadow: 'var(--shadow)' }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 600, color: color ? colors[color] : 'var(--text)' }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--text-light)', marginTop: 1 }}>{sub}</div>}
    </div>
  )
}

type BadgeStatus = '未請求' | '作成済' | '送信済' | '入金待ち' | '入金済' | '請求済'
export function Badge({ status }: { status: BadgeStatus | string }) {
  const map: Record<string, [string, string, string]> = { 未請求: ['var(--warning-bg)', 'var(--warning)', 'var(--warning-border)'], 作成済: ['var(--purple-bg)', 'var(--purple)', '#ddd6fe'], 送信済: ['var(--accent-bg)', 'var(--accent)', 'var(--accent-border)'], 入金待ち: ['var(--danger-bg)', 'var(--danger)', 'var(--danger-border)'], 入金済: ['var(--success-bg)', 'var(--success)', 'var(--success-border)'], 請求済: ['var(--accent-bg)', 'var(--accent)', 'var(--accent-border)'] }
  const [bg, color, border] = map[status] ?? ['var(--bg)', 'var(--text-muted)', 'var(--border)']
  return <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 600, background: bg, color, border: `1px solid ${border}` }}>{status}</span>
}

export function Field({ label, children, required }: { label: string; children: ReactNode; required?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>{label}{required && <span style={{ color: 'var(--danger)', marginLeft: 2 }}>*</span>}</label>
      {children}
    </div>
  )
}

const inputStyle: CSSProperties = { padding: '8px 10px', border: '1px solid var(--border-dark)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14, width: '100%', outline: 'none', transition: 'border-color .15s' }
export function Input({ id, type = 'text', value, onChange, placeholder, min, step }: { id?: string; type?: string; value?: string | number; onChange?: (v: string) => void; placeholder?: string; min?: string; step?: string }) {
  return <input id={id} type={type} value={value} onChange={e => onChange?.(e.target.value)} placeholder={placeholder} min={min} step={step} style={inputStyle} onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)' }} onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-dark)' }} />
}

export function Select({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: ReactNode }) {
  return <select value={value} onChange={e => onChange(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>{children}</select>
}

export function Textarea({ value, onChange, placeholder, rows = 3 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows} style={{ ...inputStyle, resize: 'vertical', minHeight: 56 }} onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)' }} onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-dark)' }} />
}

export function Grid({ cols, children, style }: { cols: number; children: ReactNode; style?: CSSProperties }) {
  const isMobile = useIsMobile()
  const effectiveCols = isMobile ? Math.min(cols, 2) : cols
  return <div style={{ display: 'grid', gridTemplateColumns: `repeat(${effectiveCols},1fr)`, gap: 10, ...style }}>{children}</div>
}

export function Divider() {
  return <div style={{ height: 1, background: 'var(--border)', margin: '12px 0' }} />
}

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead><tr>{head.map(h => <th key={h} style={{ textAlign: 'left', padding: '7px 10px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

export function TR({ cells, badge, actions }: { cells: (string | ReactNode)[]; badge?: ReactNode; actions?: ReactNode }) {
  return (
    <tr style={{ borderBottom: '1px solid var(--border)' }} onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'var(--surface2)' }} onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = '' }}>
      {cells.map((c, i) => <td key={i} style={{ padding: '8px 10px', verticalAlign: 'middle' }}>{c}</td>)}
      {badge && <td style={{ padding: '8px 10px', verticalAlign: 'middle' }}>{badge}</td>}
      {actions && <td style={{ padding: '8px 10px', verticalAlign: 'middle' }}><div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{actions}</div></td>}
    </tr>
  )
}

export function Empty({ label }: { label: string }) {
  return <tr><td colSpan={20} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-light)', fontSize: 13 }}>{label}</td></tr>
}

export function ProgressBar({ value, color = 'var(--accent)' }: { value: number; color?: string }) {
  return <div style={{ background: 'var(--bg)', borderRadius: 999, height: 8 }}><div style={{ height: 8, borderRadius: 999, background: color, width: `${Math.min(100, value)}%`, transition: 'width .5s' }} /></div>
}

export function BarChart({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 110 }}>
      {data.map(d => (
        <div key={d.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>{d.value > 0 ? `${Math.round(d.value / 10000)}万` : ''}</span>
          <div style={{ width: '100%', background: 'var(--accent)', borderRadius: '2px 2px 0 0', opacity: .8, height: `${Math.max(2, Math.round(d.value / max * 80))}px`, minHeight: 2 }} />
          <span style={{ fontSize: 8, color: 'var(--text-light)', marginTop: 2 }}>{d.label}</span>
        </div>
      ))}
    </div>
  )
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 0 }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'var(--surface)', borderRadius: '16px 16px 0 0', padding: '20px 22px', width: '100%', maxWidth: 680, maxHeight: '92vh', overflowY: 'auto', boxShadow: 'var(--shadow-md)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)', lineHeight: 1 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function ToastContainer({ toasts, remove }: { toasts: Toast[]; remove: (id: string) => void }) {
  return (
    <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 400, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {toasts.map(t => {
        const colors: Record<string, [string, string]> = { success: ['var(--success-bg)', 'var(--success)'], error: ['var(--danger-bg)', 'var(--danger)'], info: ['var(--accent-bg)', 'var(--accent)'] }
        const [bg, color] = colors[t.type]
        return <div key={t.id} style={{ background: bg, color, border: `1px solid ${color}33`, borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 12, maxWidth: 360, display: 'flex', alignItems: 'flex-start', gap: 8, boxShadow: 'var(--shadow-md)', cursor: 'pointer' }} onClick={() => remove(t.id)}><span style={{ lineHeight: 1.5 }}>{t.message}</span></div>
      })}
    </div>
  )
}

export function LoadingSpinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 12 }}>
      <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Supabaseからデータを取得中...</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

export function PageHeader({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  const isMobile = useIsMobile()
  return (
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'flex-start', gap: isMobile ? 10 : 0, marginBottom: 18 }}>
      <div>
        <h1 style={{ fontSize: 17, fontWeight: 600, color: 'var(--text)' }}>{title}</h1>
        {sub && <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</p>}
      </div>
      {children && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', width: isMobile ? '100%' : 'auto' }}>{children}</div>}
    </div>
  )
}

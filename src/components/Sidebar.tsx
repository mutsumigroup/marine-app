import { useLocation, useNavigate } from 'react-router-dom'
import { useIsMobile } from './UI'

const NAV = [
  { group: 'メイン', items: [
    { path: '/', label: 'ダッシュボード', icon: '⊞' },
  ]},
  { group: '日報作成', items: [
    { path: '/daily', label: '日報作成', icon: '📝' },
    { path: '/reports', label: '日報一覧', icon: '📋' },
  ]},
  { group: '売上・請求', items: [
    { path: '/invoices', label: '請求書管理', icon: '🧾' },
    { path: '/payments', label: '入金管理', icon: '💴' },
  ]},
  { group: '設定', items: [
    { path: '/settings', label: '設定', icon: '⚙️' },
  ]},
]

export default function Sidebar({ open, onClose, collapsed, onToggle }: { open?: boolean; onClose?: () => void; collapsed?: boolean; onToggle?: () => void }) {
  const location = useLocation()
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  const handleNav = (path: string) => {
    navigate(path)
    if (isMobile && onClose) onClose()
  }

  const navContent = (
    <nav style={{ width: 190, background: 'var(--surface2)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto', height: '100vh' }}>
      <div style={{ padding: '14px 14px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)' }}>日報作成</div>
          <div style={{ fontSize: 10, color: 'var(--text-light)', marginTop: 2 }}>船舶業務管理システム</div>
        </div>
        {isMobile && (
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
        )}
      </div>
      {NAV.map(group => (
        <div key={group.group} style={{ padding: '10px 0 4px' }}>
          <div style={{ fontSize: 9, color: 'var(--text-light)', padding: '0 14px 4px', letterSpacing: '.5px', textTransform: 'uppercase', fontWeight: 600 }}>{group.group}</div>
          {group.items.map(item => {
            const active = location.pathname === item.path
            return (
              <div key={item.path} onClick={() => handleNav(item.path)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', fontSize: 13, cursor: 'pointer', borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent', background: active ? 'var(--accent-bg)' : 'transparent', color: active ? 'var(--accent)' : 'var(--text-muted)', fontWeight: active ? 600 : 400, transition: 'all .12s' }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLDivElement).style.background = 'var(--surface2)' }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}>
                <span style={{ fontSize: 16 }}>{item.icon}</span>
                {item.label}
              </div>
            )
          })}
        </div>
      ))}
      <div style={{ marginTop: 'auto', padding: '10px 14px', borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: 10, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />
          Supabase 接続中
        </div>
      </div>
    </nav>
  )

  if (isMobile) {
    if (!open) return null
    return (
      <>
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 490 }} />
        <div style={{ position: 'fixed', top: 0, left: 0, zIndex: 500, height: '100vh' }}>
          {navContent}
        </div>
      </>
    )
  }

  if (collapsed) {
    return (
      <div style={{ width: 0, flexShrink: 0, position: 'relative' }}>
        <button
          onClick={onToggle}
          title="サイドバーを開く"
          style={{ position: 'fixed', top: 14, left: 0, zIndex: 100, background: 'var(--surface2)', border: '1px solid var(--border)', borderLeft: 'none', borderRadius: '0 6px 6px 0', padding: '8px 6px', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14, lineHeight: 1 }}>
          ▶
        </button>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      {navContent}
      <button
        onClick={onToggle}
        title="サイドバーを閉じる"
        style={{ position: 'absolute', top: 14, right: -12, zIndex: 100, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer', color: 'var(--text-muted)', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, lineHeight: 1 }}>
        ◀
      </button>
    </div>
  )
}

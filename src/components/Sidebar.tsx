import { useLocation, useNavigate } from 'react-router-dom'
import { useIsMobile } from './UI'

const NAV = [
  { group: 'メイン', items: [
    { path: '/', label: 'ダッシュボード', icon: '⊞' },
    { path: '/ky/new', label: 'KY出発前報告', icon: '🚦' },
    { path: '/ky', label: 'KY報告一覧', icon: '📋' },
    { path: '/daily', label: '日報作成', icon: '📝' },
    { path: '/reports', label: '日報一覧', icon: '📋' },
  ]},
  { group: '売上・請求', items: [
    { path: '/invoices', label: '請求書管理', icon: '🧾' },
    { path: '/payments', label: '入金管理', icon: '💴' },
    { path: '/annual', label: '目標報酬内訳', icon: '🎯' },
  ]},
  { group: '設定', items: [
    { path: '/ports', label: '港マスター', icon: '⚓️' },
    { path: '/settings', label: '設定', icon: '⚙️' },
  ]},
]

export default function Sidebar({ open, onClose }: { open?: boolean; onClose?: () => void }) {
  const location = useLocation()
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  const handleNav = (path: string) => {
    navigate(path)
    if (isMobile && onClose) onClose()
  }

  const navContent = (
    <nav style={{ width: 190, background: 'var(--surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto', height: '100vh' }}>
      <div style={{ padding: '14px 14px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)', display: 'flex', alignItems: 'center', gap: 6 }}>⚓ 船舶日報報告管理アプリ</div>
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

  return navContent
}

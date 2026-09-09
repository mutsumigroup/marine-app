import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/UI'

export default function DailyMenu() {
  const navigate = useNavigate()

  const cards = [
    {
      path: '/daily/ship',
      icon: '🚢',
      title: '船泊日報作成',
      desc: '既存の船舶業務日報を作成します。\n港名・船名・対応区分・費用を記録。',
      badge: '既存機能',
      badgeColor: '#e3f0fd',
      badgeText: '#1a5fa8',
    },
    {
      path: '/transport/new',
      icon: '🚗',
      title: '送迎日報作成',
      desc: '二種免許を使用した送迎業務の日報を作成します。\n出発・到着エリアで旅客運送手当を自動計算。',
      badge: 'NEW',
      badgeColor: '#d4edda',
      badgeText: '#155724',
    },
  ]

  return (
    <div style={{ padding: '20px 22px' }}>
      <PageHeader title="日報作成" sub="業務種別を選択してください" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 800 }}>
        {cards.map(card => (
          <div
            key={card.path}
            onClick={() => navigate(card.path)}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: '22px 24px',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLDivElement
              el.style.borderColor = 'var(--accent)'
              el.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)'
              el.style.transform = 'translateY(-1px)'
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLDivElement
              el.style.borderColor = 'var(--border)'
              el.style.boxShadow = 'none'
              el.style.transform = 'none'
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 12 }}>{card.icon}</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
              {card.title}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 14, whiteSpace: 'pre-line' }}>
              {card.desc}
            </div>
            <span style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '3px 10px', borderRadius: 12,
              fontSize: 11, fontWeight: 600,
              background: card.badgeColor, color: card.badgeText,
            }}>
              {card.badge}
            </span>
          </div>
        ))}
      </div>
      <div style={{
        marginTop: 16, padding: '10px 14px',
        background: '#e8f4fd', border: '1px solid #bee3f8',
        borderRadius: 8, fontSize: 12, color: '#2b6cb0', maxWidth: 800,
      }}>
        💡 船泊・送迎の日報はそれぞれ独立して管理されます。「日報一覧」でまとめて確認できます。
      </div>
    </div>
  )
}

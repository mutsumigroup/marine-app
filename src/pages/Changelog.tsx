import { Card, CardTitle, PageHeader, useIsMobile } from '../components/UI'
import { CHANGELOG, APP_VERSION } from '../lib/changelog'

export default function Changelog() {
  const isMobile = useIsMobile()
  return (
    <div style={{ padding: isMobile ? '16px' : '20px 22px' }}>
      <PageHeader title="更新履歴" sub={`現在のバージョン: v${APP_VERSION}`} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {CHANGELOG.map(entry => (
          <Card key={entry.version}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
              <CardTitle>v{entry.version}</CardTitle>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{entry.date}</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {entry.changes.map((c, i) => (
                <li key={i} style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{c}</li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  )
}

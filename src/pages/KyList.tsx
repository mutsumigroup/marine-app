import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, PageHeader, Btn, useIsMobile } from '../components/UI'
import type { KyReport } from '../types'

interface Props {
  kyReports: KyReport[]
  onDelete: (id: string) => Promise<boolean>
}

export default function KyList({ kyReports, onDelete }: Props) {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const handleDelete = async (id: string) => {
    await onDelete(id)
    setConfirmId(null)
  }

  const handleGoToDaily = (ky: KyReport) => {
    const prefill = { date: ky.date, port: ky.port, ship: ky.ship, crew: ky.crew, category: ky.category, work: ky.work, ky_id: ky.id }
    sessionStorage.setItem('ky_prefill', JSON.stringify(prefill))
    navigate('/daily')
  }

  return (
    <div style={{ padding: isMobile ? '16px' : '24px 32px' }}>
      <PageHeader title="🚦 KY出発前報告 一覧" sub={`${kyReports.length}件`} />
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <Btn onClick={() => navigate('/ky/new')}>＋ 新規KY報告</Btn>
      </div>
      {kyReports.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🚦</div>
          <div>KY出発前報告はまだありません</div>
          <Btn onClick={() => navigate('/ky/new')} style={{ marginTop: 16 }}>最初のKY報告を作成</Btn>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {kyReports.map(ky => (
            <Card key={ky.id} style={{ padding: '14px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{ky.date}</span>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{ky.port}</span>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>🚢 {ky.ship}</span>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'var(--accent-bg)', color: 'var(--accent)', fontWeight: 600 }}>{ky.category}</span>
                    {ky.notes_confirmed && (
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#D1FAE5', color: '#15803D', fontWeight: 600 }}>✅ 注意事項確認済</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                    👤 {ky.operator_name}　👥 {ky.crew}名
                  </div>
                  {ky.work && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                      {ky.work.length > 100 ? ky.work.slice(0, 100) + '...' : ky.work}
                    </div>
                  )}
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6 }}>
                    送信：{ky.submitted_at}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                  {!ky.report_id && (
                    <button
                      onClick={() => handleGoToDaily(ky)}
                      style={{ fontSize: 11, padding: '5px 10px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}
                    >
                      📝 日報を作成
                    </button>
                  )}
                  {ky.report_id && (
                    <span style={{ fontSize: 11, padding: '5px 10px', borderRadius: 6, background: '#D1FAE5', color: '#15803D', fontWeight: 600, textAlign: 'center', whiteSpace: 'nowrap' }}>
                      ✅ 日報連携済
                    </span>
                  )}
                  {confirmId === ky.id ? (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => handleDelete(ky.id)} style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: 'none', background: '#DC2626', color: '#fff', cursor: 'pointer' }}>削除</button>
                      <button onClick={() => setConfirmId(null)} style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer' }}>取消</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmId(ky.id)} style={{ fontSize: 11, padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)', cursor: 'pointer' }}>削除</button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

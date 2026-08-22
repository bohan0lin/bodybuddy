import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../data/store'

export default function History() {
  const { weightLogs } = useStore()
  const navigate = useNavigate()

  const history = useMemo(
    () => [...weightLogs].sort((a, b) => b.date.localeCompare(a.date)),
    [weightLogs],
  )

  return (
    <div className="page">
      <button
        className="btn-ghost"
        onClick={() => navigate('/body')}
        style={{ padding: 0, marginBottom: 22, fontSize: 14, color: 'var(--text-dim)' }}
      >
        ‹ 体重趋势
      </button>

      <div className="card">
        <p className="card-label">历史记录</p>
        {history.length === 0 ? (
          <div className="empty">还没有记录</div>
        ) : (
          history.map((w) => (
            <div key={w.id} className="list-row" style={{ justifyContent: 'space-between' }}>
              <span className="muted num" style={{ fontSize: 14 }}>{w.date}</span>
              <span className="num">
                <b style={{ fontWeight: 500 }}>{w.weight}</b> <span className="muted" style={{ fontSize: 13 }}>kg</span>
                {w.bodyFat != null && <span className="muted" style={{ fontSize: 13 }}> · {w.bodyFat}%</span>}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

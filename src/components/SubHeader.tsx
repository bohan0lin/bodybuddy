import { useNavigate } from 'react-router-dom'
import { useT } from '../lib/i18n'

// 「我的」子页统一头部：返回我的 + 标题
export default function SubHeader({ title }: { title: string }) {
  const navigate = useNavigate()
  const { t } = useT()
  return (
    <>
      <button className="btn-ghost" onClick={() => navigate('/settings')} style={{ padding: 0, fontSize: 14, color: 'var(--text-dim)' }}>
        {t('common.backMe')}
      </button>
      <p className="eyebrow" style={{ margin: '20px 0 22px' }}>{title}</p>
    </>
  )
}

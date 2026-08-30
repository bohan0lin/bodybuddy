import { useT } from '../lib/i18n'

// 知识库（占位）：批次 4 实现按人分库 + 文字/图片添加
export default function Knowledge() {
  const { t } = useT()
  return (
    <div className="page">
      <p className="eyebrow" style={{ marginBottom: 28 }}>{t('knowledge.title')}</p>
      <div className="card" style={{ textAlign: 'center', padding: '40px 22px' }}>
        <div style={{ fontSize: 30, marginBottom: 14 }}>✦</div>
        <p className="muted" style={{ fontSize: 14, lineHeight: 1.7, margin: 0 }}>{t('knowledge.soon')}</p>
      </div>
    </div>
  )
}

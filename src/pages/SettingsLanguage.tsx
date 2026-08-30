import { useNavigate } from 'react-router-dom'
import { useT, type Lang } from '../lib/i18n'
import SubHeader from '../components/SubHeader'
import PickerList from '../components/PickerList'

export default function SettingsLanguage() {
  const { t, lang, setLang } = useT()
  const navigate = useNavigate()
  return (
    <div className="page">
      <SubHeader title={t('settings.language')} />
      <PickerList<Lang>
        current={lang}
        options={[
          { key: 'zh', label: '中文' },
          { key: 'en', label: 'English' },
        ]}
        onPick={(k) => {
          setLang(k)
          navigate('/settings')
        }}
      />
    </div>
  )
}

import { useNavigate } from 'react-router-dom'
import { useT } from '../lib/i18n'
import { usePrefs, type Theme } from '../lib/prefs'
import SubHeader from '../components/SubHeader'
import PickerList from '../components/PickerList'

export default function SettingsTheme() {
  const { t } = useT()
  const { theme, setTheme } = usePrefs()
  const navigate = useNavigate()
  return (
    <div className="page">
      <SubHeader title={t('settings.theme')} />
      <PickerList<Theme>
        current={theme}
        options={[
          { key: 'system', label: t('theme.system') },
          { key: 'light', label: t('theme.light') },
          { key: 'dark', label: t('theme.dark') },
        ]}
        onPick={(k) => {
          setTheme(k)
          navigate('/settings')
        }}
      />
    </div>
  )
}

import { useNavigate } from 'react-router-dom'
import { useT } from '../lib/i18n'
import { usePrefs, type EnergyUnit } from '../lib/prefs'
import SubHeader from '../components/SubHeader'
import PickerList from '../components/PickerList'

export default function SettingsEnergy() {
  const { t } = useT()
  const { energyUnit, setEnergyUnit } = usePrefs()
  const navigate = useNavigate()
  return (
    <div className="page">
      <SubHeader title={t('settings.energyUnit')} />
      <PickerList<EnergyUnit>
        current={energyUnit}
        options={[
          { key: 'kcal', label: t('energy.kcal') },
          { key: 'kJ', label: t('energy.kJ') },
        ]}
        onPick={(k) => {
          setEnergyUnit(k)
          navigate('/settings')
        }}
      />
    </div>
  )
}

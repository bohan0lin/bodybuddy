// 通用选项列表：当前项打勾，点选即回调
interface Props<T extends string> {
  options: { key: T; label: string }[]
  current: T
  onPick: (key: T) => void
}

export default function PickerList<T extends string>({ options, current, onPick }: Props<T>) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden' }}>
      {options.map((o, i) => (
        <button
          key={o.key}
          onClick={() => onPick(o.key)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '15px 16px',
            background: 'transparent',
            borderBottom: i === options.length - 1 ? 'none' : '1px solid var(--line)',
            textAlign: 'left',
            cursor: 'pointer',
            color: current === o.key ? 'var(--accent)' : 'var(--text)',
            fontSize: 15,
            fontWeight: current === o.key ? 600 : 400,
          }}
        >
          <span>{o.label}</span>
          {current === o.key && <span style={{ fontSize: 16 }}>✓</span>}
        </button>
      ))}
    </div>
  )
}

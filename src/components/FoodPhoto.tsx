import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import AppIcon from './AppIcon'

export default function FoodPhoto({ path, alt, className = '' }: { path?: string; alt: string; className?: string }) {
  const [signed, setSigned] = useState({ path: '', url: '' })
  const [failed, setFailed] = useState('')
  const direct = path && /^(data:image\/|https:\/\/)/.test(path)
  const url = direct ? path : signed.path === path ? signed.url : ''
  useEffect(() => {
    let alive = true
    if (!path || direct) return
    const refresh = () => {
      void supabase.storage.from('food-photos').createSignedUrl(path, 3600).then(({ data }) => {
        if (alive) setSigned({ path, url: data?.signedUrl ?? '' })
      }).catch(() => { if (alive) setSigned({ path, url: '' }) })
    }
    refresh()
    const timer = setInterval(refresh, 50 * 60 * 1000)
    return () => { alive = false; clearInterval(timer) }
  }, [path, direct])
  return <span className={`food-photo ${className}`}>
    {url && failed !== url ? <img src={url} alt={alt} onError={() => setFailed(url)} /> : <AppIcon name="utensils" size={24} />}
  </span>
}

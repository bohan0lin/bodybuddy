// WebKit can leave the document panned after dismissing the software keyboard.
// Restore only document scrolling; never size the shell from visualViewport.
export function installKeyboardRecovery(): () => void {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  if (!ios) return () => {}
  const viewport = window.visualViewport
  let active = false
  let shrunk = false
  let fullHeight = 0
  let width = window.innerWidth
  let frame = 0
  const timers = new Set<ReturnType<typeof setTimeout>>()
  const editing = () => document.activeElement instanceof HTMLElement
    && document.activeElement.matches('textarea, input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="file"]):not([type="range"]):not([type="color"]), [contenteditable="true"], [contenteditable=""]')

  function recover() {
    frame = 0
    if (!active || document.visibilityState === 'hidden' || (viewport && Math.abs(viewport.scale - 1) > 0.01)) return
    // Rotation is not keyboard dismissal; discard the old orientation's baseline.
    if (window.innerWidth !== width) {
      width = window.innerWidth
      fullHeight = Math.max(window.innerHeight, document.documentElement.clientHeight)
      shrunk = false
    }
    const height = viewport?.height ?? window.innerHeight
    if (editing()) {
      if (fullHeight - height > 100) { shrunk = true; return }
      // The keyboard's Done button can leave the input focused.
      if (!shrunk || height < fullHeight - 2) return
    }
    // Write even if scrollY is zero: WebKit's visual offset can still be stale.
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }
  function schedule() {
    if (active && !frame) frame = requestAnimationFrame(recover)
  }
  function clearTimers() { timers.forEach(clearTimeout); timers.clear() }
  function settle() {
    if (!active) return
    clearTimers()
    // Several bounded checks cover delayed keyboard animation and viewport events.
    for (const ms of [150, 400, 800, 1200]) {
      const timer = setTimeout(() => { timers.delete(timer); schedule() }, ms)
      timers.add(timer)
    }
  }
  function focus() {
    if (!editing()) return
    clearTimers()
    if (!active) {
      fullHeight = Math.max(window.innerHeight, document.documentElement.clientHeight, viewport?.height ?? 0)
      width = window.innerWidth
    }
    active = true
  }
  function outsideTap(event: MouseEvent) {
    if (!editing() || !(event.target instanceof Element)) return
    // Safari can dismiss its keyboard on a blank tap while retaining DOM focus.
    // Explicitly release focus so delayed recovery is not mistaken for typing.
    if (event.target.closest('input, textarea, select, button, a, label, [role="button"], [contenteditable]')) return
    if (window.getSelection()?.toString()) return
    ;(document.activeElement as HTMLElement).blur()
  }
  document.addEventListener('focusin', focus)
  document.addEventListener('focusout', settle)
  document.addEventListener('click', outsideTap)
  document.addEventListener('visibilitychange', settle)
  window.addEventListener('pageshow', settle)
  window.addEventListener('resize', schedule)
  viewport?.addEventListener('resize', schedule)
  // No scroll listener: correction must not create a self-triggering loop.
  return () => {
    clearTimers()
    cancelAnimationFrame(frame)
    document.removeEventListener('focusin', focus)
    document.removeEventListener('focusout', settle)
    document.removeEventListener('click', outsideTap)
    document.removeEventListener('visibilitychange', settle)
    window.removeEventListener('pageshow', settle)
    window.removeEventListener('resize', schedule)
    viewport?.removeEventListener('resize', schedule)
  }
}

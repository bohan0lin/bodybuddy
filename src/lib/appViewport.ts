// Mobile keyboards can resize and pan the visual viewport without changing dvh.
export function trackAppViewport(shell: HTMLElement): () => void {
  const viewport = window.visualViewport
  let frame = 0
  let settling: ReturnType<typeof setTimeout> | undefined

  function sync() {
    frame = 0
    // Preserve native pinch zoom instead of treating it as a keyboard resize.
    if (viewport && Math.abs(viewport.scale - 1) > 0.01) return
    const height = viewport?.height ?? window.innerHeight
    if (height <= 0) return
    shell.style.setProperty('--visible-app-height', `${height}px`)
    shell.style.setProperty('--visible-app-top', `${viewport?.offsetTop ?? 0}px`)
    // Content scrolls inside the shell; document scrolling is keyboard residue.
    if (height >= window.innerHeight - 1 && window.scrollY !== 0) {
      window.scrollTo(0, 0)
    }
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(sync)
  }

  function settle() {
    schedule()
    clearTimeout(settling)
    // Read again after the keyboard animation, including browsers with late geometry updates.
    settling = setTimeout(() => {
      // iOS standalone mode can retain document panning after the input blurs.
      // Reset only the document, never the user's scroll position inside the page.
      const editing = document.activeElement?.matches('input, textarea, [contenteditable="true"]')
      if (!editing && (!viewport || Math.abs(viewport.scale - 1) <= 0.01) && window.scrollY !== 0) window.scrollTo(0, 0)
      schedule()
    }, 400)
  }

  sync()
  viewport?.addEventListener('resize', schedule)
  viewport?.addEventListener('scroll', schedule)
  window.addEventListener('resize', settle)
  window.addEventListener('orientationchange', settle)
  window.addEventListener('pageshow', settle)
  document.addEventListener('focusin', settle)
  document.addEventListener('focusout', settle)
  document.addEventListener('visibilitychange', settle)
  return () => {
    cancelAnimationFrame(frame)
    clearTimeout(settling)
    viewport?.removeEventListener('resize', schedule)
    viewport?.removeEventListener('scroll', schedule)
    window.removeEventListener('resize', settle)
    window.removeEventListener('orientationchange', settle)
    window.removeEventListener('pageshow', settle)
    document.removeEventListener('focusin', settle)
    document.removeEventListener('focusout', settle)
    document.removeEventListener('visibilitychange', settle)
    shell.style.removeProperty('--visible-app-height')
    shell.style.removeProperty('--visible-app-top')
  }
}

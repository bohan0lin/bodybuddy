// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { installKeyboardRecovery } from './keyboardRecovery'

let stop: () => void
let viewport: EventTarget & { height: number; scale: number }
let scroll: ReturnType<typeof vi.fn>
beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('iPhone')
  viewport = Object.assign(new EventTarget(), { height: 800, scale: 1 })
  vi.stubGlobal('visualViewport', viewport)
  vi.stubGlobal('innerHeight', 800)
  vi.stubGlobal('innerWidth', 390)
  scroll = vi.fn()
  vi.stubGlobal('scrollTo', scroll)
  document.body.innerHTML = '<main style="overflow:auto"><input><textarea></textarea></main><button>Done</button>'
  stop = installKeyboardRecovery()
})
afterEach(() => { stop(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.innerHTML = '' })
function open() {
  document.querySelector('input')!.focus()
  viewport.height = 450
  viewport.dispatchEvent(new Event('resize'))
  vi.advanceTimersByTime(20)
}

it('does not resize or scroll on launch, or while the keyboard is open', () => {
  viewport.dispatchEvent(new Event('resize'))
  vi.advanceTimersByTime(1000)
  expect(scroll).not.toHaveBeenCalled()
  open()
  expect(scroll).not.toHaveBeenCalled()
  expect(document.documentElement.style.height).toBe('')
})

it('restores document offsets after blur while retaining internal page scrolling', () => {
  open()
  const main = document.querySelector('main')!
  main.scrollTop = 125
  document.documentElement.scrollTop = 80
  document.body.scrollTop = 80
  document.querySelector('input')!.blur()
  vi.advanceTimersByTime(450)
  expect(scroll).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' })
  expect(document.documentElement.scrollTop).toBe(0)
  expect(document.body.scrollTop).toBe(0)
  expect(main.scrollTop).toBe(125)
})

it('handles keyboard dismissal without blur and zero reported document scroll', () => {
  open()
  viewport.height = 800
  viewport.dispatchEvent(new Event('resize'))
  vi.advanceTimersByTime(20)
  expect(document.activeElement).toBe(document.querySelector('input'))
  expect(scroll).toHaveBeenCalledOnce()
})

it('does not snap the page when moving between inputs with an open keyboard', () => {
  open()
  document.querySelector('textarea')!.focus()
  vi.advanceTimersByTime(1000)
  expect(scroll).not.toHaveBeenCalled()
})

it('releases stale input focus on a blank tap and recovers after the animation', () => {
  open()
  document.querySelector('main')!.click()
  expect(document.activeElement).toBe(document.body)
  vi.advanceTimersByTime(1250)
  expect(scroll).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' })
})

it('does not blur controls on interactive taps or while selecting text', () => {
  open()
  document.querySelector('button')!.click()
  expect(document.activeElement).toBe(document.querySelector('input'))
  vi.spyOn(window, 'getSelection').mockReturnValue({ toString: () => 'selected' } as Selection)
  document.querySelector('main')!.click()
  expect(document.activeElement).toBe(document.querySelector('input'))
  expect(scroll).not.toHaveBeenCalled()
})

it('does not interfere with zoom or misread rotation as keyboard dismissal', () => {
  open()
  viewport.height = 800
  viewport.scale = 2
  viewport.dispatchEvent(new Event('resize'))
  vi.advanceTimersByTime(20)
  expect(scroll).not.toHaveBeenCalled()
  viewport.scale = 1
  vi.stubGlobal('innerWidth', 800)
  viewport.dispatchEvent(new Event('resize'))
  vi.advanceTimersByTime(20)
  expect(scroll).not.toHaveBeenCalled()
})

it('removes listeners and pending recovery when unmounted', () => {
  open()
  document.querySelector('input')!.blur()
  stop()
  viewport.height = 800
  viewport.dispatchEvent(new Event('resize'))
  vi.advanceTimersByTime(1000)
  expect(scroll).not.toHaveBeenCalled()
})

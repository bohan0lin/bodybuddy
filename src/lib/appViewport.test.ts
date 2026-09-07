// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { trackAppViewport } from './appViewport'

let viewport: EventTarget & { height: number; offsetTop: number; scale: number }
let shell: HTMLDivElement
let stop: (() => void) | undefined
beforeEach(() => {
  vi.useFakeTimers()
  viewport = Object.assign(new EventTarget(), { height: 800, offsetTop: 0, scale: 1 })
  vi.stubGlobal('visualViewport', viewport)
  vi.stubGlobal('innerHeight', 800)
  vi.stubGlobal('scrollY', 0)
  vi.stubGlobal('scrollTo', vi.fn())
  shell = document.createElement('div')
})
afterEach(() => { stop?.(); stop = undefined; vi.useRealTimers(); vi.unstubAllGlobals() })
const flush = () => vi.advanceTimersByTime(20)

it('tracks keyboard height and panning when the layout viewport does not resize', () => {
  stop = trackAppViewport(shell)
  viewport.height = 460
  viewport.offsetTop = 55
  viewport.dispatchEvent(new Event('resize'))
  viewport.dispatchEvent(new Event('scroll'))
  flush()
  expect(window.innerHeight).toBe(800)
  expect(shell.style.getPropertyValue('--visible-app-height')).toBe('460px')
  expect(shell.style.getPropertyValue('--visible-app-top')).toBe('55px')
})

it('restores full height and clears document scrolling after keyboard dismissal', () => {
  viewport.height = 460
  stop = trackAppViewport(shell)
  viewport.height = 800
  vi.stubGlobal('scrollY', 90)
  viewport.dispatchEvent(new Event('resize'))
  flush()
  expect(shell.style.getPropertyValue('--visible-app-height')).toBe('800px')
  expect(window.scrollTo).toHaveBeenCalledWith(0, 0)
})

it('rereads late keyboard geometry after focus leaves an input', () => {
  viewport.height = 460
  stop = trackAppViewport(shell)
  document.dispatchEvent(new Event('focusout'))
  flush()
  viewport.height = 800
  vi.advanceTimersByTime(420)
  expect(shell.style.getPropertyValue('--visible-app-height')).toBe('800px')
})

it('preserves pinch zoom and supports browsers without visualViewport', () => {
  stop = trackAppViewport(shell)
  viewport.scale = 2
  viewport.height = 400
  viewport.dispatchEvent(new Event('resize'))
  flush()
  expect(shell.style.getPropertyValue('--visible-app-height')).toBe('800px')
  stop()
  vi.stubGlobal('visualViewport', undefined)
  stop = trackAppViewport(shell)
  expect(shell.style.getPropertyValue('--visible-app-height')).toBe('800px')
})

it('clears stale standalone document panning after blur even before viewport height recovers', () => {
  viewport.height = 460
  vi.stubGlobal('scrollY', 120)
  stop = trackAppViewport(shell)
  document.dispatchEvent(new Event('focusout'))
  vi.advanceTimersByTime(420)
  expect(window.scrollTo).toHaveBeenCalledWith(0, 0)
})

it('removes listeners and pending work on unmount', () => {
  stop = trackAppViewport(shell)
  document.dispatchEvent(new Event('focusout'))
  stop()
  stop = undefined
  viewport.dispatchEvent(new Event('resize'))
  vi.runAllTimers()
  expect(shell.style.getPropertyValue('--visible-app-height')).toBe('')
  expect(shell.style.getPropertyValue('--visible-app-top')).toBe('')
})

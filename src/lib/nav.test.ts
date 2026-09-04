import { describe, it, expect } from 'vitest'
import { activeTabKey } from './nav'

describe('activeTabKey (route-family navigation state)', () => {
  it('marks Today only on the exact home path', () => {
    expect(activeTabKey('/')).toBe('today')
  })
  it('keeps Calendar active while viewing a day', () => {
    expect(activeTabKey('/calendar')).toBe('calendar')
    expect(activeTabKey('/day/2026-09-04')).toBe('calendar')
    expect(activeTabKey('/history')).toBe('calendar')
  })
  it('keeps Me active on settings subroutes and body', () => {
    expect(activeTabKey('/settings')).toBe('me')
    expect(activeTabKey('/settings/targets')).toBe('me')
    expect(activeTabKey('/settings/profile')).toBe('me')
    expect(activeTabKey('/body')).toBe('me')
  })
  it('maps Knowledge to Coach', () => {
    expect(activeTabKey('/coach')).toBe('coach')
    expect(activeTabKey('/knowledge')).toBe('coach')
  })
  it('shows no active tab for the logging flows', () => {
    expect(activeTabKey('/log')).toBeNull()
    expect(activeTabKey('/workout')).toBeNull()
  })
})

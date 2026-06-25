import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProfileSettings from './ProfileSettings.jsx'

const mockCheckUserAuth = vi.fn()

vi.mock('../../../hooks/useAuth.js', () => ({
  useAuth: () => ({
    user: {
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
    },
    checkUserAuth: mockCheckUserAuth,
  }),
}))

vi.mock('../../Layout/Toast/Toast.jsx', () => ({
  default: () => null,
}))

describe('ProfileSettings custom cursor preference', () => {
  beforeEach(() => {
    localStorage.clear()
    document.body.classList.remove('theme-custom-cursor')
    mockCheckUserAuth.mockReset()
  })

  it('defaults to themed cursors disabled when no preference is stored', () => {
    render(<ProfileSettings />)

    expect(screen.getByLabelText('Enable Themed Cursors').checked).toBe(false)
    expect(document.body.classList.contains('theme-custom-cursor')).toBe(false)
    expect(localStorage.getItem('customCursor')).toBe('false')
  })

  it('restores a saved themed cursor preference on mount', () => {
    localStorage.setItem('customCursor', 'true')

    render(<ProfileSettings />)

    expect(screen.getByLabelText('Enable Themed Cursors').checked).toBe(true)
    expect(document.body.classList.contains('theme-custom-cursor')).toBe(true)
    expect(localStorage.getItem('customCursor')).toBe('true')
  })

  it('removes themed cursors and persists the new preference when toggled off', () => {
    localStorage.setItem('customCursor', 'true')

    render(<ProfileSettings />)

    fireEvent.click(screen.getByLabelText('Enable Themed Cursors'))

    expect(screen.getByLabelText('Enable Themed Cursors').checked).toBe(false)
    expect(document.body.classList.contains('theme-custom-cursor')).toBe(false)
    expect(localStorage.getItem('customCursor')).toBe('false')
  })
})

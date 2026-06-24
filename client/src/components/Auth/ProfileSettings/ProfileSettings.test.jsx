import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProfileSettings from './ProfileSettings.jsx'

const mockCheckUserAuth = vi.fn()
const mockUseAuth = vi.fn()

vi.mock('../../../hooks/useAuth.js', () => ({
  useAuth: () => mockUseAuth(),
}))

describe('ProfileSettings', () => {
  beforeEach(() => {
    localStorage.clear()
    document.body.className = ''
    mockCheckUserAuth.mockReset()
    mockUseAuth.mockReset()
    mockUseAuth.mockReturnValue({
      user: {
        firstName: 'Ava',
        lastName: 'Baker',
        email: 'ava@example.com',
      },
      checkUserAuth: mockCheckUserAuth,
    })
    vi.restoreAllMocks()
  })

  it('loads custom cursor preference from localStorage', async () => {
    localStorage.setItem('customCursor', 'true')

    render(<ProfileSettings />)

    expect(
      screen.getByRole('checkbox', { name: /enable themed cursors/i })
    ).toBeChecked()

    await waitFor(() =>
      expect(document.body).toHaveClass('theme-custom-cursor')
    )
  })

  it('updates body class and localStorage when cursor toggle changes', async () => {
    render(<ProfileSettings />)
    const toggle = screen.getByRole('checkbox', {
      name: /enable themed cursors/i,
    })

    expect(toggle).not.toBeChecked()
    expect(localStorage.getItem('customCursor')).toBe('false')

    await userEvent.click(toggle)

    expect(toggle).toBeChecked()
    await waitFor(() =>
      expect(document.body).toHaveClass('theme-custom-cursor')
    )
    expect(localStorage.getItem('customCursor')).toBe('true')
  })

  it('blocks submit when password confirmation does not match', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    render(<ProfileSettings />)

    await userEvent.type(screen.getByLabelText(/new password/i), 'abc123')
    await userEvent.type(
      screen.getByLabelText(/confirm new password/i),
      'different'
    )
    await userEvent.click(
      screen.getByRole('button', { name: /save changes/i })
    )

    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument()
  })
})

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ProfileSettings from './ProfileSettings.jsx';

const { mockUseAuth, mockCheckUserAuth } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockCheckUserAuth: vi.fn(),
}));

vi.mock('../../../hooks/useAuth.js', () => ({
  useAuth: mockUseAuth,
}));

vi.mock('../../Layout/Toast/Toast.jsx', () => ({
  default: ({ message, type }) => (
    <div data-testid="toast" data-type={type}>
      {message}
    </div>
  ),
}));

describe('ProfileSettings', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.classList.remove('theme-custom-cursor');
    mockUseAuth.mockReturnValue({
      user: {
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
      },
      checkUserAuth: mockCheckUserAuth,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
    document.body.classList.remove('theme-custom-cursor');
  });

  it('applies themed cursor when persisted preference is enabled', () => {
    localStorage.setItem('customCursor', 'true');

    render(<ProfileSettings />);

    const toggle = screen.getByRole('checkbox', { name: /enable themed cursors/i });
    expect(toggle).toBeChecked();
    expect(document.body).toHaveClass('theme-custom-cursor');
    expect(localStorage.getItem('customCursor')).toBe('true');
  });

  it('removes themed cursor and updates storage when toggle is disabled', () => {
    localStorage.setItem('customCursor', 'true');
    render(<ProfileSettings />);

    const toggle = screen.getByRole('checkbox', { name: /enable themed cursors/i });
    fireEvent.click(toggle);

    expect(toggle).not.toBeChecked();
    expect(document.body).not.toHaveClass('theme-custom-cursor');
    expect(localStorage.getItem('customCursor')).toBe('false');
  });

  it('blocks profile submission when password confirmation mismatches', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    render(<ProfileSettings />);

    fireEvent.change(screen.getByLabelText(/new password/i), {
      target: { value: 'password123' },
    });
    fireEvent.change(screen.getByLabelText(/confirm new password/i), {
      target: { value: 'password456' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mockCheckUserAuth).not.toHaveBeenCalled();
  });
});

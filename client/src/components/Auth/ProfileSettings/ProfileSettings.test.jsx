import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProfileSettings from './ProfileSettings.jsx';

const mockCheckUserAuth = vi.fn();
const mockUseAuth = vi.fn();

vi.mock('../../../hooks/useAuth.js', () => ({
  useAuth: () => mockUseAuth(),
}));

describe('ProfileSettings custom cursor toggle', () => {
  beforeEach(() => {
    mockCheckUserAuth.mockReset();
    mockUseAuth.mockReturnValue({
      user: {
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.com',
      },
      checkUserAuth: mockCheckUserAuth,
    });
  });

  it('restores the themed cursor preference from localStorage on load', () => {
    localStorage.setItem('customCursor', 'true');

    render(<ProfileSettings />);

    expect(
      screen.getByRole('checkbox', { name: /enable themed cursors/i })
    ).toBeChecked();
    expect(document.body).toHaveClass('theme-custom-cursor');
  });

  it('persists themed cursor changes when the toggle is switched', async () => {
    const user = userEvent.setup();

    render(<ProfileSettings />);

    const checkbox = screen.getByRole('checkbox', {
      name: /enable themed cursors/i,
    });

    expect(checkbox).not.toBeChecked();
    expect(localStorage.getItem('customCursor')).toBe('false');
    expect(document.body).not.toHaveClass('theme-custom-cursor');

    await user.click(checkbox);

    expect(checkbox).toBeChecked();
    expect(localStorage.getItem('customCursor')).toBe('true');
    expect(document.body).toHaveClass('theme-custom-cursor');

    await user.click(checkbox);

    expect(checkbox).not.toBeChecked();
    expect(localStorage.getItem('customCursor')).toBe('false');
    expect(document.body).not.toHaveClass('theme-custom-cursor');
  });
});

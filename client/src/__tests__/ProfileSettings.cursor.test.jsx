import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Stable user reference — avoids an infinite useEffect([user]) loop that would
// otherwise occur when the mock creates a new object on every useAuth() call.
vi.mock('../hooks/useAuth.js', () => {
  const user = { firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com' };
  return { useAuth: () => ({ user, checkUserAuth: vi.fn() }) };
});

vi.mock('../components/Layout/Toast/Toast.jsx', () => ({
  default: ({ message }) => <div data-testid="toast">{message}</div>,
}));

vi.mock('../components/Auth/auth-forms.css', () => ({}));

// Dynamic import is required here: a static import combined with the RTL
// render triggers React 19's act() scheduler before the stable mock is fully
// wired, causing a hang. Dynamic import defers module resolution to test time.
const loadPS = () =>
  import('../components/Auth/ProfileSettings/ProfileSettings.jsx').then(
    (m) => m.default,
  );

describe('ProfileSettings — custom cursor toggle', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.classList.remove('theme-custom-cursor');
  });

  afterEach(() => {
    localStorage.clear();
    document.body.classList.remove('theme-custom-cursor');
  });

  it('reads initial toggle state from localStorage (false by default)', async () => {
    const ProfileSettings = await loadPS();
    render(<ProfileSettings />);
    const checkbox = screen.getByRole('checkbox', { name: /enable themed cursors/i });
    expect(checkbox).not.toBeChecked();
  });

  it('restores a previously enabled cursor from localStorage', async () => {
    localStorage.setItem('customCursor', 'true');
    const ProfileSettings = await loadPS();
    render(<ProfileSettings />);
    const checkbox = screen.getByRole('checkbox', { name: /enable themed cursors/i });
    expect(checkbox).toBeChecked();
  });

  it('adds theme-custom-cursor class to body when toggled on', async () => {
    const ProfileSettings = await loadPS();
    render(<ProfileSettings />);
    const checkbox = screen.getByRole('checkbox', { name: /enable themed cursors/i });

    fireEvent.click(checkbox);

    expect(document.body.classList.contains('theme-custom-cursor')).toBe(true);
  });

  it('removes theme-custom-cursor class from body when toggled off', async () => {
    localStorage.setItem('customCursor', 'true');
    const ProfileSettings = await loadPS();
    render(<ProfileSettings />);
    const checkbox = screen.getByRole('checkbox', { name: /enable themed cursors/i });

    fireEvent.click(checkbox);

    expect(document.body.classList.contains('theme-custom-cursor')).toBe(false);
  });

  it('persists cursor preference to localStorage when toggled on', async () => {
    const ProfileSettings = await loadPS();
    render(<ProfileSettings />);
    const checkbox = screen.getByRole('checkbox', { name: /enable themed cursors/i });

    fireEvent.click(checkbox);

    expect(localStorage.getItem('customCursor')).toBe('true');
  });

  it('persists cursor preference to localStorage when toggled off', async () => {
    localStorage.setItem('customCursor', 'true');
    const ProfileSettings = await loadPS();
    render(<ProfileSettings />);
    const checkbox = screen.getByRole('checkbox', { name: /enable themed cursors/i });

    fireEvent.click(checkbox);

    expect(localStorage.getItem('customCursor')).toBe('false');
  });
});

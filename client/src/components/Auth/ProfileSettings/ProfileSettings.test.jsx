import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AuthContext } from '../../../contexts/Auth/AuthContext.jsx';
import ProfileSettings from './ProfileSettings.jsx';

// Minimal user fixture
const mockUser = {
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane@example.com',
  avatar: null,
};

const mockCheckUserAuth = vi.fn();

const renderWithAuth = (user = mockUser) =>
  render(
    <AuthContext.Provider value={{ user, checkUserAuth: mockCheckUserAuth }}>
      <ProfileSettings />
    </AuthContext.Provider>,
  );

beforeEach(() => {
  localStorage.clear();
  document.body.classList.remove('theme-custom-cursor');
  vi.clearAllMocks();
});

afterEach(() => {
  localStorage.clear();
  document.body.classList.remove('theme-custom-cursor');
});

describe('ProfileSettings – custom cursor toggle', () => {
  it('renders the custom cursor checkbox', () => {
    renderWithAuth();
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
    expect(screen.getByText(/Enable Themed Cursors/i)).toBeInTheDocument();
  });

  it('initializes unchecked when localStorage has no value', () => {
    renderWithAuth();
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('initializes checked when localStorage has customCursor=true', () => {
    localStorage.setItem('customCursor', 'true');
    renderWithAuth();
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('initializes unchecked when localStorage has customCursor=false', () => {
    localStorage.setItem('customCursor', 'false');
    renderWithAuth();
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('adds theme class and persists true when toggled on', () => {
    renderWithAuth();
    const checkbox = screen.getByRole('checkbox');

    fireEvent.click(checkbox);

    expect(checkbox).toBeChecked();
    expect(document.body.classList.contains('theme-custom-cursor')).toBe(true);
    expect(localStorage.getItem('customCursor')).toBe('true');
  });

  it('removes theme class and persists false when toggled off', () => {
    localStorage.setItem('customCursor', 'true');
    renderWithAuth();
    const checkbox = screen.getByRole('checkbox');

    fireEvent.click(checkbox); // toggle off

    expect(checkbox).not.toBeChecked();
    expect(document.body.classList.contains('theme-custom-cursor')).toBe(false);
    expect(localStorage.getItem('customCursor')).toBe('false');
  });

  it('restores correct cursor state after toggling on then off', () => {
    renderWithAuth();
    const checkbox = screen.getByRole('checkbox');

    fireEvent.click(checkbox); // on
    fireEvent.click(checkbox); // off

    expect(checkbox).not.toBeChecked();
    expect(document.body.classList.contains('theme-custom-cursor')).toBe(false);
    expect(localStorage.getItem('customCursor')).toBe('false');
  });
});

describe('ProfileSettings – form pre-population', () => {
  it('pre-populates first and last name from context user', () => {
    renderWithAuth();
    expect(screen.getByDisplayValue('Jane')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Doe')).toBeInTheDocument();
  });

  it('pre-populates email from context user', () => {
    renderWithAuth();
    expect(screen.getByDisplayValue('jane@example.com')).toBeInTheDocument();
  });

  it('shows initials placeholder when no avatar is set', () => {
    renderWithAuth({ ...mockUser, avatar: null });
    // Placeholder shows first+last initial
    expect(screen.getByText('JD')).toBeInTheDocument();
  });
});

describe('ProfileSettings – password validation', () => {
  it('shows an error toast when passwords do not match', async () => {
    const { container } = renderWithAuth();

    fireEvent.change(container.querySelector('[name="password"]'), {
      target: { value: 'secret1' },
    });
    fireEvent.change(container.querySelector('[name="confirmPassword"]'), {
      target: { value: 'different' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    expect(
      await screen.findByText(/Passwords do not match/i),
    ).toBeInTheDocument();
  });
});

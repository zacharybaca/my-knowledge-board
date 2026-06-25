import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ProfileSettings from './ProfileSettings.jsx';
import { AuthContext } from '../../../contexts/Auth/AuthContext.jsx';

const defaultUser = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
};

const renderProfileSettings = (overrides = {}) => {
  const value = {
    user: defaultUser,
    checkUserAuth: vi.fn(),
    ...overrides,
  };

  render(
    <AuthContext.Provider value={value}>
      <ProfileSettings />
    </AuthContext.Provider>
  );

  return value;
};

describe('ProfileSettings', () => {
  it('restores a saved cursor preference on mount', async () => {
    localStorage.setItem('customCursor', 'true');

    renderProfileSettings();

    const toggle = screen.getByRole('checkbox', {
      name: /enable themed cursors/i,
    });

    expect(toggle).toBeChecked();
    await waitFor(() =>
      expect(document.body).toHaveClass('theme-custom-cursor')
    );
    expect(localStorage.getItem('customCursor')).toBe('true');
  });

  it('updates the cursor preference when toggled', async () => {
    const user = userEvent.setup();
    renderProfileSettings();

    const toggle = screen.getByRole('checkbox', {
      name: /enable themed cursors/i,
    });

    expect(toggle).not.toBeChecked();
    expect(document.body).not.toHaveClass('theme-custom-cursor');

    await user.click(toggle);

    expect(toggle).toBeChecked();
    expect(document.body).toHaveClass('theme-custom-cursor');
    expect(localStorage.getItem('customCursor')).toBe('true');

    await user.click(toggle);

    expect(toggle).not.toBeChecked();
    expect(document.body).not.toHaveClass('theme-custom-cursor');
    expect(localStorage.getItem('customCursor')).toBe('false');
  });

  it('blocks submission when the passwords do not match', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(global, 'fetch');
    const auth = renderProfileSettings();
    const emailInput = document.querySelector('input[name="email"]');
    const passwordInput = document.querySelector('input[name="password"]');
    const confirmPasswordInput = document.querySelector(
      'input[name="confirmPassword"]'
    );

    await waitFor(() =>
      expect(emailInput).toHaveValue(defaultUser.email)
    );

    await user.type(passwordInput, 'secret1');
    await user.type(confirmPasswordInput, 'different1');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(auth.checkUserAuth).not.toHaveBeenCalled();
    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument();
  });

  it('submits valid profile updates and refreshes auth state', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({}),
    });
    const auth = renderProfileSettings();
    const emailInput = document.querySelector('input[name="email"]');
    const passwordInput = document.querySelector('input[name="password"]');
    const confirmPasswordInput = document.querySelector(
      'input[name="confirmPassword"]'
    );

    await waitFor(() =>
      expect(emailInput).toHaveValue(defaultUser.email)
    );

    await user.type(passwordInput, 'secret1');
    await user.type(confirmPasswordInput, 'secret1');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));

    const [, request] = fetchSpy.mock.calls[0];

    expect(request.method).toBe('PUT');
    expect(request.body).toBeInstanceOf(FormData);
    expect(request.body.get('firstName')).toBe(defaultUser.firstName);
    expect(request.body.get('lastName')).toBe(defaultUser.lastName);
    expect(request.body.get('email')).toBe(defaultUser.email);
    expect(request.body.get('password')).toBe('secret1');
    await waitFor(() => expect(auth.checkUserAuth).toHaveBeenCalledTimes(1));
    expect(screen.getByText('Profile updated successfully.')).toBeInTheDocument();
    expect(passwordInput).toHaveValue('');
    expect(confirmPasswordInput).toHaveValue('');
  });
});

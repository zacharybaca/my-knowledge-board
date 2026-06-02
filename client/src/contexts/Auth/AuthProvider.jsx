import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useFetcher } from '../../hooks/useFetcher.js';
import { AuthContext } from './AuthContext.jsx';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { fetcher } = useFetcher();

  /**
   * DERIVED STATE: isUserAdmin
   * Using useMemo ensures this value is re-calculated immediately
   * whenever the 'user' object changes (e.g., after login or checkUserAuth).
   * Updated to evaluate roles as arrays to match backend schema updates.
   */
  const isUserAdmin = useMemo(() => {
    if (!user) return false;
    const userRoles = Array.isArray(user.role) ? user.role : [user.role];
    return (
      user.isAdmin ||
      userRoles.includes('Admin') ||
      userRoles.includes('Manager')
    );
  }, [user]);

  /**
   * Validates the session with the backend on mount.
   */
  const checkUserAuth = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetcher('/api/users/profile');

      // Update depending on your exact backend payload structure
      if (response.success && response.data) {
        // If data is the user object itself
        setUser(response.data.user || response.data);
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error('Auth check failed:', err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [fetcher]);

  /**
   * Triggers the backend logout and resets local user state.
   */
  const logout = async () => {
    try {
      const sessionId = localStorage.getItem('currentSessionId');

      if (sessionId) {
        await fetcher('/api/sessions/end', {
          method: 'PATCH',
          body: JSON.stringify({ sessionId })
        });
      }

      await fetcher('/api/auth/logout', { method: 'POST' });

      setUser(null);
      localStorage.removeItem('userInfo');
      localStorage.removeItem('currentSessionId');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // Run the auth check once when the provider mounts
  useEffect(() => {
    checkUserAuth();
  }, [checkUserAuth]);

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        loading,
        checkUserAuth,
        logout,
        isUserAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

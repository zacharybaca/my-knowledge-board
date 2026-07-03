import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth.js';
import { useFetcher } from '../../../hooks/useFetcher.js';
import '../auth-forms.css';
import Toast from '../../Layout/Toast/Toast.jsx';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [toastConfig, setToastConfig] = useState(null);

  const { setUser } = useAuth();
  const { fetcher } = useFetcher();
  const navigate = useNavigate();
  const location = useLocation();

  React.useEffect(() => {
    if (location.state?.message) {
      setToastConfig({ message: location.state.message, type: 'success' });
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const response = await fetcher('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (response.success) {
      setUser(response.data);
      localStorage.setItem('userInfo', JSON.stringify(response.data));

      // --- MOVED SESSION START LOGIC OUTSIDE THE ROLE CHECK ---
      // This ensures all users (Employees, Managers, Admins) are logged
      try {
        const sessionResponse = await fetcher('/api/sessions/start', {
          method: 'POST',
        });
        if (sessionResponse.success && sessionResponse.data.sessionId) {
          localStorage.setItem(
            'currentSessionId',
            sessionResponse.data.sessionId
          );
        }
      } catch (err) {
        console.error('Failed to start session logging:', err);
      }
      // --------------------------------------------------------

      // Type coercion for role evaluation
      const userRoles = Array.isArray(response.data.role)
        ? response.data.role
        : [response.data.role];

      if (userRoles.includes('Admin') || userRoles.includes('Manager')) {
        navigate('/manager-dashboard');
      } else {
        navigate('/employee-dashboard');
      }
    } else {
      setError(
        response.error || 'Login failed. Please check your credentials.'
      );
    }

    setIsLoading(false);
  };

  return (
    <div className="auth-container">
      {toastConfig && (
        <Toast
          message={toastConfig.message}
          type={toastConfig.type}
          onClose={() => setToastConfig(null)}
        />
      )}
      <div className="auth-card">
        <h2>Welcome Back</h2>
        <p>Log in to access your knowledge board.</p>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleLoginSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <div className="auth-label-row">
              <label htmlFor="password">Password</label>
              <Link to="/forgot-password" className="auth-secondary-link">
                Forgot password?
              </Link>
            </div>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="auth-submit-btn"
            disabled={isLoading}
          >
            {isLoading ? 'Logging in...' : 'Log In'}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Don't have an account? <Link to="/register">Register here</Link>
          </p>
          <p>
            New organization?{' '}
            <Link to="/register-company">Register Workspace</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;

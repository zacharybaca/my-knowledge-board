import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth.js';
import { useFetcher } from '../../../hooks/useFetcher.js';
import '../auth-forms.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { setUser } = useAuth();
  const { fetcher } = useFetcher();
  const navigate = useNavigate();

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

      if (response.data.role === 'Admin' || response.data.role === 'Manager') {
        // Inside your login submission handler, after setting the user/token:
        const sessionResponse = await fetcher('/api/sessions/start', { method: 'POST' });
        if (sessionResponse.success) {
          localStorage.setItem('currentSessionId', sessionResponse.data.sessionId);
        }
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
            <label htmlFor="password">Password</label>
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

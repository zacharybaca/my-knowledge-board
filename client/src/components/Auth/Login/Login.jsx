import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useFetcher } from '../../../hooks/useFetcher.js';
import Toast from '../../../components/Toast.jsx';
import '../auth-forms.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [toastConfig, setToastConfig] = useState(null);

  const { fetcher } = useFetcher();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.state?.message) {
      setToastConfig({
        message: location.state.message,
        type: 'success',
      });
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setToastConfig(null);

    const response = await fetcher('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (response.success) {
      const origin = location.state?.from?.pathname || '/';
      navigate(origin);
    } else {
      setToastConfig({
        message: response.error || 'Login failed. Check your credentials.',
        type: 'error',
      });
    }
  };

  return (
    <div className="auth-page-container">
      {toastConfig && (
        <Toast
          message={toastConfig.message}
          type={toastConfig.type}
          onClose={() => setToastConfig(null)}
        />
      )}

      <div className="auth-card">
        <h2 className="auth-title">Welcome Back</h2>
        <form onSubmit={handleSubmit}>
          <div className="auth-form-group">
            <label>Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="auth-form-group">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <label>Password</label>
              <Link
                to="/forgot-password"
                style={{
                  fontSize: '0.85rem',
                  color: '#10b981',
                  textDecoration: 'none',
                }}
              >
                Forgot Password?
              </Link>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="auth-submit-btn">
            Login
          </button>
        </form>

        <div className="auth-footer" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <p style={{ margin: 0 }}>
            Need an employee account?{' '}
            <Link to="/register" className="auth-link">
              Sign Up
            </Link>
          </p>
          <p style={{ margin: 0, fontSize: '0.85rem' }}>
            New organization?{' '}
            <Link to="/register-company" className="auth-link">
              Register Company
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;

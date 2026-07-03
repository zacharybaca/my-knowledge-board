import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useFetcher } from '../../../hooks/useFetcher.js';
import '../auth-forms.css';

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { token } = useParams();
  const { fetcher } = useFetcher();
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);

    const response = await fetcher(`/api/auth/resetpassword/${token}`, {
      method: 'PUT',
      body: JSON.stringify({ password }),
    });

    if (response.success) {
      navigate('/login', {
        state: { message: response.data.message || 'Password reset successful.' },
      });
      return;
    }

    setError(response.error || 'Unable to reset password.');
    setIsSubmitting(false);
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>Create a New Password</h2>
        <p>Enter and confirm a new password for your account.</p>

        {error && <div className="auth-feedback auth-feedback-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="password">New Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm New Password</label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>

          <button
            type="submit"
            className="auth-submit-btn"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Resetting password...' : 'Reset Password'}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Need a new link?{' '}
            <Link to="/forgot-password" className="auth-link">
              Request another reset email
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useFetcher } from '../../../hooks/useFetcher.js';
import '../auth-forms.css';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { fetcher } = useFetcher();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccessMessage('');
    setIsSubmitting(true);

    const response = await fetcher('/api/auth/forgotpassword', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });

    if (response.success) {
      setSuccessMessage(
        'If that email is registered, a password reset link is on its way.'
      );
      setEmail('');
    } else {
      setError(response.error || 'Unable to send password reset email.');
    }

    setIsSubmitting(false);
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>Reset Your Password</h2>
        <p>Enter your work email and we&apos;ll send you a reset link.</p>

        {error && (
          <div className="auth-feedback auth-feedback-error">{error}</div>
        )}
        {successMessage && (
          <div className="auth-feedback auth-feedback-success">
            {successMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Work Email Address</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="auth-submit-btn"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Sending reset link...' : 'Send Reset Link'}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Remembered your password?{' '}
            <Link to="/login" className="auth-link">
              Return to login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;

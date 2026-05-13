import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth.js';
import { useFetcher } from '../../../hooks/useFetcher.js';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import '../../Auth/auth-forms.css';

const VerifyWorkspace = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const { fetcher } = useFetcher();

  const [status, setStatus] = useState('loading'); // 'loading', 'success', 'error'
  const [errorMessage, setErrorMessage] = useState('');
  const hasFetched = useRef(false);

  useEffect(() => {
    // Prevent strict mode double-firing from causing invalid token errors
    if (hasFetched.current) return;
    hasFetched.current = true;

    const verifyToken = async () => {
      const response = await fetcher(`/api/auth/verify/${token}`, {
        method: 'GET'
      });

      if (response.success) {
        setStatus('success');
        login(response.data);

        // Brief pause so user sees success state before redirect
        setTimeout(() => {
          navigate('/'); // Redirect to home/dashboard
        }, 2000);
      } else {
        setStatus('error');
        setErrorMessage(response.error || 'Verification failed. The token may be expired or invalid.');
      }
    };

    verifyToken();
  }, [token, fetcher, login, navigate]);

  return (
    <div className="auth-page-container verify-page">
      <div className="auth-card" style={{ maxWidth: '400px', textAlign: 'center' }}>

        {status === 'loading' && (
          <div className="verify-state">
            <Loader2 className="spinner" size={48} color="#0f172a" />
            <h2 className="auth-title">Verifying Workspace...</h2>
            <p className="auth-footer">Please wait while we activate your account.</p>
          </div>
        )}

        {status === 'success' && (
          <div className="verify-state success">
            <CheckCircle size={48} color="#10b981" style={{ margin: '0 auto 16px' }} />
            <h2 className="auth-title">Workspace Activated!</h2>
            <p className="auth-footer">Redirecting you to your dashboard...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="verify-state error">
            <XCircle size={48} color="#ef4444" style={{ margin: '0 auto 16px' }} />
            <h2 className="auth-title">Verification Failed</h2>
            <p className="auth-footer" style={{ color: '#ef4444', marginBottom: '20px' }}>
              {errorMessage}
            </p>
            <Link to="/register-company" className="auth-submit-btn" style={{ textDecoration: 'none', display: 'inline-block' }}>
              Return to Registration
            </Link>
          </div>
        )}

      </div>
    </div>
  );
};

export default VerifyWorkspace;

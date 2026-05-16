import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth.js';
import { useFetcher } from '../../../hooks/useFetcher.js';
import { CheckCircle, AlertCircle } from 'lucide-react';
import '../auth-forms.css';

const VerifyWorkspace = () => {
  const { token } = useParams();
  const { setUser } = useAuth();
  const { fetcher } = useFetcher();
  const navigate = useNavigate();

  const [status, setStatus] = useState('verifying');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const verifyToken = async () => {
      try {
        const response = await fetcher(`/api/auth/verify/${token}`);

        if (response.success) {
          setStatus('success');
          setUser(response.data);

          setTimeout(() => {
            navigate('/manager-dashboard');
          }, 2000);
        } else {
          setStatus('error');
          setMessage(
            response.error || 'Verification failed. The link may have expired.'
          );
        }
      } catch (err) {
        setStatus('error');
        setMessage('A network error occurred during verification.');
      }
    };

    if (token) {
      verifyToken();
    }
  }, [token, fetcher, setUser, navigate]);

  return (
    <div className="auth-container">
      <div className="auth-card verify-card">
        {status === 'verifying' && (
          <div className="verify-state">
            <div className="spinner"></div>
            <h2>Verifying Workspace...</h2>
            <p>
              Please wait while we activate your account and configure your
              environment.
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="verify-state success">
            <CheckCircle size={48} className="success-icon" />
            <h2>Workspace Activated!</h2>
            <p>
              Your account has been verified. Redirecting to your dashboard...
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="verify-state error">
            <AlertCircle size={48} className="error-icon" />
            <h2>Verification Failed</h2>
            <p>{message}</p>
            <Link to="/register-company" className="auth-submit-btn">
              Return to Registration
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default VerifyWorkspace;

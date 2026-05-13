import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useFetcher } from '../../../hooks/useFetcher.js';
import '../auth-forms.css';
import Toast from '../../Layout/Toast/Toast.jsx';

const Register = () => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    companyId: '',
  });
  const [companies, setCompanies] = useState([]);
  const { fetcher } = useFetcher();
  const navigate = useNavigate();
  const location = useLocation();

  const [toastConfig, setToastConfig] = useState(null);

  useEffect(() => {
    if (location.state?.message) {
      setToastConfig({
        message: location.state.message,
        type: 'success',
      });
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        // Fallback to standard fetch if your custom useFetcher is strictly for POST/mutations
        const res = await fetch('/api/companies');
        const data = await res.json();
        if (res.ok) {
          setCompanies(data);
        }
      } catch (error) {
        console.error('Failed to fetch companies', error);
      }
    };
    fetchCompanies();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setToastConfig(null);

    if (formData.password !== formData.confirmPassword) {
      setToastConfig({ message: 'Passwords do not match', type: 'error' });
      return;
    }

    const payload = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      password: formData.password,
      companyId: formData.companyId,
    };

    const response = await fetcher('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (response.success) {
      navigate('/login', {
        state: { message: 'Registration successful! Please log in.' },
      });
    } else {
      setToastConfig({ message: response.error, type: 'error' });
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
        <h2 className="auth-title">Create Employee Account</h2>
        <form onSubmit={handleSubmit}>
          <div className="auth-form-row">
            <div className="auth-form-group half-width">
              <label>First Name</label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) =>
                  setFormData({ ...formData, firstName: e.target.value })
                }
                required
              />
            </div>
            <div className="auth-form-group half-width">
              <label>Last Name</label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) =>
                  setFormData({ ...formData, lastName: e.target.value })
                }
                required
              />
            </div>
          </div>

          <div className="auth-form-group">
            <label>Work Email Address</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              required
            />
          </div>

          <div className="auth-form-group">
            <label>Company</label>
            <select
              value={formData.companyId}
              onChange={(e) =>
                setFormData({ ...formData, companyId: e.target.value })
              }
              required
            >
              <option value="" disabled>
                Select your company
              </option>
              {companies.map((company) => (
                <option key={company._id} value={company._id}>
                  {company.name}
                </option>
              ))}
            </select>
          </div>

          <div className="auth-form-group">
            <label>Password</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              required
            />
          </div>

          <div className="auth-form-group">
            <label>Confirm Password</label>
            <input
              type="password"
              value={formData.confirmPassword}
              onChange={(e) =>
                setFormData({ ...formData, confirmPassword: e.target.value })
              }
              required
            />
          </div>

          <button type="submit" className="auth-submit-btn">
            Create Account
          </button>
        </form>
        <p className="auth-footer">
          Already a member?{' '}
          <Link to="/login" className="auth-link">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Register;

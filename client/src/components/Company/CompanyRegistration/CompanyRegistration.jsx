import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth.js';
import { useFetcher } from '../../../hooks/useFetcher.js';
import Toast from '../../Layout/Toast/Toast.jsx';
import '../../Auth/auth-forms.css';

const CompanyRegistration = () => {
  const [formData, setFormData] = useState({
    companyName: '',
    emailDomain: '',
    firstName: '',
    lastName: '',
    email: '',
    password: ''
  });
  const [toastConfig, setToastConfig] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { fetcher } = useFetcher();
  const { login } = useAuth(); // Assume login updates local auth state
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setToastConfig(null);

    const response = await fetcher('/api/companies/register', {
      method: 'POST',
      body: JSON.stringify(formData),
    });

    if (response.success) {
      // Update auth context with the returned user data
      login(response.data);
      navigate('/dashboard');
    } else {
      setToastConfig({ type: 'error', message: response.error || 'Registration failed.' });
      setIsSubmitting(false);
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

      <div className="auth-card" style={{ maxWidth: '500px' }}>
        <h2 className="auth-title">Register Workspace</h2>
        <p className="auth-footer" style={{ marginTop: 0, marginBottom: '20px' }}>
          Create your organization and admin account.
        </p>

        <form onSubmit={handleSubmit}>
          {/* Company Details */}
          <div className="auth-form-group">
            <label>Organization Name</label>
            <input
              type="text"
              name="companyName"
              value={formData.companyName}
              onChange={handleChange}
              required
              placeholder="e.g., Acme Corporation"
            />
          </div>

          <div className="auth-form-group">
            <label>Email Domain</label>
            <input
              type="text"
              name="emailDomain"
              value={formData.emailDomain}
              onChange={handleChange}
              required
              placeholder="e.g., acmecorp.com"
            />
          </div>

          <hr style={{ margin: '20px 0', borderColor: '#334155' }} />

          {/* Admin User Details */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <div className="auth-form-group" style={{ flex: 1 }}>
              <label>First Name</label>
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                required
              />
            </div>
            <div className="auth-form-group" style={{ flex: 1 }}>
              <label>Last Name</label>
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="auth-form-group">
            <label>Admin Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="auth-form-group">
            <label>Password</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </div>

          <button
            type="submit"
            className="auth-submit-btn"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Configuring Workspace...' : 'Create Workspace'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CompanyRegistration;

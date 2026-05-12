import React, { useState } from 'react';
import { useFetcher } from '../../../hooks/useFetcher.js';
import Toast from '../../../components/Toast.jsx';
import '../auth-forms.css';

const CompanyRegistration = () => {
  const [formData, setFormData] = useState({
    name: '',
    emailDomain: '',
  });
  const [toastConfig, setToastConfig] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { fetcher } = useFetcher();

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
      setToastConfig({ type: 'success', message: 'Company registered successfully.' });
      setFormData({ name: '', emailDomain: '' });
    } else {
      setToastConfig({ type: 'error', message: response.error || 'Failed to register company.' });
    }

    setIsSubmitting(false);
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
        <h2 className="auth-title">Register Company</h2>
        <p className="auth-footer" style={{ marginTop: 0, marginBottom: '20px' }}>
          Set up a new workspace for your organization.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="auth-form-group">
            <label>Company Name</label>
            <input
              type="text"
              name="name"
              value={formData.name}
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
            <small style={{ color: '#888888', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
              Used to automatically verify employee signups.
            </small>
          </div>

          <button
            type="submit"
            className="auth-submit-btn"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Registering...' : 'Register Company'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CompanyRegistration;

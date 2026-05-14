import React, { useState } from 'react';
import Toast from '../../Layout/Toast/Toast.jsx';
import { MailCheck } from 'lucide-react';
import '../../Auth/auth-forms.css';

const CompanyRegistration = () => {
  const [formData, setFormData] = useState({
    companyName: '',
    emailDomain: '',
    firstName: '',
    lastName: '',
    email: '',
    password: '',
  });
  const [companyImage, setCompanyImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [toastConfig, setToastConfig] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setCompanyImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setToastConfig(null);

    const payload = new FormData();
    payload.append('companyName', formData.companyName);
    payload.append('emailDomain', formData.emailDomain);
    payload.append('firstName', formData.firstName);
    payload.append('lastName', formData.lastName);
    payload.append('email', formData.email);
    payload.append('password', formData.password);

    if (companyImage) {
      payload.append('companyImage', companyImage);
    }

    try {
      const res = await fetch('/api/companies/register', {
        method: 'POST',
        body: payload,
      });

      const responseData = await res.json();

      if (res.ok) {
        setIsSuccess(true);
      } else {
        setToastConfig({
          type: 'error',
          message: responseData.message || 'Registration failed.',
        });
        setIsSubmitting(false);
      }
    } catch (error) {
      setToastConfig({
        type: 'error',
        message: 'Server error during registration.',
      });
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="auth-page-container">
        <div
          className="auth-card success-state"
          style={{ maxWidth: '500px', textAlign: 'center' }}
        >
          <MailCheck
            size={64}
            color="#10b981"
            style={{ margin: '0 auto 20px' }}
          />
          <h2 className="auth-title">Check Your Email</h2>
          <p className="auth-footer" style={{ marginTop: '10px' }}>
            We sent a verification link to <strong>{formData.email}</strong>.
            Please click the link to activate your workspace and log in.
          </p>
          <small
            style={{ color: '#64748b', display: 'block', marginTop: '20px' }}
          >
            You can safely close this tab. The link will expire in 24 hours.
          </small>
        </div>
      </div>
    );
  }

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
        <p
          className="auth-footer"
          style={{ marginTop: 0, marginBottom: '20px' }}
        >
          Create your organization and admin account.
        </p>

        <form onSubmit={handleSubmit}>
          {/* Company Image Upload Section */}
          <div className="auth-avatar-upload">
            <div className="avatar-preview-container">
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt="Company Preview"
                  className="avatar-preview"
                />
              ) : (
                <div className="avatar-placeholder">Logo</div>
              )}
            </div>
            <div className="avatar-input-group">
              <label htmlFor="companyImageUpload" className="avatar-upload-btn">
                Choose Company Logo
              </label>
              <input
                id="companyImageUpload"
                type="file"
                accept="image/jpeg, image/png, image/webp"
                onChange={handleImageChange}
                style={{ display: 'none' }}
              />
            </div>
          </div>

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
              pattern="[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}"
              title="Must be a valid domain format (e.g., acmecorp.com)"
              placeholder="e.g., acmecorp.com"
            />
          </div>

          <hr style={{ margin: '20px 0', borderColor: '#e2e8f0' }} />

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
              minLength="6"
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

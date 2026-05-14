import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
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

  const [avatar, setAvatar] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastConfig, setToastConfig] = useState(null);

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

  useEffect(() => {
    const fetchCompanies = async () => {
      try {
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

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatar(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setToastConfig(null);
    setIsSubmitting(true);

    if (formData.password !== formData.confirmPassword) {
      setToastConfig({ message: 'Passwords do not match', type: 'error' });
      setIsSubmitting(false);
      return;
    }

    // Utilize FormData for multipart file transmission
    const payload = new FormData();
    payload.append('firstName', formData.firstName);
    payload.append('lastName', formData.lastName);
    payload.append('email', formData.email);
    payload.append('password', formData.password);
    payload.append('companyId', formData.companyId);

    if (avatar) {
      payload.append('avatar', avatar);
    }

    try {
      // Bypassing useFetcher to allow the browser to auto-set boundary headers
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        body: payload,
      });

      const responseData = await res.json();

      if (res.ok) {
        navigate('/login', {
          state: { message: 'Registration successful! Please log in.' },
        });
      } else {
        setToastConfig({
          message: responseData.message || 'Registration failed',
          type: 'error',
        });
      }
    } catch (error) {
      setToastConfig({
        message: 'Server error during registration.',
        type: 'error',
      });
    } finally {
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
      <div className="auth-card">
        <h2 className="auth-title">Create Employee Account</h2>
        <form onSubmit={handleSubmit}>
          {/* Avatar Upload Section */}
          <div className="auth-avatar-upload">
            <div className="avatar-preview-container">
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="Avatar Preview"
                  className="avatar-preview"
                />
              ) : (
                <div className="avatar-placeholder">Initials</div>
              )}
            </div>
            <div className="avatar-input-group">
              <label htmlFor="avatarUpload" className="avatar-upload-btn">
                Choose Profile Picture
              </label>
              <input
                id="avatarUpload"
                type="file"
                accept="image/jpeg, image/png, image/webp"
                onChange={handleAvatarChange}
                style={{ display: 'none' }}
              />
            </div>
          </div>

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

          <button
            type="submit"
            className="auth-submit-btn"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating Account...' : 'Create Account'}
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

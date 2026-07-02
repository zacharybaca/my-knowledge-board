import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useFetcher } from '../../../hooks/useFetcher';
import '../auth-forms.css';
import Toast from '../../Layout/Toast/Toast.jsx';

const Register = () => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    companyId: [],
    department: [],
  });

  const [avatar, setAvatar] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastConfig, setToastConfig] = useState(null);

  const navigate = useNavigate();
  const location = useLocation();
  const { fetcher } = useFetcher();

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
      const response = await fetcher('/api/companies');
      if (response.success) {
        setCompanies(response.data);
      } else {
        console.error('Failed to fetch companies', response.error);
      }
    };
    fetchCompanies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatar(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const getSelectedValues = (options) =>
    Array.from(options)
      .filter((option) => option.selected)
      .map((option) => option.value);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setToastConfig(null);
    setIsSubmitting(true);

    if (formData.password !== formData.confirmPassword) {
      setToastConfig({ message: 'Passwords do not match', type: 'error' });
      setIsSubmitting(false);
      return;
    }

    if (formData.department.length === 0) {
      setToastConfig({
        message: 'Please select at least one department.',
        type: 'error',
      });
      setIsSubmitting(false);
      return;
    }

    if (formData.companyId.length === 0) {
      setToastConfig({
        message: 'Please select at least one company workspace.',
        type: 'error',
      });
      setIsSubmitting(false);
      return;
    }

    const payload = new FormData();
    payload.append('firstName', formData.firstName);
    payload.append('lastName', formData.lastName);
    payload.append('email', formData.email);
    payload.append('password', formData.password);
    formData.companyId.forEach((id) => payload.append('companyId', id));
    formData.department.forEach((dept) => payload.append('department', dept));

    if (avatar) {
      payload.append('avatar', avatar);
    }

    const response = await fetcher('/api/auth/register', {
      method: 'POST',
      body: payload,
    });

    if (response.success) {
      navigate('/login', {
        state: { message: 'Registration successful! Please log in.' },
      });
    } else {
      setToastConfig({
        message: response.error || 'Registration failed',
        type: 'error',
      });
    }

    setIsSubmitting(false);
  };

  return (
    <div className="auth-container">
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
            <div className="form-group half-width">
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
            <div className="form-group half-width">
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

          <div className="form-group">
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

          <div className="form-group">
            <label htmlFor="department">Department</label>
            <select
              id="department"
              name="department"
              value={formData.department}
              multiple
              onChange={(e) =>
                setFormData({
                  ...formData,
                  department: getSelectedValues(e.target.options),
                })
              }
              required
              style={{ height: 'auto', minHeight: '110px' }}
            >
              <option value="Customer Service">
                Customer Service & Billing
              </option>
              <option value="Tech Support">Tech Support</option>
              <option value="Human Resources">Human Resources</option>
              <option value="Sales">Sales</option>
              <option value="Marketing">Marketing</option>
              <option value="Engineering">Engineering</option>
              <option value="Product">Product</option>
              <option value="Finance">Finance</option>
              <option value="Legal">Legal</option>
              <option value="Operations">Operations</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="form-group">
            <label>Company Workspace(s) (Ctrl/Cmd click)</label>
            <select
              value={formData.companyId}
              multiple
              onChange={(e) =>
                setFormData({
                  ...formData,
                  companyId: getSelectedValues(e.target.options),
                })
              }
              required
              style={{ height: 'auto', minHeight: '100px' }}
            >
              {companies.map((company) => (
                <option key={company._id} value={company._id}>
                  {company.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
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

          <div className="form-group">
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

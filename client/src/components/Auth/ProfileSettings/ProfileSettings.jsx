import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../hooks/useAuth.js';
import Toast from '../../Layout/Toast/Toast.jsx';
import '../../Auth/auth-forms.css';

const ProfileSettings = () => {
  const { user, checkUserAuth } = useAuth();

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [avatar, setAvatar] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastConfig, setToastConfig] = useState(null);

  useEffect(() => {
    if (user) {
      setFormData((prev) => ({
        ...prev,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
      }));
      if (user.avatar) {
        setAvatarPreview(user.avatar);
      }
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

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

    if (formData.password && formData.password !== formData.confirmPassword) {
      setToastConfig({ message: 'Passwords do not match.', type: 'error' });
      setIsSubmitting(false);
      return;
    }

    const payload = new FormData();
    payload.append('firstName', formData.firstName);
    payload.append('lastName', formData.lastName);
    payload.append('email', formData.email);

    if (formData.password) {
      payload.append('password', formData.password);
    }

    if (avatar) {
      payload.append('avatar', avatar);
    }

    try {
      const res = await fetch('/api/users/profile', {
        method: 'PUT',
        body: payload,
      });

      const responseData = await res.json();

      if (res.ok) {
        setToastConfig({
          message: 'Profile updated successfully.',
          type: 'success',
        });
        setFormData((prev) => ({
          ...prev,
          password: '',
          confirmPassword: '',
        }));
        await checkUserAuth();
      } else {
        setToastConfig({
          message: responseData.message || 'Failed to update profile.',
          type: 'error',
        });
      }
    } catch (error) {
      setToastConfig({
        message: 'Server error during profile update.',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="auth-container"
      style={{ minHeight: 'auto', padding: '20px 0' }}
    >
      {toastConfig && (
        <Toast
          message={toastConfig.message}
          type={toastConfig.type}
          onClose={() => setToastConfig(null)}
        />
      )}

      <div
        className="auth-card"
        style={{ maxWidth: '600px', margin: '0 auto' }}
      >
        <h2 className="auth-title" style={{ marginBottom: '10px' }}>
          Profile Settings
        </h2>
        <p
          className="auth-footer"
          style={{ marginTop: 0, marginBottom: '30px' }}
        >
          Update your personal information, email address, or password.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="auth-avatar-upload">
            <div className="avatar-preview-container">
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="Avatar Preview"
                  className="avatar-preview"
                />
              ) : (
                <div className="avatar-placeholder">
                  {formData.firstName?.charAt(0)}
                  {formData.lastName?.charAt(0)}
                </div>
              )}
            </div>
            <div className="avatar-input-group">
              <label htmlFor="avatarUpload" className="avatar-upload-btn">
                Change Profile Picture
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
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group half-width">
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

          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <hr
            style={{
              margin: '30px 0',
              borderColor: 'rgba(255, 255, 255, 0.1)',
            }}
          />

          <p
            className="auth-footer"
            style={{ textAlign: 'left', marginBottom: '15px' }}
          >
            Leave password fields blank to keep your current password.
          </p>

          <div className="form-group">
            <label>New Password</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              minLength="6"
            />
          </div>

          <div className="form-group">
            <label>Confirm New Password</label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              minLength="6"
            />
          </div>

          <button
            type="submit"
            className="auth-submit-btn"
            disabled={isSubmitting}
            style={{ marginTop: '20px' }}
          >
            {isSubmitting ? 'Saving Changes...' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ProfileSettings;

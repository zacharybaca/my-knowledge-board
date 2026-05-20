// client/src/components/Admin/CreateElevatedUser/CreateElevatedUser.jsx (Update)

import React, { useState } from 'react';
import { useFetcher } from '../../../hooks/useFetcher.js';
import Toast from '../../Layout/Toast/Toast.jsx';
import { ShieldCheck } from 'lucide-react';
import '../auth-forms.css';

const CreateElevatedUser = () => {
  const { fetcher } = useFetcher();

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    department: '',
    role: 'Employee', // Updated default state
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastConfig, setToastConfig] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setToastConfig(null);
    setIsSubmitting(true);

    const payload = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      password: formData.password,
      department: formData.department,
      role: formData.role,
    };

    const response = await fetcher('/api/users/elevated', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (response.success) {
      setToastConfig({
        message: `${formData.role} account created successfully.`,
        type: 'success',
      });
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        department: '',
        role: 'Employee',
      });
    } else {
      setToastConfig({
        message: response.error || 'Failed to create account.',
        type: 'error',
      });
    }

    setIsSubmitting(false);
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
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: '16px',
          }}
        >
          <ShieldCheck size={48} color="#10b981" />
        </div>

        {/* Updated headings to reflect broader scope */}
        <h2 className="auth-title" style={{ marginBottom: '10px' }}>
          Provision User Account
        </h2>
        <p
          className="auth-footer"
          style={{ marginTop: 0, marginBottom: '30px' }}
        >
          Create a new user account for your workspace.
        </p>

        <form onSubmit={handleSubmit}>
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
            <label>Work Email Address</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="auth-form-row">
            <div className="form-group half-width">
              <label htmlFor="department">Department</label>
              <select
            id="department"
            name="department"
            value={formData.department}
            onChange={(e) => setFormData({ ...formData, department: e.target.value })}
            required
          >
            <option value="">Select Department...</option>
            <option value="Customer Service">Customer Service & Billing</option>
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

            <div className="form-group half-width">
              <label htmlFor="role">Access Level</label>
              <select
                id="role"
                name="role"
                value={formData.role}
                onChange={handleChange}
                required
              >
                {/* Added Employee option */}
                <option value="Employee">Employee</option>
                <option value="Manager">Manager</option>
                <option value="Admin">Admin</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Temporary Password</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              minLength="6"
              placeholder="Minimum 6 characters"
            />
          </div>

          <button
            type="submit"
            className="auth-submit-btn"
            disabled={isSubmitting}
            style={{ marginTop: '20px' }}
          >
            {isSubmitting ? 'Provisioning Account...' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateElevatedUser;

import React, { useState, useEffect, useCallback } from 'react';
import { useFetcher } from '../../hooks/useFetcher';
import { useAuth } from '../../hooks/useAuth';
import Toast from '../Layout/Toast/Toast';
import './user-management.css';

const UserManagement = () => {
  const { fetcher } = useFetcher();
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toastConfig, setToastConfig] = useState(null);

  // Modal State
  const [suspendModal, setSuspendModal] = useState({
    isOpen: false,
    user: null,
  });
  const [suspensionReason, setSuspensionReason] = useState('');
  const [roleModal, setRoleModal] = useState({
    isOpen: false,
    user: null,
    selectedRole: 'Employee',
  });

  const fetchUsers = useCallback(async () => {
    const response = await fetcher('/api/users/directory');
    if (response.success) {
      setUsers(response.data);
    } else {
      setToastConfig({
        type: 'error',
        message: 'Failed to load user directory.',
      });
    }
    setIsLoading(false);
  }, [fetcher]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleDelete = async (targetId) => {
    if (
      !window.confirm(
        'Are you sure you want to permanently delete this account? This cannot be undone.'
      )
    )
      return;

    const response = await fetcher(`/api/users/${targetId}`, {
      method: 'DELETE',
    });

    if (response.success) {
      setToastConfig({
        type: 'success',
        message: 'User deleted successfully.',
      });
      setUsers(users.filter((u) => u._id !== targetId));
    } else {
      setToastConfig({ type: 'error', message: response.error });
    }
  };

  const handleToggleSuspend = async (targetUser) => {
    if (targetUser.isSuspended) {
      // Unsuspend immediately
      const response = await fetcher(`/api/users/${targetUser._id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isSuspended: false, suspensionReason: '' }),
      });

      if (response.success) {
        setToastConfig({ type: 'success', message: 'Account restored.' });
        fetchUsers();
      } else {
        setToastConfig({ type: 'error', message: response.error });
      }
    } else {
      // Open modal to capture reason before suspending
      setSuspensionReason('');
      setSuspendModal({ isOpen: true, user: targetUser });
    }
  };

  const confirmSuspension = async () => {
    if (!suspensionReason.trim()) {
      setToastConfig({
        type: 'error',
        message: 'A reason is required to suspend an account.',
      });
      return;
    }

    const response = await fetcher(
      `/api/users/${suspendModal.user._id}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({ isSuspended: true, suspensionReason }),
      }
    );

    if (response.success) {
      setToastConfig({ type: 'success', message: 'Account suspended.' });
      fetchUsers();
      setSuspendModal({ isOpen: false, user: null });
    } else {
      setToastConfig({ type: 'error', message: response.error });
    }
  };

  const getPrimaryRole = (userRole) =>
    Array.isArray(userRole) ? userRole[0] : userRole;

  const handleOpenRoleModal = (targetUser) => {
    setRoleModal({
      isOpen: true,
      user: targetUser,
      selectedRole: getPrimaryRole(targetUser.role) || 'Employee',
    });
  };

  const handleRoleUpdate = async () => {
    const response = await fetcher(`/api/users/${roleModal.user._id}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role: roleModal.selectedRole }),
    });

    if (response.success) {
      setToastConfig({ type: 'success', message: 'User role updated.' });
      setRoleModal({ isOpen: false, user: null, selectedRole: 'Employee' });
      fetchUsers();
    } else {
      setToastConfig({ type: 'error', message: response.error });
    }
  };

  if (isLoading) return <div>Loading directory...</div>;

  return (
    <div className="user-management-container">
      {toastConfig && (
        <Toast
          message={toastConfig.message}
          type={toastConfig.type}
          onClose={() => setToastConfig(null)}
        />
      )}

      <h2 className="user-management-title">Employee Directory Management</h2>

      <table className="user-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u._id} className={u.isSuspended ? 'suspended-row' : ''}>
              <td>
                {u.firstName} {u.lastName}
              </td>
              <td>{u.email}</td>
              <td>{Array.isArray(u.role) ? u.role.join(', ') : u.role}</td>
              <td>
                <span
                  className={`status-badge ${u.isSuspended ? 'suspended' : 'active'}`}
                >
                  {u.isSuspended ? 'Suspended' : 'Active'}
                </span>
              </td>
              <td>
                {u._id !== currentUser._id && (
                  <div className="action-buttons">
                    <button
                      onClick={() => handleToggleSuspend(u)}
                      className={`btn-suspend ${u.isSuspended ? 'restore' : 'suspend'}`}
                    >
                      {u.isSuspended ? 'Restore' : 'Suspend'}
                    </button>
                    <button
                      onClick={() => handleOpenRoleModal(u)}
                      className="btn-role"
                    >
                      Edit Role
                    </button>
                    <button
                      onClick={() => handleDelete(u._id)}
                      className="btn-delete"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {suspendModal.isOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Suspend Account</h3>
            <p>
              Suspending{' '}
              <strong>
                {suspendModal.user.firstName} {suspendModal.user.lastName}
              </strong>{' '}
              will prevent them from logging in.
            </p>
            <div className="form-group">
              <label>Reason for Suspension (Visible to user):</label>
              <textarea
                value={suspensionReason}
                onChange={(e) => setSuspensionReason(e.target.value)}
                rows="4"
                placeholder="e.g., Policy violation regarding sensitive data."
              />
            </div>
            <div className="modal-actions">
              <button
                onClick={() => setSuspendModal({ isOpen: false, user: null })}
                className="btn-cancel"
              >
                Cancel
              </button>
              <button
                onClick={confirmSuspension}
                className="btn-submit suspend-confirm"
              >
                Confirm Suspension
              </button>
            </div>
          </div>
        </div>
      )}

      {roleModal.isOpen && roleModal.user && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Edit User Role</h3>
            <p>
              Update role for{' '}
              <strong>
                {roleModal.user.firstName} {roleModal.user.lastName}
              </strong>
              .
            </p>
            <div className="form-group">
              <label htmlFor="role-select">Role</label>
              <select
                id="role-select"
                value={roleModal.selectedRole}
                onChange={(e) =>
                  setRoleModal((prev) => ({
                    ...prev,
                    selectedRole: e.target.value,
                  }))
                }
              >
                <option value="Employee">Employee</option>
                <option value="Manager">Manager</option>
                <option value="Admin">Admin</option>
              </select>
            </div>
            <div className="modal-actions">
              <button
                onClick={() =>
                  setRoleModal({
                    isOpen: false,
                    user: null,
                    selectedRole: 'Employee',
                  })
                }
                className="btn-cancel"
              >
                Cancel
              </button>
              <button
                onClick={handleRoleUpdate}
                className="btn-submit role-save"
              >
                Save Role
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;

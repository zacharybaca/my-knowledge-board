import React, { useState } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useFetcher } from '../../../hooks/useFetcher';
import {
  Building2,
  Trash2,
  AlertTriangle,
  Settings,
  Plus,
  X,
} from 'lucide-react';
import Toast from '../../Layout/Toast/Toast';
import './workspace-management.css'; // Optional: You can reuse existing CSS or create this

const DEFAULT_DEPARTMENTS = [
  'Customer Service',
  'Tech Support',
  'Human Resources',
  'Sales',
  'Marketing',
  'Engineering',
  'Product',
  'Finance',
  'Legal',
  'Operations',
  'Other',
];

const WorkspaceManagement = () => {
  const { user, setUser } = useAuth();
  const { fetcher } = useFetcher();
  const [toastConfig, setToastConfig] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [managingDepartmentsFor, setManagingDepartmentsFor] = useState(null);
  const [departmentsDraft, setDepartmentsDraft] = useState([]);
  const [newDeptInput, setNewDeptInput] = useState('');
  const [isSavingDepartments, setIsSavingDepartments] = useState(false);
  const [uploadingLogoFor, setUploadingLogoFor] = useState(null);

  // Fallback to empty array if not loaded yet
  const workspaces = Array.isArray(user?.companyId) ? user.companyId : [];

  const handleOpenDepartmentManager = async (workspace) => {
    setManagingDepartmentsFor(workspace._id);
    setNewDeptInput('');

    if (
      Array.isArray(workspace.departments) &&
      workspace.departments.length > 0
    ) {
      setDepartmentsDraft(workspace.departments);
      return;
    }

    const response = await fetcher(`/api/companies/${workspace._id}`);
    if (response.success && Array.isArray(response.data?.departments)) {
      setDepartmentsDraft(
        response.data.departments.length > 0
          ? response.data.departments
          : DEFAULT_DEPARTMENTS
      );
    } else {
      setDepartmentsDraft(DEFAULT_DEPARTMENTS);
    }
  };

  const handleAddDepartment = () => {
    const trimmed = newDeptInput.trim();
    if (!trimmed || departmentsDraft.includes(trimmed)) return;
    setDepartmentsDraft((prev) => [...prev, trimmed]);
    setNewDeptInput('');
  };

  const handleRemoveDepartment = (dept) => {
    setDepartmentsDraft((prev) => prev.filter((d) => d !== dept));
  };

  const handleSaveDepartments = async (workspaceId) => {
    setIsSavingDepartments(true);
    const response = await fetcher(
      `/api/companies/${workspaceId}/departments`,
      {
        method: 'PATCH',
        body: JSON.stringify({ departments: departmentsDraft }),
      }
    );

    if (response.success) {
      setToastConfig({ type: 'success', message: 'Departments updated.' });
      setManagingDepartmentsFor(null);
    } else {
      setToastConfig({
        type: 'error',
        message: response.error || 'Failed to update departments.',
      });
    }
    setIsSavingDepartments(false);
  };

  const handleLogoUpload = async (workspaceId, file) => {
    if (!file) return;
    setUploadingLogoFor(workspaceId);

    const formData = new FormData();
    formData.append('companyLogo', file);

    const response = await fetcher(`/api/companies/${workspaceId}/logo`, {
      method: 'PATCH',
      body: formData,
    });

    if (response.success) {
      setToastConfig({
        type: 'success',
        message: 'Logo updated successfully.',
      });
      const updatedWorkspaces = workspaces.map((w) =>
        w._id === workspaceId ? { ...w, imageUrl: response.data.imageUrl } : w
      );
      setUser({ ...user, companyId: updatedWorkspaces });
    } else {
      setToastConfig({
        type: 'error',
        message: response.error || 'Failed to update logo.',
      });
    }
    setUploadingLogoFor(null);
  };

  const handleDeleteWorkspace = async (workspaceId, workspaceName) => {
    // 1. Strict Confirmation Prompt
    const confirmDelete = window.confirm(
      `DANGER ZONE: Are you absolutely sure you want to delete the workspace "${workspaceName}"?\n\nThis will permanently delete all associated articles, users (who only belong to this workspace), and data. THIS CANNOT BE UNDONE.`
    );

    if (!confirmDelete) return;

    // 2. Secondary Confirmation for safety
    const textConfirm = window.prompt(
      `Type "${workspaceName}" to confirm deletion:`
    );
    if (textConfirm !== workspaceName) {
      setToastConfig({
        type: 'error',
        message: 'Deletion cancelled: Name did not match.',
      });
      return;
    }

    setIsDeleting(true);

    try {
      const response = await fetcher(`/api/companies/${workspaceId}`, {
        method: 'DELETE',
      });

      if (response.success) {
        setToastConfig({
          type: 'success',
          message: 'Workspace successfully deleted.',
        });

        // Update local user state to remove the deleted workspace from the UI immediately
        const updatedWorkspaces = workspaces.filter(
          (w) => w._id !== workspaceId
        );
        setUser({ ...user, companyId: updatedWorkspaces });
      } else {
        setToastConfig({
          type: 'error',
          message: response.error || 'Failed to delete workspace.',
        });
      }
    } catch {
      setToastConfig({
        type: 'error',
        message: 'A server error occurred during deletion.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="dashboard-container">
      {toastConfig && (
        <Toast
          message={toastConfig.message}
          type={toastConfig.type}
          onClose={() => setToastConfig(null)}
        />
      )}

      <header className="dashboard-header">
        <h1>Workspace Management</h1>
        <p>Manage and configure your registered organization workspaces.</p>
      </header>

      <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr' }}>
        <section className="dashboard-card">
          <div className="card-header">
            <Building2 size={20} className="card-icon" />
            <h2>My Workspaces</h2>
          </div>

          <div className="card-content">
            {workspaces.length === 0 ? (
              <p className="empty-state">No workspaces found.</p>
            ) : (
              <ul className="article-list">
                {workspaces.map((workspace) => (
                  <li
                    key={workspace._id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '16px 0',
                      borderBottom: '1px solid #e2e8f0',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px',
                      }}
                    >
                      {workspace.imageUrl ? (
                        <img
                          src={workspace.imageUrl}
                          alt="logo"
                          style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '8px',
                            objectFit: 'cover',
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '8px',
                            backgroundColor: '#f1f5f9',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Building2 size={20} color="#94a3b8" />
                        </div>
                      )}
                      <label
                        title={
                          workspace.imageUrl ? 'Change logo' : 'Upload logo'
                        }
                        style={{ cursor: 'pointer', lineHeight: 0 }}
                      >
                        <input
                          type="file"
                          accept="image/jpeg, image/png, image/webp"
                          style={{ display: 'none' }}
                          disabled={uploadingLogoFor === workspace._id}
                          onChange={(e) =>
                            handleLogoUpload(workspace._id, e.target.files[0])
                          }
                        />
                        <span
                          style={{
                            fontSize: '0.75rem',
                            color: '#4338ca',
                            textDecoration: 'underline',
                          }}
                        >
                          {uploadingLogoFor === workspace._id
                            ? 'Uploading…'
                            : workspace.imageUrl
                              ? 'Change'
                              : 'Upload'}
                        </span>
                      </label>
                      <div>
                        <h3
                          style={{
                            margin: 0,
                            color: '#0f172a',
                            fontSize: '1.1rem',
                          }}
                        >
                          {workspace.name}
                        </h3>
                        <span style={{ color: '#64748b', fontSize: '0.85rem' }}>
                          {workspace.emailDomain}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        onClick={() => handleOpenDepartmentManager(workspace)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          backgroundColor: '#eef2ff',
                          color: '#4338ca',
                          border: '1px solid #c7d2fe',
                          padding: '8px 16px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: 'bold',
                        }}
                      >
                        <Settings size={18} />
                        Manage Departments
                      </button>
                      <button
                        onClick={() =>
                          handleDeleteWorkspace(workspace._id, workspace.name)
                        }
                        disabled={isDeleting}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          backgroundColor: '#fee2e2',
                          color: '#ef4444',
                          border: '1px solid #f87171',
                          padding: '8px 16px',
                          borderRadius: '6px',
                          cursor: isDeleting ? 'not-allowed' : 'pointer',
                          fontWeight: 'bold',
                          transition: 'background-color 0.2s',
                        }}
                        onMouseOver={(e) =>
                          (e.currentTarget.style.backgroundColor = '#fecaca')
                        }
                        onMouseOut={(e) =>
                          (e.currentTarget.style.backgroundColor = '#fee2e2')
                        }
                      >
                        <Trash2 size={18} />
                        {isDeleting ? 'Deleting...' : 'Delete Workspace'}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {managingDepartmentsFor && (
              <div className="department-manager-panel">
                <h4>Manage Departments</h4>
                <p>
                  Customize the department list used for this workspace's
                  articles and filters. Leave empty to use the default list.
                </p>
                <div className="department-chip-list">
                  {departmentsDraft.map((dept) => (
                    <span key={dept} className="department-chip">
                      {dept}
                      <button
                        type="button"
                        onClick={() => handleRemoveDepartment(dept)}
                        aria-label={`Remove ${dept}`}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="department-add-row">
                  <input
                    type="text"
                    value={newDeptInput}
                    onChange={(e) => setNewDeptInput(e.target.value)}
                    placeholder="Add department..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddDepartment();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleAddDepartment}
                  >
                    <Plus size={14} /> Add
                  </button>
                </div>
                <div className="department-manager-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setManagingDepartmentsFor(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={isSavingDepartments}
                    onClick={() =>
                      handleSaveDepartments(managingDepartmentsFor)
                    }
                  >
                    {isSavingDepartments ? 'Saving...' : 'Save Departments'}
                  </button>
                </div>
              </div>
            )}

            <div
              style={{
                marginTop: '24px',
                padding: '16px',
                backgroundColor: '#fffbeb',
                borderLeft: '4px solid #f59e0b',
                borderRadius: '4px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: '#b45309',
                  fontWeight: 'bold',
                  marginBottom: '8px',
                }}
              >
                <AlertTriangle size={18} />
                Warning
              </div>
              <p style={{ margin: 0, color: '#92400e', fontSize: '0.9rem' }}>
                Deleting a workspace is a permanent action. It will instantly
                remove all articles, files, and users strictly tied to that
                domain. Ensure you have backed up any necessary data before
                proceeding.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default WorkspaceManagement;

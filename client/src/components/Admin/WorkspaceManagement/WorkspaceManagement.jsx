import React, { useState } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useFetcher } from '../../../hooks/useFetcher';
import { Building2, Trash2, AlertTriangle } from 'lucide-react';
import Toast from '../../Layout/Toast/Toast';
import './workspace-management.css'; // Optional: You can reuse existing CSS or create this

const WorkspaceManagement = () => {
  const { user, setUser } = useAuth();
  const { fetcher } = useFetcher();
  const [toastConfig, setToastConfig] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fallback to empty array if not loaded yet
  const workspaces = Array.isArray(user?.companyId) ? user.companyId : [];

  const handleDeleteWorkspace = async (workspaceId, workspaceName) => {
    // 1. Strict Confirmation Prompt
    const confirmDelete = window.confirm(
      `DANGER ZONE: Are you absolutely sure you want to delete the workspace "${workspaceName}"?\n\nThis will permanently delete all associated articles, users (who only belong to this workspace), and data. THIS CANNOT BE UNDONE.`
    );

    if (!confirmDelete) return;

    // 2. Secondary Confirmation for safety
    const textConfirm = window.prompt(`Type "${workspaceName}" to confirm deletion:`);
    if (textConfirm !== workspaceName) {
      setToastConfig({ type: 'error', message: 'Deletion cancelled: Name did not match.' });
      return;
    }

    setIsDeleting(true);

    try {
      const response = await fetcher(`/api/companies/${workspaceId}`, {
        method: 'DELETE',
      });

      if (response.success) {
        setToastConfig({ type: 'success', message: 'Workspace successfully deleted.' });

        // Update local user state to remove the deleted workspace from the UI immediately
        const updatedWorkspaces = workspaces.filter(w => w._id !== workspaceId);
        setUser({ ...user, companyId: updatedWorkspaces });
      } else {
        setToastConfig({ type: 'error', message: response.error || 'Failed to delete workspace.' });
      }
    } catch (error) {
      setToastConfig({ type: 'error', message: 'A server error occurred during deletion.' });
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
                  <li key={workspace._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      {workspace.imageUrl ? (
                        <img src={workspace.imageUrl} alt="logo" style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Building2 size={20} color="#94a3b8" />
                        </div>
                      )}
                      <div>
                        <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.1rem' }}>{workspace.name}</h3>
                        <span style={{ color: '#64748b', fontSize: '0.85rem' }}>{workspace.emailDomain}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteWorkspace(workspace._id, workspace.name)}
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
                        transition: 'background-color 0.2s'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#fecaca'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#fee2e2'}
                    >
                      <Trash2 size={18} />
                      {isDeleting ? 'Deleting...' : 'Delete Workspace'}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div style={{ marginTop: '24px', padding: '16px', backgroundColor: '#fffbeb', borderLeft: '4px solid #f59e0b', borderRadius: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#b45309', fontWeight: 'bold', marginBottom: '8px' }}>
                <AlertTriangle size={18} />
                Warning
              </div>
              <p style={{ margin: 0, color: '#92400e', fontSize: '0.9rem' }}>
                Deleting a workspace is a permanent action. It will instantly remove all articles, files, and users strictly tied to that domain. Ensure you have backed up any necessary data before proceeding.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default WorkspaceManagement;

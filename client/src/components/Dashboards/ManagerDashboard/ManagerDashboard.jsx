import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import { useFetcher } from '../../../hooks/useFetcher';
import { useSocket } from '../../../hooks/useSocket';
import { ClipboardCheck, FileText, UserPlus, Clock } from 'lucide-react'; // <-- Imported Clock icon
import Toast from '../../Layout/Toast/Toast';
import NotificationBell from '../../Notifications/NotificationBell';
import '../dashboards.css';

const ManagerDashboard = () => {
  const { user } = useAuth();
  const { fetcher } = useFetcher();
  const socket = useSocket();

  const [pendingArticles, setPendingArticles] = useState([]);
  const [myArticles, setMyArticles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toastConfig, setToastConfig] = useState(null);
  const [selectedArticleIds, setSelectedArticleIds] = useState([]);
  const [analytics, setAnalytics] = useState({ totals: 0, topViewed: [] });

  const fetchDashboardData = useCallback(async () => {
    const [pendingRes, personalRes, analyticsRes] = await Promise.all([
      fetcher('/api/articles/pending'),
      fetcher('/api/articles/my-articles'),
      fetcher('/api/articles/analytics'),
    ]);

    if (pendingRes.success) setPendingArticles(pendingRes.data);
    if (personalRes.success) setMyArticles(personalRes.data.slice(0, 5));
    if (analyticsRes.success) setAnalytics(analyticsRes.data);

    setIsLoading(false);
  }, [fetcher]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useEffect(() => {
    if (!socket) return;

    socket.on('article_status_update', (data) => {
      setToastConfig({
        message: data.message,
        type: data.status === 'Rejected' ? 'error' : 'success',
      });
      fetchDashboardData();
    });

    return () => socket.off('article_status_update');
  }, [socket, fetchDashboardData]);

  if (isLoading)
    return (
      <div className="dashboard-loading">
        <div className="spinner"></div>
      </div>
    );

  const togglePendingSelection = (articleId) => {
    setSelectedArticleIds((prev) =>
      prev.includes(articleId)
        ? prev.filter((id) => id !== articleId)
        : [...prev, articleId]
    );
  };

  const handleBulkStatus = async (status) => {
    if (selectedArticleIds.length === 0) return;
    const rejectionReason =
      status === 'Rejected'
        ? window.prompt('Optional rejection reason for all selected articles:') || ''
        : '';

    const response = await fetcher('/api/articles/bulk-status', {
      method: 'PATCH',
      body: JSON.stringify({
        articleIds: selectedArticleIds,
        status,
        rejectionReason,
      }),
    });

    if (response.success) {
      setSelectedArticleIds([]);
      fetchDashboardData();
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

      <header
        className="dashboard-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <div>
          <h1>Manager Overview</h1>
          <p>Review pending submissions and manage your content.</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center' }}>
          <NotificationBell />
          <Link
            to="/create-user"
            className="action-btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              textDecoration: 'none',
            }}
          >
            <UserPlus size={18} />
            <span>Provision Account</span>
          </Link>
        </div>
      </header>

      <div className="dashboard-metrics">
        <div className="metric-card">
          <div className="metric-icon pending-icon">
            <ClipboardCheck size={24} />
          </div>
          <div className="metric-data">
            <h3>{pendingArticles.length}</h3>
            <p>Pending Approvals</p>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-icon active-icon">
            <FileText size={24} />
          </div>
          <div className="metric-data">
            <h3>{myArticles.length}</h3>
            <p>Your Submissions</p>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-icon active-icon">
            <FileText size={24} />
          </div>
          <div className="metric-data">
            <h3>{analytics.totals || 0}</h3>
            <p>Published Articles</p>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        <section className="dashboard-card approval-queue">
          <div className="card-header">
            <ClipboardCheck size={20} className="card-icon" />
            <h2>Approval Queue</h2>
            <div className="bulk-action-row">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => handleBulkStatus('Approved')}
                disabled={selectedArticleIds.length === 0}
              >
                Bulk Approve
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => handleBulkStatus('Rejected')}
                disabled={selectedArticleIds.length === 0}
              >
                Bulk Reject
              </button>
            </div>
          </div>
          <div className="card-content">
            {pendingArticles.length === 0 ? (
              <p className="empty-state">
                No articles currently pending review.
              </p>
            ) : (
              <ul className="article-list">
                {pendingArticles.map((article) => {
                  const depts = Array.isArray(article.department)
                    ? article.department
                    : [article.department];
                  return (
                    <li key={article._id}>
                      <div className="pending-checkbox-wrap">
                        <input
                          type="checkbox"
                          aria-label={`Select "${article.title}" for bulk actions`}
                          checked={selectedArticleIds.includes(article._id)}
                          onChange={() => togglePendingSelection(article._id)}
                        />
                      </div>
                      <Link
                        to={`/queue/${article._id}`}
                        className="article-link flex-between"
                      >
                        <div>
                          <span className="article-title">{article.title}</span>
                          <span className="article-meta">
                            {depts.map((dept, i) => (
                              <span key={i} className="department-badge">
                                {dept}
                              </span>
                            ))}
                            Submitted by {article.authorId?.firstName}{' '}
                            {article.authorId?.lastName}
                          </span>
                        </div>
                        <span className="action-btn">Review</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <section className="dashboard-card">
          <div className="card-header" style={{ flexWrap: 'wrap' }}>
            <FileText size={20} className="card-icon" />
            <h2 style={{ flexGrow: 1 }}>My Submissions</h2>
            <div
              style={{
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <Link to="/articles/new" className="action-link">
                Write Article
              </Link>
              <Link to="/user-management" className="btn-secondary">
                Manage Users
              </Link>
              <Link
                to="/session-logs"
                className="btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Clock size={16} />
                View Access Logs
              </Link>

              {/* NEW: Workspace Management Link (Admins Only) */}
              {(Array.isArray(user.role)
                ? user.role.includes('Admin')
                : user.role === 'Admin') && (
                <Link
                  to="/workspaces"
                  className="btn-secondary"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: '#ef4444',
                    borderColor: '#ef4444',
                  }}
                >
                  Manage Workspaces
                </Link>
              )}
            </div>
          </div>
          <div className="card-content">
            {myArticles.length === 0 ? (
              <p className="empty-state">You haven't submitted any articles.</p>
            ) : (
              <ul className="article-list">
                {myArticles.map((article) => {
                  const depts = Array.isArray(article.department)
                    ? article.department
                    : [article.department];
                  return (
                    <li key={article._id}>
                      <Link
                        to={`/articles/${article._id}`}
                        className="article-link flex-between"
                      >
                        <span className="article-title">
                          {depts.map((dept, i) => (
                            <span key={i} className="department-badge">
                              {dept}
                            </span>
                          ))}
                          {article.title}
                        </span>
                        <span
                          className={`status-badge status-${article.status.toLowerCase()}`}
                        >
                          {article.status}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
        <section className="dashboard-card">
          <div className="card-header">
            <Clock size={20} className="card-icon" />
            <h2>Top Viewed Articles</h2>
          </div>
          <div className="card-content">
            {analytics.topViewed?.length ? (
              <ul className="article-list">
                {analytics.topViewed.map((item) => (
                  <li key={item._id}>
                    <Link to={`/articles/${item._id}`} className="article-link">
                      <div className="article-meta-container">
                        <span className="article-title">{item.title}</span>
                        <span className="article-meta">{item.views} views</span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-state">No analytics data available yet.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default ManagerDashboard;

import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import { useFetcher } from '../../../hooks/useFetcher';
import { useSocket } from '../../../hooks/useSocket';
import { ClipboardCheck, FileText, UserPlus } from 'lucide-react';
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

  // Wrapped in useCallback so we can call it on mount AND when socket events fire
  const fetchDashboardData = useCallback(async () => {
    const [pendingRes, personalRes] = await Promise.all([
      fetcher('/api/articles/pending'),
      fetcher('/api/articles/my-articles'),
    ]);

    if (pendingRes.success) setPendingArticles(pendingRes.data);
    if (personalRes.success) setMyArticles(personalRes.data.slice(0, 5));

    setIsLoading(false);
  }, [fetcher]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useEffect(() => {
    if (!socket) return;

    socket.on('article_status_update', (data) => {
      // Trigger UI notification
      setToastConfig({
        message: data.message,
        type: data.status === 'Rejected' ? 'error' : 'success'
      });

      // Refresh data to instantly move articles between queues
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

  const departmentBadgeStyle = {
    backgroundColor: '#f1f5f9',
    border: '1px solid #cbd5e1',
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '0.7rem',
    marginRight: '8px',
    color: '#475569',
    fontWeight: '600',
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
      </div>

      <div className="dashboard-grid">
        <section className="dashboard-card approval-queue">
          <div className="card-header">
            <ClipboardCheck size={20} className="card-icon" />
            <h2>Approval Queue</h2>
          </div>
          <div className="card-content">
            {pendingArticles.length === 0 ? (
              <p className="empty-state">
                No articles currently pending review.
              </p>
            ) : (
              <ul className="article-list">
                {pendingArticles.map((article) => {
                  const depts = Array.isArray(article.department) ? article.department : [article.department];
                  return (
                    <li key={article._id}>
                      <Link
                        to={`/queue/${article._id}`}
                        className="article-link flex-between"
                      >
                        <div>
                          <span className="article-title">{article.title}</span>
                          <span className="article-meta">
                            {depts.map((dept, i) => (
                              <span key={i} style={departmentBadgeStyle}>
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
                  )
                })}
              </ul>
            )}
          </div>
        </section>

        <section className="dashboard-card">
          <div className="card-header">
            <FileText size={20} className="card-icon" />
            <h2>My Submissions</h2>
            <Link to="/articles/new" className="action-link">
              Write Article
            </Link>
            <Link to="/user-management" className="btn-secondary">
              Manage Users
            </Link>
          </div>
          <div className="card-content">
            {myArticles.length === 0 ? (
              <p className="empty-state">You haven't submitted any articles.</p>
            ) : (
              <ul className="article-list">
                {myArticles.map((article) => {
                  const depts = Array.isArray(article.department) ? article.department : [article.department];
                  return (
                    <li key={article._id}>
                      <Link
                        to={`/articles/${article._id}`}
                        className="article-link flex-between"
                      >
                        <span className="article-title">
                          {depts.map((dept, i) => (
                            <span key={i} style={departmentBadgeStyle}>
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
                  )
                })}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default ManagerDashboard;
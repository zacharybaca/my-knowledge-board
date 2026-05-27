import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import { useFetcher } from '../../../hooks/useFetcher';
import { useSocket } from '../../../hooks/useSocket';
import { ClipboardCheck, FileText, UserPlus } from 'lucide-react';
import '../dashboards.css';

const ManagerDashboard = () => {
  const { user } = useAuth();
  const { fetcher } = useFetcher();
  const socket = useSocket();

  const [pendingArticles, setPendingArticles] = useState([]);
  const [myArticles, setMyArticles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      const [pendingRes, personalRes] = await Promise.all([
        fetcher('/api/articles/pending'),
        fetcher('/api/articles/my-articles'),
      ]);

      if (pendingRes.success) setPendingArticles(pendingRes.data);
      if (personalRes.success) setMyArticles(personalRes.data.slice(0, 5));

      setIsLoading(false);
    };

    fetchDashboardData();
  }, [fetcher]);

  useEffect(() => {
    if (!socket) return;

    socket.on('article_status_update', (data) => {
      // Trigger UI notification
      alert(data.message);
      // Replace with: toast.info(data.message);

      // Execute state refresh logic here to update article lists
    });

    return () => socket.off('article_status_update');
  }, [socket]);

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
                {pendingArticles.map((article) => (
                  <li key={article._id}>
                    <Link
                      to={`/queue/${article._id}`}
                      className="article-link flex-between"
                    >
                      <div>
                        <span className="article-title">{article.title}</span>
                        <span className="article-meta">
                          <span style={departmentBadgeStyle}>
                            {article.department}
                          </span>
                          Submitted by {article.authorId?.firstName}{' '}
                          {article.authorId?.lastName}
                        </span>
                      </div>
                      <span className="action-btn">Review</span>
                    </Link>
                  </li>
                ))}
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
                {myArticles.map((article) => (
                  <li key={article._id}>
                    <Link
                      to={`/articles/${article._id}`}
                      className="article-link flex-between"
                    >
                      <span className="article-title">
                        <span style={departmentBadgeStyle}>
                          {article.department}
                        </span>
                        {article.title}
                      </span>
                      <span
                        className={`status-badge status-${article.status.toLowerCase()}`}
                      >
                        {article.status}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default ManagerDashboard;

import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import { useFetcher } from '../../../hooks/useFetcher';
import { useSocket } from '../../../hooks/useSocket';
import { Search, BookOpen, FileText, Pin } from 'lucide-react';
import PinButton from '../../Article/PinButton/PinButton';
import Toast from '../../Layout/Toast/Toast.jsx'; 
import NotificationBell from '../../Notifications/NotificationBell';
import '../dashboards.css';

const EmployeeDashboard = () => {
  const { user } = useAuth();
  const { fetcher } = useFetcher();
  const navigate = useNavigate();
  const socket = useSocket();
  const [recentArticles, setRecentArticles] = useState([]);
  const [myArticles, setMyArticles] = useState([]);
  const [pinnedArticles, setPinnedArticles] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [toastConfig, setToastConfig] = useState(null);

  const fetchDashboardData = useCallback(async () => {
    const [recentRes, personalRes, pinnedRes] = await Promise.all([
      fetcher('/api/articles'),
      fetcher('/api/articles/my-articles'),
      fetcher('/api/articles/favorites'),
    ]);

    if (recentRes.success) setRecentArticles(recentRes.data.slice(0, 5));
    if (personalRes.success) setMyArticles(personalRes.data.slice(0, 5));
    if (pinnedRes.success) setPinnedArticles(pinnedRes.data);

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

      // Refresh data to reflect newly approved/rejected articles
      fetchDashboardData();
    });

    return () => socket.off('article_status_update');
  }, [socket, fetchDashboardData]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  const handlePinToggle = (articleObj, isPinnedState) => {
    if (isPinnedState) {
      setPinnedArticles((prev) => {
        if (prev.some((p) => p._id === articleObj._id)) return prev;
        return [articleObj, ...prev];
      });
    } else {
      setPinnedArticles((prev) =>
        prev.filter((article) => article._id !== articleObj._id)
      );
    }
  };

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

      <header className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1>Welcome, {user?.firstName}</h1>
            <p>Access company policies, process guides, and documentation.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', marginTop: '16px' }}>
            <NotificationBell />
          </div>
        </header>

      <div className="dashboard-search-section">
        <form onSubmit={handleSearch} className="dashboard-search-form">
          <Search className="search-icon" size={20} />
          <input
            type="text"
            placeholder="Search the KnowledgeBase..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="dashboard-search-input"
          />
          <button type="submit" className="dashboard-search-btn">
            Search
          </button>
        </form>
      </div>

      <div className="dashboard-grid">
        <section className="dashboard-card" style={{ gridColumn: '1 / -1' }}>
          <div className="card-header">
            <Pin size={20} className="card-icon" />
            <h2>Pinned Articles</h2>
          </div>
          <div className="card-content">
            {pinnedArticles.length === 0 ? (
              <p className="empty-state">
                You have no pinned articles. Pin articles to access them
                quickly.
              </p>
            ) : (
              <ul className="article-list">
                {pinnedArticles.map((article) => {
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
                        <PinButton
                          articleId={article._id}
                          initialIsPinned={true}
                          onToggleComplete={(id, isPinned) =>
                            handlePinToggle(article, isPinned)
                          }
                        />
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
            <BookOpen size={20} className="card-icon" />
            <h2>Recently Published</h2>
          </div>
          <div className="card-content">
            {recentArticles.length === 0 ? (
              <p className="empty-state">No articles published yet.</p>
            ) : (
              <ul className="article-list">
                {recentArticles.map((article) => {
                  const depts = Array.isArray(article.department) ? article.department : [article.department];
                  return (
                    <li key={article._id}>
                      <Link
                        to={`/articles/${article._id}`}
                        className="article-link flex-between"
                      >
                        <div className="article-meta-container">
                          <span className="article-title">{article.title}</span>
                          <span className="article-meta">
                            {depts.map((dept, i) => (
                              <span key={i} style={departmentBadgeStyle}>
                                {dept}
                              </span>
                            ))}
                            By {article.authorId?.firstName}{' '}
                            {article.authorId?.lastName}
                          </span>
                        </div>
                        <PinButton
                          articleId={article._id}
                          initialIsPinned={pinnedArticles.some(
                            (p) => p._id === article._id
                          )}
                          onToggleComplete={(id, isPinned) =>
                            handlePinToggle(article, isPinned)
                          }
                        />
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
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                          }}
                        >
                          <span
                            className="article-title"
                            style={{ marginBottom: 0 }}
                          >
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
                        </div>
                        <PinButton
                          articleId={article._id}
                          initialIsPinned={pinnedArticles.some(
                            (p) => p._id === article._id
                          )}
                          onToggleComplete={(id, isPinned) =>
                            handlePinToggle(article, isPinned)
                          }
                        />
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

export default EmployeeDashboard;
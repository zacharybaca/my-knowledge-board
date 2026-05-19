import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import { useFetcher } from '../../../hooks/useFetcher';
import { Search, BookOpen, FileText } from 'lucide-react';
import '../dashboards.css';

const EmployeeDashboard = () => {
  const { user } = useAuth();
  const { fetcher } = useFetcher();
  const navigate = useNavigate();

  const [recentArticles, setRecentArticles] = useState([]);
  const [myArticles, setMyArticles] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      // Fetch recently approved company articles and user's personal articles concurrently
      const [recentRes, personalRes] = await Promise.all([
        fetcher('/api/articles'),
        fetcher('/api/articles/my-articles'),
      ]);

      if (recentRes.success) setRecentArticles(recentRes.data.slice(0, 5));
      if (personalRes.success) setMyArticles(personalRes.data.slice(0, 5));

      setIsLoading(false);
    };

    fetchDashboardData();
  }, [fetcher]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
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
      <header className="dashboard-header">
        <div>
          <h1>Welcome, {user?.firstName}</h1>
          <p>Access company policies, process guides, and documentation.</p>
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
                {recentArticles.map((article) => (
                  <li key={article._id}>
                    <Link
                      to={`/articles/${article._id}`}
                      className="article-link"
                    >
                      <span className="article-title">{article.title}</span>
                      <span className="article-meta">
                        <span style={departmentBadgeStyle}>{article.department}</span>
                        By {article.authorId?.firstName}{' '}
                        {article.authorId?.lastName}
                      </span>
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
                        <span style={departmentBadgeStyle}>{article.department}</span>
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

export default EmployeeDashboard;

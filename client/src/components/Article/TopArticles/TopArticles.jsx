import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useFetcher } from '../../../hooks/useFetcher.js';
import { TrendingUp, Eye } from 'lucide-react';
import './top-articles.css';

const TopArticles = () => {
  const [topArticles, setTopArticles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { fetcher } = useFetcher();

  useEffect(() => {
    const fetchTopArticles = async () => {
      const response = await fetcher('/api/articles/top');
      if (response.success) {
        setTopArticles(response.data);
      }
      setIsLoading(false);
    };

    fetchTopArticles();
  }, [fetcher]);

  if (isLoading) return <div className="spinner" style={{ margin: '20px auto' }}></div>;

  if (topArticles.length === 0) return null;

  return (
    <div className="dashboard-card">
      <div className="card-header">
        <TrendingUp size={20} className="card-icon" style={{ color: '#3b82f6' }} />
        <h2>Most Viewed Articles</h2>
      </div>
      <div className="card-content">
        <ul className="article-list">
          {topArticles.map((article) => (
            <li key={article._id}>
              <Link to={`/articles/${article._id}`} className="article-link flex-between">
                <span className="article-title" style={{ fontSize: '0.9rem', color: '#334155', border: 'none' }}>
                  {article.title}
                </span>
                <span className="article-meta" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Eye size={14} /> {article.viewCount}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default TopArticles;

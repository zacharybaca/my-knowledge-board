import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useFetcher } from '../../../hooks/useFetcher';
import {
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import Toast from '../../Layout/Toast/Toast';
import './freshness-dashboard.css';

const getDaysUntilExpiry = (expiresAt) => {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

const ExpiryBadge = ({ days }) => {
  if (days === null) return null;
  if (days < 0)
    return (
      <span className="expiry-badge expired">
        <AlertCircle size={13} /> Expired {Math.abs(days)}d ago
      </span>
    );
  if (days <= 7)
    return (
      <span className="expiry-badge critical">
        <AlertTriangle size={13} /> {days}d left
      </span>
    );
  if (days <= 14)
    return (
      <span className="expiry-badge warning">
        <Clock size={13} /> {days}d left
      </span>
    );
  return (
    <span className="expiry-badge ok">
      <CheckCircle2 size={13} /> {days}d left
    </span>
  );
};

const FreshnessDashboard = () => {
  const { fetcher } = useFetcher();
  const [articles, setArticles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toastConfig, setToastConfig] = useState(null);
  const [certifyingId, setCertifyingId] = useState(null);

  const fetchQueue = useCallback(async () => {
    setIsLoading(true);
    const response = await fetcher('/api/articles/review-queue');
    if (response.success) {
      setArticles(response.data);
    }
    setIsLoading(false);
  }, [fetcher]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const handleCertify = async (articleId) => {
    setCertifyingId(articleId);
    const response = await fetcher(`/api/articles/${articleId}/certify`, {
      method: 'PATCH',
    });
    if (response.success) {
      setToastConfig({
        type: 'success',
        message: 'Article certified — expiry extended by 180 days.',
      });
      fetchQueue();
    } else {
      setToastConfig({
        type: 'error',
        message: response.error || 'Failed to certify article.',
      });
    }
    setCertifyingId(null);
  };

  const expired = articles.filter(
    (a) => a.expiresAt && new Date(a.expiresAt) < new Date()
  );
  const expiringSoon = articles.filter(
    (a) => a.expiresAt && new Date(a.expiresAt) >= new Date()
  );

  return (
    <div className="freshness-dashboard">
      {toastConfig && (
        <Toast
          message={toastConfig.message}
          type={toastConfig.type}
          onClose={() => setToastConfig(null)}
        />
      )}

      <header className="freshness-header">
        <ShieldCheck size={28} className="freshness-header-icon" />
        <div>
          <h1>Content Freshness</h1>
          <p>Articles expiring within 30 days or already past their review date.</p>
        </div>
      </header>

      <div className="freshness-metrics">
        <div className="freshness-metric-card metric-expired">
          <AlertCircle size={22} />
          <div>
            <h3>{expired.length}</h3>
            <p>Expired</p>
          </div>
        </div>
        <div className="freshness-metric-card metric-soon">
          <AlertTriangle size={22} />
          <div>
            <h3>{expiringSoon.length}</h3>
            <p>Expiring soon</p>
          </div>
        </div>
        <div className="freshness-metric-card metric-total">
          <Clock size={22} />
          <div>
            <h3>{articles.length}</h3>
            <p>Need attention</p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="freshness-loading">
          <div className="spinner" />
        </div>
      ) : articles.length === 0 ? (
        <div className="freshness-empty">
          <CheckCircle2 size={40} className="freshness-empty-icon" />
          <h3>All up to date</h3>
          <p>No articles are expiring within the next 30 days.</p>
        </div>
      ) : (
        <div className="freshness-table-wrapper">
          <table className="freshness-table">
            <thead>
              <tr>
                <th>Article</th>
                <th>Owner</th>
                <th>Last Reviewed</th>
                <th>Expiry</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {articles.map((article) => {
                const days = getDaysUntilExpiry(article.expiresAt);
                return (
                  <tr key={article._id}>
                    <td>
                      <Link
                        to={`/articles/${article._id}`}
                        className="freshness-article-link"
                      >
                        {article.title}
                      </Link>
                    </td>
                    <td>
                      {article.authorId?.firstName} {article.authorId?.lastName}
                    </td>
                    <td>
                      {article.lastReviewedAt
                        ? new Date(article.lastReviewedAt).toLocaleDateString()
                        : '—'}
                    </td>
                    <td>
                      {article.expiresAt
                        ? new Date(article.expiresAt).toLocaleDateString()
                        : '—'}
                    </td>
                    <td>
                      <ExpiryBadge days={days} />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="certify-btn"
                        disabled={certifyingId === article._id}
                        onClick={() => handleCertify(article._id)}
                      >
                        <ShieldCheck size={15} />
                        {certifyingId === article._id ? 'Certifying…' : 'Certify'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default FreshnessDashboard;

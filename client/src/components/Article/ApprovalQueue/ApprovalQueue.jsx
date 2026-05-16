import React, { useState, useEffect } from 'react';
import { useFetcher } from '../../../hooks/useFetcher.js';
import ArticleCard from '../ArticleCard/ArticleCard.jsx';
import { Inbox, AlertCircle } from 'lucide-react';
import './approval-queue.css';

const ApprovalQueue = () => {
  const [pendingArticles, setPendingArticles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const { fetcher } = useFetcher();

  useEffect(() => {
    const fetchPendingArticles = async () => {
      setIsLoading(true);
      setError(null);

      const response = await fetcher('/api/articles/pending');

      if (response.success) {
        setPendingArticles(response.data);
      } else {
        setError(response.error || 'Failed to load approval queue.');
      }

      setIsLoading(false);
    };

    fetchPendingArticles();
  }, [fetcher]);

  if (isLoading) {
    return (
      <div className="queue-status-container">
        <div className="spinner"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="queue-status-container error-state">
        <AlertCircle size={48} className="status-icon" />
        <h3>Error Loading Queue</h3>
        <p>{error}</p>
      </div>
    );
  }

  if (pendingArticles.length === 0) {
    return (
      <div className="queue-status-container empty-state">
        <Inbox size={48} className="status-icon" />
        <h3>You're all caught up!</h3>
        <p>There are no articles currently awaiting your review.</p>
      </div>
    );
  }

  return (
    <div className="approval-queue-container">
      <div className="queue-header">
        <div>
          <h2>Needs Review</h2>
          <p className="queue-subtitle">
            Articles submitted by employees awaiting manager approval.
          </p>
        </div>
        <span className="queue-count-badge">
          {pendingArticles.length} Pending
        </span>
      </div>

      <div className="queue-grid">
        {pendingArticles.map((article) => (
          <ArticleCard
            key={article._id}
            article={article}
            // Routes the manager to the review interface rather than the standard view
            linkTo={`/queue/${article._id}`}
          />
        ))}
      </div>
    </div>
  );
};

export default ApprovalQueue;

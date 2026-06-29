import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useFetcher } from '../../hooks/useFetcher';
import { ShieldCheck, AlertTriangle } from 'lucide-react';
import './review-queue.css';

const ReviewQueue = () => {
  const { fetcher } = useFetcher();
  const [queue, setQueue] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchQueue = useCallback(async () => {
    const response = await fetcher('/api/articles/review-queue');
    if (response.success) {
      setQueue(response.data);
    }
    setIsLoading(false);
  }, [fetcher]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const handleCertify = async (articleId) => {
    const response = await fetcher(`/api/articles/${articleId}/certify`, {
      method: 'PATCH',
    });

    if (response.success) {
      // Remove from queue visually
      setQueue((prev) => prev.filter((article) => article._id !== articleId));
    }
  };

  if (isLoading) return <div>Loading review queue...</div>;

  if (queue.length === 0) {
    return (
      <div className="review-queue-empty">
        <ShieldCheck size={48} className="success-icon" />
        <h3>Knowledge Base is Up to Date</h3>
        <p>No articles require certification at this time.</p>
      </div>
    );
  }

  return (
    <div className="review-queue-container">
      <h3>
        <AlertTriangle size={20} className="warning-icon" /> Expiration & Review
        Queue
      </h3>
      <table className="queue-table">
        <thead>
          <tr>
            <th>Article Title</th>
            <th>Author</th>
            <th>Expiration Date</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {queue.map((article) => {
            const isExpired = new Date(article.expiresAt) < new Date();
            return (
              <tr
                key={article._id}
                className={isExpired ? 'expired-row' : 'warning-row'}
              >
                <td>
                  <Link to={`/articles/${article._id}`}>{article.title}</Link>
                </td>
                <td>
                  {article.authorId?.firstName} {article.authorId?.lastName}
                </td>
                <td>
                  {new Date(article.expiresAt).toLocaleDateString()}
                  {isExpired && <span className="expired-badge">Expired</span>}
                </td>
                <td>
                  <button
                    onClick={() => handleCertify(article._id)}
                    className="btn-certify"
                  >
                    Certify Accuracy
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default ReviewQueue;

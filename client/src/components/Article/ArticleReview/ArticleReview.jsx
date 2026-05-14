import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFetcher } from '../../../hooks/useFetcher.js';
import { ArrowLeft, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import './article-review.css';
import '../ArticleView/ArticleView.css'; // Reusing base viewing styles

const ArticleReview = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { fetcher } = useFetcher();

  const [article, setArticle] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Modal State
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    const fetchArticle = async () => {
      setIsLoading(true);
      const response = await fetcher(`/api/articles/${id}`);

      if (response.success) {
        setArticle(response.data);
      } else {
        setError(response.error || 'Failed to load article.');
      }
      setIsLoading(false);
    };

    fetchArticle();
  }, [id, fetcher]);

  const handleReviewAction = async (status, reason = null) => {
    setIsSubmitting(true);

    const payload = { status };
    if (reason) {
      payload.rejectionReason = reason;
    }

    const response = await fetcher(`/api/articles/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });

    if (response.success) {
      // Return to Manager Dashboard upon successful review
      navigate('/manager-dashboard');
    } else {
      setError(response.error || `Failed to ${status.toLowerCase()} article.`);
      setIsSubmitting(false);
      setShowRejectModal(false);
    }
  };

  const handleRejectSubmit = (e) => {
    e.preventDefault();
    handleReviewAction('Rejected', rejectionReason);
  };

  if (isLoading) {
    return <div className="article-view-loading"><div className="spinner"></div></div>;
  }

  if (error || !article) {
    return (
      <div className="article-view-error">
        <h2>Cannot Load Review</h2>
        <p>{error}</p>
        <button onClick={() => navigate(-1)} className="btn-back">
          <ArrowLeft size={16} /> Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="article-review-container">

      {/* Fixed Action Bar at Top */}
      <div className="review-action-bar">
        <div className="action-bar-left">
          <button onClick={() => navigate(-1)} className="btn-back-action">
            <ArrowLeft size={16} /> Cancel Review
          </button>
          <span className="review-mode-indicator">
            <AlertTriangle size={16} /> Reviewing Pending Submission
          </span>
        </div>

        <div className="action-bar-right">
          <button
            className="btn-reject"
            onClick={() => setShowRejectModal(true)}
            disabled={isSubmitting}
          >
            <XCircle size={18} /> Reject
          </button>
          <button
            className="btn-approve"
            onClick={() => handleReviewAction('Approved')}
            disabled={isSubmitting}
          >
            <CheckCircle size={18} /> Approve & Publish
          </button>
        </div>
      </div>

      {/* Actual Article Content (Reusing ArticleView layout) */}
      <div className="review-content-wrapper">
        <article className="article-wrapper">
          <header className="article-header">
            <h1 className="article-title">{article.title}</h1>
            <div className="article-meta-bottom">
              <span>Author: {article.authorId?.firstName} {article.authorId?.lastName}</span>
              <span>Submitted: {new Date(article.createdAt).toLocaleDateString()}</span>
            </div>
          </header>

          <div
            className="article-body"
            dangerouslySetInnerHTML={{ __html: article.content }}
          />
        </article>
      </div>

      {/* Rejection Modal */}
      {showRejectModal && (
        <div className="modal-overlay">
          <div className="reject-modal">
            <h2>Reject Submission</h2>
            <p>Please provide a reason for rejecting this article. This feedback will be sent directly to the author so they can make corrections.</p>

            <form onSubmit={handleRejectSubmit}>
              <textarea
                autoFocus
                placeholder="e.g., Please clarify the steps in Section 2 and fix the formatting on the final paragraph."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                required
                rows="5"
              />
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={() => setShowRejectModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-modal-confirm"
                  disabled={isSubmitting || !rejectionReason.trim()}
                >
                  {isSubmitting ? 'Processing...' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default ArticleReview;

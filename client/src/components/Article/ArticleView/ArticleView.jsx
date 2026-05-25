import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFetcher } from '../../../hooks/useFetcher.js';
import { useAuth } from '../../../hooks/useAuth.js';
import { ArrowLeft, Clock, Eye, User, Tag, Edit, AlertCircle, ThumbsUp, ThumbsDown } from 'lucide-react';
import './article-view.css';

const ArticleView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { fetcher } = useFetcher();
  const { user } = useAuth();

  const [article, setArticle] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isVoting, setIsVoting] = useState(false);

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

  const handleVote = async (voteType) => {
    if (isVoting || !article) return;
    setIsVoting(true);

    const response = await fetcher(`/api/articles/${id}/vote`, {
      method: 'PATCH',
      body: JSON.stringify({ voteType })
    });

    if (response.success) {
      setArticle(prev => ({
        ...prev,
        upvotes: response.data.upvotes,
        downvotes: response.data.downvotes
      }));
    }
    setIsVoting(false);
  };

  if (isLoading) {
    return (
      <div className="article-view-loading">
        <div className="spinner"></div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="article-view-error">
        <h2>Article Not Found</h2>
        <p>{error}</p>
        <button onClick={() => navigate(-1)} className="btn-back">
          <ArrowLeft size={16} /> Go Back
        </button>
      </div>
    );
  }

  const canEdit =
    user?.role === 'Admin' ||
    user?.role === 'Manager' ||
    user?._id === article.authorId?._id;

  // Calculate Helpfulness Metrics
  const upvotesCount = article.upvotes?.length || 0;
  const downvotesCount = article.downvotes?.length || 0;
  const totalVotes = upvotesCount + downvotesCount;
  const helpfulPercentage = totalVotes === 0 ? 0 : Math.round((upvotesCount / totalVotes) * 100);

  const hasUpvoted = article.upvotes?.includes(user?._id);
  const hasDownvoted = article.downvotes?.includes(user?._id);

  return (
    <div className="article-view-container">
      <div className="article-view-controls">
        <button onClick={() => navigate(-1)} className="btn-back">
          <ArrowLeft size={16} /> Back to Dashboard
        </button>

        {canEdit && (
          <button
            onClick={() => navigate(`/articles/${article._id}/edit`)}
            className="btn-edit"
          >
            <Edit size={16} /> Edit Article
          </button>
        )}
      </div>

      {article.status === 'Rejected' && article.rejectionReason && (
        <div className="rejection-alert-banner">
          <AlertCircle size={24} className="rejection-icon" />
          <div className="rejection-content">
            <h4>Revisions Required</h4>
            <p><strong>Manager Feedback:</strong> {article.rejectionReason}</p>
          </div>
        </div>
      )}

      <article className="article-wrapper">
        <header className="article-header">
          <div className="article-meta-top">
            <span
              className={`status-badge status-${article.status.toLowerCase()}`}
            >
              {article.status}
            </span>
          </div>

          <h1 className="article-title">{article.title}</h1>

          <div className="article-meta-bottom">
            <div className="meta-item">
              <User size={16} />
              <span>
                {article.authorId?.firstName} {article.authorId?.lastName}
              </span>
            </div>
            <div className="meta-item">
              <Clock size={16} />
              <span>{new Date(article.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="meta-item">
              <Eye size={16} />
              <span>{article.viewCount} views</span>
            </div>
          </div>

          {article.tags && article.tags.length > 0 && (
            <div className="article-tags">
              <Tag size={16} className="tag-icon" />
              {article.tags.map((tag, index) => (
                <span key={index} className="tag-pill">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </header>

        <div
          className="article-body"
          dangerouslySetInnerHTML={{ __html: article.content }}
        />

        {/* Voting Section */}
        <div className="article-voting-section">
          <div className="voting-metrics">
            <h4>Was this article helpful?</h4>
            {totalVotes > 0 && (
              <span className="helpfulness-rating">
                {helpfulPercentage}% found this helpful ({totalVotes} votes)
              </span>
            )}
          </div>
          <div className="voting-controls">
            <button
              onClick={() => handleVote('up')}
              disabled={isVoting}
              className={`vote-btn ${hasUpvoted ? 'active-upvote' : ''}`}
            >
              <ThumbsUp size={18} /> Yes
            </button>
            <button
              onClick={() => handleVote('down')}
              disabled={isVoting}
              className={`vote-btn ${hasDownvoted ? 'active-downvote' : ''}`}
            >
              <ThumbsDown size={18} /> No
            </button>
          </div>
        </div>
      </article>
    </div>
  );
};

export default ArticleView;

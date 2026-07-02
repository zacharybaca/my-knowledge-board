import React, { useState, useEffect } from 'react';
import { Eye, ThumbsUp, ThumbsDown, CheckCircle2, XCircle, MessageSquare } from 'lucide-react';
import { useFetcher } from '../../../hooks/useFetcher.js';
import { useAuth } from '../../../hooks/useAuth.js';
import './article-metrics.css';

const ArticleMetrics = ({ articleId, article }) => {
  const { fetcher } = useFetcher();
  const { user } = useAuth();
  const [metrics, setMetrics] = useState(null);

  const isAuthor = user?._id === article?.authorId?._id;
  const isManager =
    user?.role?.includes('Admin') || user?.role?.includes('Manager');
  const canView = isAuthor || isManager;

  useEffect(() => {
    if (!articleId || !canView) return;

    const fetchMetrics = async () => {
      const response = await fetcher(`/api/articles/${articleId}/metrics`);
      if (response.success) {
        setMetrics(response.data);
      }
    };

    fetchMetrics();
  }, [articleId, canView, fetcher]);

  if (!canView || !metrics) return null;

  return (
    <div className="article-metrics-panel">
      <div className="metric-card">
        <Eye size={18} />
        <div>
          <strong>{metrics.viewCount}</strong>
          <span>Views</span>
        </div>
      </div>
      <div className="metric-card">
        <ThumbsUp size={18} />
        <div>
          <strong>{metrics.upvoteCount}</strong>
          <span>Upvotes</span>
        </div>
      </div>
      <div className="metric-card">
        <ThumbsDown size={18} />
        <div>
          <strong>{metrics.downvoteCount}</strong>
          <span>Downvotes</span>
        </div>
      </div>
      <div className="metric-card">
        <CheckCircle2 size={18} />
        <div>
          <strong>{metrics.helpfulCount}</strong>
          <span>Helpful</span>
        </div>
      </div>
      <div className="metric-card">
        <XCircle size={18} />
        <div>
          <strong>{metrics.notHelpfulCount}</strong>
          <span>Not Helpful</span>
        </div>
      </div>
      <div className="metric-card">
        <MessageSquare size={18} />
        <div>
          <strong>{metrics.commentCount}</strong>
          <span>Comments</span>
        </div>
      </div>
    </div>
  );
};

export default ArticleMetrics;

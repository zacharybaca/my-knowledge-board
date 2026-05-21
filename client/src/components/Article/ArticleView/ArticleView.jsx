import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFetcher } from '../../../hooks/useFetcher.js';
import { useAuth } from '../../../hooks/useAuth.js';
import { ArrowLeft, Clock, Eye, User, Tag, Edit } from 'lucide-react';
import './article-view.css';

const ArticleView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { fetcher } = useFetcher();
  const { user } = useAuth();

  const [article, setArticle] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

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
      </article>
    </div>
  );
};

export default ArticleView;

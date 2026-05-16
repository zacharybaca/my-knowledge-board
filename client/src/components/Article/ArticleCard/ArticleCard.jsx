import React from 'react';
import { Link } from 'react-router-dom';
import { Clock, Eye, User, Tag } from 'lucide-react';
import './article-card.css';

const ArticleCard = ({ article, linkTo }) => {
  // Fallback to the viewer route if no specific linkTo prop is provided
  const destination = linkTo || `/articles/${article._id}`;

  return (
    <Link to={destination} className="article-card-link">
      <div className="article-card">
        <div className="article-card-header">
          <span
            className={`status-badge status-${article.status.toLowerCase()}`}
          >
            {article.status}
          </span>
          <div className="article-card-views">
            <Eye size={14} />
            <span>{article.viewCount}</span>
          </div>
        </div>

        <h3 className="article-card-title">{article.title}</h3>

        {article.tags && article.tags.length > 0 && (
          <div className="article-card-tags">
            <Tag size={14} className="tag-icon" />
            <div className="tag-list">
              {article.tags.slice(0, 3).map((tag, index) => (
                <span key={index} className="tag-pill-small">
                  {tag}
                </span>
              ))}
              {article.tags.length > 3 && (
                <span className="tag-pill-small extra-tags">
                  +{article.tags.length - 3}
                </span>
              )}
            </div>
          </div>
        )}

        <div className="article-card-footer">
          <div className="meta-info">
            <User size={14} />
            <span>
              {article.authorId?.firstName} {article.authorId?.lastName}
            </span>
          </div>
          <div className="meta-info">
            <Clock size={14} />
            <span>{new Date(article.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default ArticleCard;

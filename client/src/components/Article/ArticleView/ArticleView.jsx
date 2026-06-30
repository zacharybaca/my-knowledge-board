import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFetcher } from '../../../hooks/useFetcher.js';
import { useAuth } from '../../../hooks/useAuth.js';
import { useSocket } from '../../../hooks/useSocket.js';
import {
  ArrowLeft,
  Clock,
  Eye,
  User,
  Tag,
  Edit,
  AlertCircle,
  AlertTriangle,
  Copy,
  Download,
  Trash2,
  MessageSquare,
  History,
} from 'lucide-react';
import ArticleFeedback from '../ArticleFeedback/ArticleFeedback.jsx';
import ProrationWidget from '../../Widgets/ProrationWidget/ProrationWidget.jsx';
import './article-view.css';

const templateVariableRegex = /\[([A-Za-z0-9_]+)\]/g;
const widgetRegex = /\[Widget:([a-zA-Z0-9_]+)\]/g;
const escapeHtml = (value = '') =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const ArticleView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { fetcher } = useFetcher();
  const { user } = useAuth();
  const socket = useSocket();

  const [article, setArticle] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeViewers, setActiveViewers] = useState([]);
  const [templateData, setTemplateData] = useState({});
  const [newComment, setNewComment] = useState('');
  const [revisions, setRevisions] = useState([]);
  const [showRevisions, setShowRevisions] = useState(false);
  const [diffRevision, setDiffRevision] = useState(null);

  const templateVariables = useMemo(() => {
    if (!article?.content) return [];
    const variables = new Set();
    for (const match of article.content.matchAll(templateVariableRegex)) {
      if (!match[1].startsWith('Widget:')) variables.add(match[1]);
    }
    return Array.from(variables);
  }, [article?.content]);

  useEffect(() => {
    const fetchArticle = async () => {
      setIsLoading(true);
      const response = await fetcher(`/api/articles/${id}`);

      if (response.success) {
        setArticle(response.data);
        const defaults = {};
        const foundVariables = new Set();
        for (const match of response.data.content.matchAll(
          templateVariableRegex
        )) {
          if (!match[1].startsWith('Widget:')) foundVariables.add(match[1]);
        }
        foundVariables.forEach((key) => {
          defaults[key] = '';
        });
        setTemplateData(defaults);
      } else {
        setError(response.error || 'Failed to load article.');
      }
      setIsLoading(false);
    };

    fetchArticle();
  }, [id, fetcher]);

  useEffect(() => {
    if (!socket || !article || !user) return;

    const viewerData = {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      avatar: user.avatar,
    };

    socket.emit('join_article', { articleId: article._id, user: viewerData });

    socket.on('presence_update', (viewers) => {
      setActiveViewers(viewers.filter((v) => v._id !== user._id));
    });

    return () => {
      socket.emit('leave_article', {
        articleId: article._id,
        user: viewerData,
      });
      socket.off('presence_update');
    };
  }, [socket, article, user]);

  const handleTemplateInputChange = (e) => {
    const { name, value } = e.target;
    setTemplateData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const parseTemplateContent = (htmlContent) => {
    if (!htmlContent) return '';
    let parsedHtml = htmlContent;

    templateVariables.forEach((variable) => {
      const regex = new RegExp(`\\[${variable}\\]`, 'g');
      const safeValue = escapeHtml(templateData[variable] || '');
      const valueToInject = templateData[variable]
        ? `<span class="template-filled">${safeValue}</span>`
        : `<span class="template-empty">[${variable}]</span>`;

      parsedHtml = parsedHtml.replace(regex, valueToInject);
    });

    return parsedHtml;
  };

  const handleCopyToClipboard = () => {
    const parsedHtml = parseTemplateContent(article.content);
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = parsedHtml;
    const textToCopy = tempDiv.innerText || tempDiv.textContent;

    navigator.clipboard
      .writeText(textToCopy)
      .then(() => {
        window.alert('Template copied to clipboard!');
      })
      .catch((err) => {
        console.error('Failed to copy text: ', err);
      });
  };

  const handleDeleteArticle = async () => {
    const shouldDelete = window.confirm(
      'Are you sure you want to permanently delete this article?'
    );
    if (!shouldDelete) return;

    const response = await fetcher(`/api/articles/${id}`, {
      method: 'DELETE',
    });

    if (response.success) {
      navigate(
        user?.role?.includes('Admin') || user?.role?.includes('Manager')
          ? '/manager-dashboard'
          : '/employee-dashboard'
      );
    } else {
      setError(response.error || 'Failed to delete article.');
    }
  };

  const handleExportPdf = () => {
    window.print();
  };

  const loadRevisions = async () => {
    const response = await fetcher(`/api/articles/${id}/revisions`);
    if (response.success) {
      setRevisions(response.data.revisions || []);
      setShowRevisions(true);
    }
  };

  const handleRollback = async (revisionId) => {
    const shouldRollback = window.confirm(
      'Rollback this article to the selected revision?'
    );
    if (!shouldRollback) return;

    const response = await fetcher(`/api/articles/${id}/rollback`, {
      method: 'PATCH',
      body: JSON.stringify({ revisionId }),
    });

    if (response.success) {
      setArticle(response.data.article);
      setShowRevisions(false);
      setDiffRevision(null);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    const trimmed = newComment.trim();
    if (!trimmed) return;

    const response = await fetcher(`/api/articles/${id}/comments`, {
      method: 'POST',
      body: JSON.stringify({ message: trimmed }),
    });

    if (response.success) {
      setArticle((prev) => ({
        ...prev,
        comments: [...(prev.comments || []), response.data],
      }));
      setNewComment('');
    }
  };

  const renderInteractiveContent = () => {
    if (!article?.content) return null;

    const htmlWithTemplates = parseTemplateContent(article.content);
    const parts = htmlWithTemplates.split(widgetRegex);

    return parts.map((part, index) => {
      if (index % 2 === 1) {
        switch (part) {
          case 'Proration':
            return <ProrationWidget key={index} />;
          default:
            return (
              <div key={index} className="widget-error">
                Error: Widget "{part}" not found.
              </div>
            );
        }
      }

      return <span key={index} dangerouslySetInnerHTML={{ __html: part }} />;
    });
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
    user?.role?.includes('Admin') ||
    user?.role?.includes('Manager') ||
    user?._id === article.authorId?._id;
  const isExpired =
    article.expiresAt && new Date(article.expiresAt) < new Date();
  const isManager =
    user?.role?.includes('Admin') || user?.role?.includes('Manager');

  return (
    <div className="article-view-container">
      <div className="article-view-controls">
        <button onClick={() => navigate(-1)} className="btn-back">
          <ArrowLeft size={16} /> Back to Dashboard
        </button>

        <div className="article-actions-panel">
          {activeViewers.length > 0 && (
            <div className="active-viewers-panel">
              <span className="active-viewers-label">Currently viewing:</span>
              <div className="active-viewers-list">
                {activeViewers.map((viewer, idx) => (
                  <div
                    key={viewer._id}
                    title={`${viewer.firstName} ${viewer.lastName}`}
                    className="active-viewer-avatar"
                    style={{
                      marginLeft: idx === 0 ? '0' : '-10px',
                      zIndex: 10 - idx,
                    }}
                  >
                    {viewer.avatar ? (
                      <img src={viewer.avatar} alt={viewer.firstName} />
                    ) : (
                      viewer.firstName.charAt(0)
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <button onClick={handleExportPdf} className="btn-secondary-action">
            <Download size={16} /> Export PDF
          </button>
          {canEdit && (
            <button
              onClick={() => navigate(`/articles/${article._id}/edit`)}
              className="btn-edit"
            >
              <Edit size={16} /> Edit Article
            </button>
          )}
          {canEdit && (
            <button onClick={handleDeleteArticle} className="btn-danger-action">
              <Trash2 size={16} /> Delete
            </button>
          )}
          {isManager && (
            <button onClick={loadRevisions} className="btn-secondary-action">
              <History size={16} /> Revisions
            </button>
          )}
        </div>
      </div>

      {article.status === 'Rejected' && article.rejectionReason && (
        <div className="rejection-alert-banner">
          <AlertCircle size={24} className="rejection-icon" />
          <div className="rejection-content">
            <h4>Revisions Required</h4>
            <p>
              <strong>Manager Feedback:</strong> {article.rejectionReason}
            </p>
          </div>
        </div>
      )}

      {isExpired && (
        <div className="expiration-alert-banner">
          <AlertTriangle size={24} />
          <div>
            <h4>This article has expired</h4>
            <p>
              The information below has not been reviewed recently and may be
              out of date. Proceed with caution.
            </p>
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

        {templateVariables.length > 0 && (
          <div className="template-controls">
            <h4>Template Variables</h4>
            <p>
              Fill out the fields below to auto-populate the templates in this
              article.
            </p>

            <div className="template-inputs-grid">
              {templateVariables.map((variable) => (
                <div key={variable} className="template-input-group">
                  <label>{variable.replaceAll('_', ' ')}</label>
                  <input
                    type="text"
                    name={variable}
                    value={templateData[variable] || ''}
                    onChange={handleTemplateInputChange}
                  />
                </div>
              ))}
            </div>

            <button
              onClick={handleCopyToClipboard}
              className="copy-template-btn"
            >
              <Copy size={16} /> Copy Filled Template
            </button>
          </div>
        )}

        <div className="article-body">{renderInteractiveContent()}</div>

        <section className="article-comments-section">
          <h3>
            <MessageSquare size={18} /> Discussion
          </h3>
          <form onSubmit={handleAddComment} className="comment-form">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Ask a question or add context..."
              rows={3}
            />
            <button type="submit" className="btn-secondary-action">
              Post Comment
            </button>
          </form>
          <div className="comment-list">
            {(article.comments || []).map((comment) => (
              <div key={comment._id} className="comment-item">
                <strong>
                  {comment.userId?.firstName} {comment.userId?.lastName}
                </strong>
                <p>{comment.message}</p>
                <span>{new Date(comment.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </section>

        <ArticleFeedback articleId={article._id} />
      </article>

      {showRevisions && (
        <div
          className="revision-modal-overlay"
          onClick={() => {
            setShowRevisions(false);
            setDiffRevision(null);
          }}
        >
          <div className="revision-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Revision History</h3>
            <div className="revision-list">
              {revisions.map((revision) => (
                <div key={revision._id} className="revision-item">
                  <div>
                    <strong>
                      {new Date(revision.createdAt).toLocaleString()}
                    </strong>
                    <p>
                      by {revision.updatedBy?.firstName}{' '}
                      {revision.updatedBy?.lastName}
                    </p>
                  </div>
                  <div className="revision-actions">
                    <button
                      type="button"
                      className={`btn-secondary-action ${diffRevision?._id === revision._id ? 'diff-active' : ''}`}
                      onClick={() =>
                        setDiffRevision(
                          diffRevision?._id === revision._id ? null : revision
                        )
                      }
                    >
                      {diffRevision?._id === revision._id ? 'Hide Diff' : 'View Diff'}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary-action"
                      onClick={() => handleRollback(revision._id)}
                    >
                      Rollback
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {diffRevision && (
              <div className="revision-diff-panel">
                <div className="diff-column diff-old">
                  <div className="diff-label">
                    Revision — {new Date(diffRevision.createdAt).toLocaleDateString()}
                  </div>
                  <div
                    className="diff-content"
                    dangerouslySetInnerHTML={{ __html: diffRevision.content }}
                  />
                </div>
                <div className="diff-column diff-new">
                  <div className="diff-label">Current version</div>
                  <div
                    className="diff-content"
                    dangerouslySetInnerHTML={{ __html: article.content }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ArticleView;

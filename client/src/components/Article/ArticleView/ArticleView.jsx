import React, { useState, useEffect } from 'react';
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
  Copy
} from 'lucide-react';
import ArticleFeedback from '../ArticleFeedback/ArticleFeedback.jsx';
import ProrationWidget from '../../Widgets/ProrationWidget/ProrationWidget.jsx';
import './article-view.css';

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

  // Template Automation State
  const [templateData, setTemplateData] = useState({
    Customer_Name: '',
    Account_Number: '',
    Discount_Amount: '5.00'
  });

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

  // --- Real-Time Presence Logic ---
  useEffect(() => {
    if (!socket || !article || !user) return;

    // Send lean user payload to the server
    const viewerData = {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      avatar: user.avatar,
    };

    socket.emit('join_article', { articleId: article._id, user: viewerData });

    socket.on('presence_update', (viewers) => {
      // Filter out the current user so they don't see themselves in the cluster
      setActiveViewers(viewers.filter((v) => v._id !== user._id));
    });

    return () => {
      socket.emit('leave_article', { articleId: article._id, user: viewerData });
      socket.off('presence_update');
    };
  }, [socket, article, user]);


  // --- Feature 3: Template Automation Parsers ---
  const handleTemplateInputChange = (e) => {
    const { name, value } = e.target;
    setTemplateData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const parseTemplateContent = (htmlContent) => {
    if (!htmlContent) return '';
    let parsedHtml = htmlContent;
    const variables = ['Customer_Name', 'Account_Number', 'Discount_Amount'];

    variables.forEach(variable => {
      const regex = new RegExp(`\\[${variable}\\]`, 'g');
      const valueToInject = templateData[variable] ?
        `<span class="template-filled" style="background:#d1fae5; color:#065f46; padding:2px 6px; border-radius:4px; font-weight:bold;">${templateData[variable]}</span>` :
        `<span class="template-empty" style="background:#fee2e2; color:#991b1b; padding:2px 6px; border-radius:4px;">[${variable}]</span>`;

      parsedHtml = parsedHtml.replace(regex, valueToInject);
    });

    return parsedHtml;
  };

  const handleCopyToClipboard = () => {
    const parsedHtml = parseTemplateContent(article.content);
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = parsedHtml;
    const textToCopy = tempDiv.innerText || tempDiv.textContent;

    navigator.clipboard.writeText(textToCopy).then(() => {
      alert("Template copied to clipboard!");
    }).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  };

  // --- Feature 4: Dynamic Widget Injection Engine ---
  const renderInteractiveContent = () => {
    if (!article.content) return null;

    const htmlWithTemplates = parseTemplateContent(article.content);
    const parts = htmlWithTemplates.split(/\[Widget:([a-zA-Z0-9_]+)\]/g);

    return parts.map((part, index) => {
      if (index % 2 === 1) {
        switch (part) {
          case 'Proration':
            return <ProrationWidget key={index} />;
          default:
            return <div key={index} style={{ color: 'red', padding: '10px', border: '1px solid red' }}>Error: Widget "{part}" not found.</div>;
        }
      } else {
        return (
          <span
            key={index}
            dangerouslySetInnerHTML={{ __html: part }}
          />
        );
      }
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

  const canEdit = user?.role?.includes('Admin') || user?.role?.includes('Manager') || user?._id === article.authorId?._id;
  const isExpired = article.expiresAt && new Date(article.expiresAt) < new Date();

  return (
    <div className="article-view-container">
      <div className="article-view-controls">
        <button onClick={() => navigate(-1)} className="btn-back">
          <ArrowLeft size={16} /> Back to Dashboard
        </button>

        {/* --- Active Viewers Avatar Cluster --- */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {activeViewers.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Currently viewing:</span>
              <div style={{ display: 'flex', marginLeft: '4px' }}>
                {activeViewers.map((viewer, idx) => (
                  <div
                    key={viewer._id}
                    title={`${viewer.firstName} ${viewer.lastName}`}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: '#10b981',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.8rem',
                      fontWeight: 'bold',
                      marginLeft: idx === 0 ? '0' : '-10px',
                      border: '2px solid white',
                      zIndex: 10 - idx,
                      overflow: 'hidden',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}
                  >
                    {viewer.avatar ? (
                      <img src={viewer.avatar} alt={viewer.firstName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      viewer.firstName.charAt(0)
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {canEdit && (
            <button onClick={() => navigate(`/articles/${article._id}/edit`)} className="btn-edit">
              <Edit size={16} /> Edit Article
            </button>
          )}
        </div>
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

      {isExpired && (
        <div className="expiration-alert-banner" style={{ background: '#fef2f2', border: '1px solid #f87171', color: '#991b1b', padding: '16px', borderRadius: '8px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <AlertTriangle size={24} />
          <div>
            <h4 style={{ margin: 0 }}>This article has expired</h4>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.9rem' }}>
              The information below has not been reviewed recently and may be out of date. Proceed with caution.
            </p>
          </div>
        </div>
      )}

      <article className="article-wrapper">
        <header className="article-header">
          <div className="article-meta-top">
            <span className={`status-badge status-${article.status.toLowerCase()}`}>
              {article.status}
            </span>
          </div>

          <h1 className="article-title">{article.title}</h1>

          <div className="article-meta-bottom">
            <div className="meta-item">
              <User size={16} />
              <span>{article.authorId?.firstName} {article.authorId?.lastName}</span>
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
                <span key={index} className="tag-pill">{tag}</span>
              ))}
            </div>
          )}
        </header>

        {article.content && article.content.includes('[') && (
          <div className="template-controls" style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
            <h4 style={{ marginTop: 0 }}>Template Variables</h4>
            <p style={{ fontSize: '0.9rem', color: '#475569', marginBottom: '16px' }}>Fill out the fields below to auto-populate the email templates in this article.</p>

            <div className="template-inputs-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
              {article.content.includes('[Customer_Name]') && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Customer Name</label>
                  <input type="text" name="Customer_Name" value={templateData.Customer_Name} onChange={handleTemplateInputChange} style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px' }}/>
                </div>
              )}
              {article.content.includes('[Account_Number]') && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Account Number</label>
                  <input type="text" name="Account_Number" value={templateData.Account_Number} onChange={handleTemplateInputChange} style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px' }}/>
                </div>
              )}
               {article.content.includes('[Discount_Amount]') && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Discount Amount ($)</label>
                  <input type="text" name="Discount_Amount" value={templateData.Discount_Amount} onChange={handleTemplateInputChange} style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px' }}/>
                </div>
              )}
            </div>

            <button onClick={handleCopyToClipboard} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#0f172a', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}>
              <Copy size={16} /> Copy Filled Template
            </button>
          </div>
        )}

        <div className="article-body">
          {renderInteractiveContent()}
        </div>

        <ArticleFeedback articleId={article._id} />
      </article>
    </div>
  );
};

export default ArticleView;

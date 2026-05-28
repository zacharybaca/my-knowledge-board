import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFetcher } from '../../../hooks/useFetcher.js';
import { useAuth } from '../../../hooks/useAuth.js';
import {
  ArrowLeft,
  Clock,
  Eye,
  User,
  Tag,
  Edit,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react';
import ArticleFeedback from '../ArticleFeedback/ArticleFeedback.jsx';
import './article-view.css';

const ArticleView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { fetcher } = useFetcher();
  const { user } = useAuth();

  const [article, setArticle] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
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

  const handleTemplateInputChange = (e) => {
    const { name, value } = e.target;
    setTemplateData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCopyToClipboard = () => {
    const parsedHtml = parseTemplateContent(article.content);

    // Create a temporary element to strip HTML tags and get pure text
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = parsedHtml;
    const textToCopy = tempDiv.innerText || tempDiv.textContent;

    navigator.clipboard.writeText(textToCopy).then(() => {
      // You could trigger a small toast notification here
      alert("Template copied to clipboard!");
    }).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  };

  const canEdit =
    user?.role === 'Admin' ||
    user?.role === 'Manager' ||
    user?._id === article.authorId?._id;

  const parseTemplateContent = (htmlContent) => {
    if (!htmlContent) return '';
    let parsedHtml = htmlContent;

    // Define the variables we want to watch for
    const variables = ['Customer_Name', 'Account_Number', 'Discount_Amount'];

    variables.forEach(variable => {
      const regex = new RegExp(`\\[${variable}\\]`, 'g');
      // Replace with the user input, or keep the bracketed term if empty
      const valueToInject = templateData[variable] ?
        `<span class="template-filled">${templateData[variable]}</span>` :
        `<span class="template-empty">[${variable}]</span>`;

      parsedHtml = parsedHtml.replace(regex, valueToInject);
    });

    return parsedHtml;
  };

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
            <p>
              <strong>Manager Feedback:</strong> {article.rejectionReason}
            </p>
          </div>
        </div>
      )}
      {article.expiresAt && new Date(article.expiresAt) < new Date() && (
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

        {article.content && article.content.includes('[') && (
          <div>
            <div className="template-controls">
              <h4>Template Variables</h4>
              <p className="template-instruction">Fill out the fields below to auto-populate the email templates in this article.</p>
              <div className="template-inputs-grid">
                {article.content.includes('[Customer_Name]') && (
                  <div className="input-group">
                    <label>Customer Name</label>
                    <input
                      type="text"
                      name="Customer_Name"
                      value={templateData.Customer_Name}
                      onChange={handleTemplateInputChange}
                      placeholder="e.g., Jane Doe"
                    />
                  </div>
                )}
                {article.content.includes('[Account_Number]') && (
                  <div className="input-group">
                    <label>Account Number</label>
                    <input
                      type="text"
                      name="Account_Number"
                      value={templateData.Account_Number}
                      onChange={handleTemplateInputChange}
                      placeholder="e.g., 12345678"
                    />
                  </div>
                )}
                 {article.content.includes('[Discount_Amount]') && (
                  <div className="input-group">
                    <label>Discount Amount ($)</label>
                    <input
                      type="text"
                      name="Discount_Amount"
                      value={templateData.Discount_Amount}
                      onChange={handleTemplateInputChange}
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="template-controls">
               {/* ... existing template header and inputs ... */}

               <div className="template-actions">
                 <button onClick={handleCopyToClipboard} className="btn-copy">
                    Copy Filled Template
                 </button>
               </div>
            </div>
          </div>
        )}

        <div
          className="article-body"
          dangerouslySetInnerHTML={{ __html: parseTemplateContent(article.content) }}
        />

        <ArticleFeedback articleId={article._id} />
      </article>
    </div>
  );
};

export default ArticleView;

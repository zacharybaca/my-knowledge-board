import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Editor } from '@tinymce/tinymce-react';
import { useFetcher } from '../../../hooks/useFetcher.js';
import { useAuth } from '../../../hooks/useAuth.js';
import Toast from '../../Layout/Toast/Toast.jsx';
import { Wand2, Type, ListOrdered } from 'lucide-react';
import './article-editor.css';

const ArticleEditor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { fetcher } = useFetcher();
  const { isUserAdmin } = useAuth();
  const editorRef = useRef(null);

  const isEditing = Boolean(id && id !== 'new');

  // Available departments mapping
  const availableDepartments = [
    'Customer Service',
    'Tech Support',
    'Human Resources',
    'Sales',
    'Marketing',
    'Engineering',
    'Product',
    'Finance',
    'Legal',
    'Operations',
    'Other',
  ];

  const [formData, setFormData] = useState({
    title: '',
    departments: [],
    content: '',
    summary: '',
    tags: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(isEditing);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [toastConfig, setToastConfig] = useState(null);

  useEffect(() => {
    if (isEditing) {
      const fetchArticle = async () => {
        const response = await fetcher(`/api/articles/${id}`);
        if (response.success) {
          setFormData({
            title: response.data.title || '',
            departments: response.data.department || [],
            content: response.data.content || '',
            summary: response.data.summary || '',
            tags: response.data.tags ? response.data.tags.join(', ') : '',
          });
        } else {
          setToastConfig({ type: 'error', message: 'Failed to load article.' });
        }
        setIsLoading(false);
      };
      fetchArticle();
    }
  }, [id, isEditing]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleEditorChange = (content) => {
    setFormData((prev) => ({ ...prev, content }));
  };

  const handleDepartmentChange = (e) => {
    const options = e.target.options;
    const selectedDepartments = [];
    for (let i = 0; i < options.length; i++) {
      if (options[i].selected) {
        selectedDepartments.push(options[i].value);
      }
    }
    setFormData((prev) => ({ ...prev, departments: selectedDepartments }));
  };

  // --- AI DRAFT ENHANCEMENT HANDLER ---
  const handleAIEnhance = async (promptType) => {
    const plainText = formData.content.replace(/<[^>]*>?/gm, '').trim();
    if (!plainText) {
      setToastConfig({
        type: 'error',
        message:
          'Please write some content in the editor first before using AI enhancement.',
      });
      return;
    }

    setIsEnhancing(true);
    setToastConfig({
      type: 'success',
      message: 'AI is enhancing your text. Please wait...',
    });

    const response = await fetcher('/api/ai/enhance-text', {
      method: 'POST',
      body: JSON.stringify({ text: formData.content, promptType }),
    });

    if (response.success) {
      let formattedContent = response.enhancedText;

      if (!formattedContent.includes('<p>')) {
        formattedContent = formattedContent
          .split('\n')
          .map((line) => (line.trim() ? `<p>${line}</p>` : ''))
          .join('');
      }

      setFormData((prev) => ({ ...prev, content: formattedContent }));
      setToastConfig({
        type: 'success',
        message: 'Text enhanced successfully!',
      });
    } else {
      setToastConfig({
        type: 'error',
        message: response.error || 'Failed to enhance text.',
      });
    }

    setIsEnhancing(false);
  };

  const handleAIAnalysis = async () => {
    const plainText = formData.content.replace(/<[^>]*>?/gm, '').trim();
    if (!plainText || plainText.length < 50) {
      setToastConfig({
        type: 'error',
        message: 'Insufficient content for AI analysis. Please write more.',
      });
      return;
    }

    setIsAnalyzing(true);
    const response = await fetcher('/api/ai/analyze', {
      method: 'POST',
      body: JSON.stringify({ content: formData.content }),
    });

    if (response.success) {
      setFormData((prev) => ({
        ...prev,
        summary: response.data.summary,
        tags: response.data.tags.join(', '),
      }));
      setToastConfig({
        type: 'success',
        message: 'AI generated summary and tags successfully.',
      });
    } else {
      setToastConfig({
        type: 'error',
        message: response.error || 'AI Analysis failed.',
      });
    }
    setIsAnalyzing(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setToastConfig(null);

    if (formData.departments.length === 0) {
      setToastConfig({
        type: 'error',
        message: 'Please select at least one department.',
      });
      setIsSubmitting(false);
      return;
    }

    // --- NEW DUPLICATE DETECTION CHECK ---
    // Only check for duplicates if it's a new article (to save API calls on edits)
    if (!isEditing) {
      try {
        const dupRes = await fetcher('/api/articles/check-duplicate', {
          method: 'POST',
          body: JSON.stringify({
            title: formData.title,
            content: formData.content,
          }),
        });

        if (dupRes.success && dupRes.isLikelyDuplicate) {
          const confirmMsg =
            `Wait! We found similar articles in your organization's database:\n\n` +
            dupRes.similarArticles.map((a) => `- ${a.title}`).join('\n') +
            `\n\nAre you sure you want to submit this new article anyway?`;

          if (!window.confirm(confirmMsg)) {
            setIsSubmitting(false);
            return; // Abort submission
          }
        }
      } catch (err) {
        console.warn('Duplicate check failed, proceeding anyway.', err);
      }
    }
    // -------------------------------------

    const payload = {
      title: formData.title,
      departments: formData.departments,
      content: formData.content,
      summary: formData.summary,
      tags: formData.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      status: isUserAdmin ? 'Approved' : 'Pending',
    };

    const endpoint = isEditing ? `/api/articles/${id}` : '/api/articles';
    const method = isEditing ? 'PUT' : 'POST';

    const response = await fetcher(endpoint, {
      method,
      body: JSON.stringify(payload),
    });

    if (response.success) {
      navigate(isUserAdmin ? '/manager-dashboard' : '/employee-dashboard');
    } else {
      setToastConfig({
        type: 'error',
        message: response.error || 'Failed to save article.',
      });
      setIsSubmitting(false);
    }
  };

  if (isLoading)
    return (
      <div className="editor-loading">
        <div className="spinner"></div>
      </div>
    );

  return (
    <div className="editor-page-container">
      {toastConfig && (
        <Toast
          message={toastConfig.message}
          type={toastConfig.type}
          onClose={() => setToastConfig(null)}
        />
      )}

      <div className="editor-header">
        <h1>{isEditing ? 'Edit Article' : 'Draft New Article'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="editor-form">
        <div className="form-group">
          <label htmlFor="title">Article Title</label>
          <input
            type="text"
            id="title"
            name="title"
            value={formData.title}
            onChange={handleChange}
            required
            placeholder="e.g., Q3 Password Rotation Policy"
          />
        </div>

        <div className="form-group">
          <label htmlFor="departments">
            Target Departments (Hold Ctrl/Cmd to select multiple)
          </label>
          <select
            id="departments"
            name="departments"
            multiple
            size="5"
            value={formData.departments}
            onChange={handleDepartmentChange}
            required
            style={{ height: 'auto', minHeight: '120px' }}
          >
            {availableDepartments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group editor-container">
          <label
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              marginBottom: '8px',
            }}
          >
            <span>Content</span>

            {/* AI WRITING ASSISTANT TOOLBAR */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => handleAIEnhance('professional')}
                disabled={isEnhancing}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#f1f5f9',
                  color: '#334155',
                  border: '1px solid #cbd5e1',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  cursor: isEnhancing ? 'wait' : 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: '500',
                }}
              >
                <Type size={14} color="#10b981" />
                {isEnhancing ? 'Rewriting...' : 'Make Professional'}
              </button>
              <button
                type="button"
                onClick={() => handleAIEnhance('simplify')}
                disabled={isEnhancing}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#f1f5f9',
                  color: '#334155',
                  border: '1px solid #cbd5e1',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  cursor: isEnhancing ? 'wait' : 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: '500',
                }}
              >
                <Wand2 size={14} color="#3b82f6" />
                Simplify
              </button>
              <button
                type="button"
                onClick={() => handleAIEnhance('step-by-step')}
                disabled={isEnhancing}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#f1f5f9',
                  color: '#334155',
                  border: '1px solid #cbd5e1',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  cursor: isEnhancing ? 'wait' : 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: '500',
                }}
              >
                <ListOrdered size={14} color="#f59e0b" />
                Format as Steps
              </button>
            </div>
          </label>
          <Editor
            apiKey={import.meta.env.VITE_TINYMCE_API_KEY}
            onInit={(evt, editor) => (editorRef.current = editor)}
            value={formData.content}
            onEditorChange={handleEditorChange}
            init={{
              height: 500,
              menubar: true,
              plugins: [
                'advlist',
                'autolink',
                'lists',
                'link',
                'image',
                'charmap',
                'preview',
                'anchor',
                'searchreplace',
                'visualblocks',
                'code',
                'fullscreen',
                'insertdatetime',
                'media',
                'table',
                'code',
                'help',
                'wordcount',
              ],
              toolbar:
                'undo redo | blocks | ' +
                'bold italic forecolor | alignleft aligncenter ' +
                'alignright alignjustify | bullist numlist outdent indent | ' +
                'removeformat | help',
              content_style:
                'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 16px }',
              branding: false,
              promotion: false,
            }}
          />
        </div>

        <div
          className="ai-assist-section"
          style={{
            margin: '20px 0',
            padding: '15px',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '10px',
            }}
          >
            <h3 style={{ fontSize: '1rem', margin: 0, color: '#0f172a' }}>
              AI Assistant
            </h3>
            <button
              type="button"
              onClick={handleAIAnalysis}
              disabled={isAnalyzing}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: '#10b981',
                color: 'white',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '4px',
                cursor: isAnalyzing ? 'not-allowed' : 'pointer',
                opacity: isAnalyzing ? 0.7 : 1,
              }}
            >
              <Wand2 size={16} />{' '}
              {isAnalyzing ? 'Analyzing...' : 'Auto-Generate Metadata'}
            </button>
          </div>

          <div className="form-group" style={{ marginBottom: '10px' }}>
            <label htmlFor="summary">Summary</label>
            <textarea
              id="summary"
              name="summary"
              value={formData.summary}
              onChange={handleChange}
              rows="3"
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #cbd5e1',
              }}
              placeholder="AI generated summary will appear here..."
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="tags">Tags (Comma-separated)</label>
            <input
              type="text"
              id="tags"
              name="tags"
              value={formData.tags}
              onChange={handleChange}
              placeholder="e.g., security, compliance, IT"
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #cbd5e1',
              }}
            />
          </div>
        </div>

        <div className="editor-actions">
          <button
            type="button"
            className="btn-cancel"
            onClick={() => navigate(-1)}
            disabled={isSubmitting || isEnhancing}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-submit"
            disabled={isSubmitting || isEnhancing || !formData.content.trim()}
          >
            {isSubmitting
              ? 'Saving...'
              : isUserAdmin
                ? 'Publish Article'
                : 'Submit for Approval'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ArticleEditor;

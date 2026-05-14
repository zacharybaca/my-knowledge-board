import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Editor } from '@tinymce/tinymce-react';
import { useFetcher } from '../../../hooks/useFetcher.js';
import Toast from '../../Layout/Toast/Toast.jsx';
import './article-editor.css';

const ArticleEditor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { fetcher } = useFetcher();
  const editorRef = useRef(null);

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    tags: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(!!id);
  const [toastConfig, setToastConfig] = useState(null);

  useEffect(() => {
    if (id) {
      const fetchArticle = async () => {
        const response = await fetcher(`/api/articles/${id}`);
        if (response.success) {
          setFormData({
            title: response.data.title,
            content: response.data.content,
            tags: response.data.tags.join(', ')
          });
        } else {
          setToastConfig({ type: 'error', message: 'Failed to load article.' });
        }
        setIsLoading(false);
      };
      fetchArticle();
    }
  }, [id, fetcher]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleEditorChange = (content) => {
    setFormData(prev => ({ ...prev, content }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setToastConfig(null);

    const payload = {
      title: formData.title,
      content: formData.content,
      tags: formData.tags.split(',').map(tag => tag.trim()).filter(Boolean)
    };

    const endpoint = id ? `/api/articles/${id}` : '/api/articles';
    const method = id ? 'PUT' : 'POST';

    const response = await fetcher(endpoint, {
      method,
      body: JSON.stringify(payload)
    });

    if (response.success) {
      navigate('/dashboard');
    } else {
      setToastConfig({ type: 'error', message: response.error || 'Failed to save article.' });
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className="editor-loading"><div className="spinner"></div></div>;

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
        <h1>{id ? 'Edit Article' : 'Draft New Article'}</h1>
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
          <label htmlFor="tags">Tags (Comma-separated)</label>
          <input
            type="text"
            id="tags"
            name="tags"
            value={formData.tags}
            onChange={handleChange}
            placeholder="e.g., security, compliance, IT"
          />
        </div>

        <div className="form-group editor-container">
          <label>Content</label>
          <Editor
            apiKey={import.meta.env.VITE_TINYMCE_API_KEY}
            onInit={(evt, editor) => editorRef.current = editor}
            value={formData.content}
            onEditorChange={handleEditorChange}
            init={{
              height: 500,
              menubar: true,
              plugins: [
                'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
                'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
                'insertdatetime', 'media', 'table', 'code', 'help', 'wordcount'
              ],
              toolbar: 'undo redo | blocks | ' +
                'bold italic forecolor | alignleft aligncenter ' +
                'alignright alignjustify | bullist numlist outdent indent | ' +
                'removeformat | help',
              content_style: 'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 16px }',
              branding: false,
              promotion: false
            }}
          />
        </div>

        <div className="editor-actions">
          <button
            type="button"
            className="btn-cancel"
            onClick={() => navigate(-1)}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-submit"
            disabled={isSubmitting || !formData.content.trim()}
          >
            {isSubmitting ? 'Saving...' : 'Submit for Approval'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ArticleEditor;

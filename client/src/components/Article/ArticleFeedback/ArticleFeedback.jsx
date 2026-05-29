import React, { useState } from 'react';
import { useFetcher } from '../../../hooks/useFetcher';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import './article-feedback.css';

const ArticleFeedback = ({ articleId }) => {
  const { fetcher } = useFetcher();
  const [status, setStatus] = useState('idle'); // 'idle' | 'comment' | 'submitted'
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRating = async (isHelpful) => {
    if (isHelpful) {
      setIsSubmitting(true);
      await submitData(true, '');
      setStatus('submitted');
      setIsSubmitting(false);
    } else {
      setStatus('comment');
    }
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;

    setIsSubmitting(true);
    await submitData(false, comment);
    setStatus('submitted');
    setIsSubmitting(false);
  };

  const submitData = async (helpful, feedbackComment) => {
    await fetcher(`/api/articles/${articleId}/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ isHelpful: helpful, comment: feedbackComment }),
    });
  };

  if (status === 'submitted') {
    return (
      <div className="feedback-terminal">Thank you for your feedback.</div>
    );
  }

  return (
    <div className="article-feedback-container">
      {status === 'idle' && (
        <div className="feedback-prompt">
          <span className="feedback-label">Was this article helpful?</span>
          <div className="feedback-triggers">
            <button
              className="btn-thumb up"
              onClick={() => handleRating(true)}
              disabled={isSubmitting}
            >
              <ThumbsUp size={18} /> Yes
            </button>
            <button
              className="btn-thumb down"
              onClick={() => handleRating(false)}
              disabled={isSubmitting}
            >
              <ThumbsDown size={18} /> No
            </button>
          </div>
        </div>
      )}

      {status === 'comment' && (
        <form onSubmit={handleCommentSubmit} className="feedback-form">
          <label>How can this article be improved?</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows="3"
            required
            disabled={isSubmitting}
          />
          <div className="feedback-actions">
            <button
              type="button"
              className="btn-cancel"
              onClick={() => setStatus('idle')}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-submit"
              disabled={isSubmitting}
            >
              Submit Feedback
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default ArticleFeedback;

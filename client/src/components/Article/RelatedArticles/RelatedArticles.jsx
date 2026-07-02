import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { useFetcher } from '../../../hooks/useFetcher.js';
import './related-articles.css';

const RelatedArticles = ({ articleId }) => {
  const { fetcher } = useFetcher();
  const [relatedArticles, setRelatedArticles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!articleId) return;

    const fetchRelated = async () => {
      setIsLoading(true);
      const response = await fetcher(`/api/articles/${articleId}/related`);
      if (response.success && Array.isArray(response.data)) {
        setRelatedArticles(response.data);
      }
      setIsLoading(false);
    };

    fetchRelated();
  }, [articleId, fetcher]);

  if (isLoading || relatedArticles.length === 0) return null;

  return (
    <section className="related-articles-section">
      <h3>
        <Sparkles size={18} /> Related Articles
      </h3>
      <div className="related-articles-list">
        {relatedArticles.map((related) => (
          <Link
            key={related._id}
            to={`/articles/${related._id}`}
            className="related-article-card"
          >
            <h4>{related.title}</h4>
            {related.summary && <p>{related.summary}</p>}
          </Link>
        ))}
      </div>
    </section>
  );
};

export default RelatedArticles;

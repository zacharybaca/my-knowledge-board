import React, { useState, useEffect } from 'react';
import { useFetcher } from '../../../hooks/useFetcher.js';
import { useAuth } from '../../../hooks/useAuth.js';
import SearchBar from '../SearchBar/SearchBar.jsx';
import ArticleCard from '../../Article/ArticleCard/ArticleCard.jsx';
import TagFilter from '../TagFilter/TagFilter.jsx';
import { SearchX } from 'lucide-react';
import './search-results.css';

const SearchResults = () => {
  const [articles, setArticles] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterTag, setFilterTag] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const { fetcher } = useFetcher();
  const { user } = useAuth();

  const companyName = user?.companyId?.name || 'your organization';
  const companyLogoUrl = user?.companyId?.imageUrl;

  useEffect(() => {
    const fetchInitialData = async () => {
      const response = await fetcher('/api/articles');
      if (response.success) {
        const tags = new Set();
        response.data.forEach((article) => {
          if (article.tags) {
            article.tags.forEach((tag) => tags.add(tag));
          }
        });
        setAvailableTags(Array.from(tags).sort());
      }
    };
    fetchInitialData();
  }, [fetcher]);

  useEffect(() => {
    const fetchResults = async () => {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (searchTerm) params.append('keyword', searchTerm);
      if (filterTag) params.append('tag', filterTag);

      const queryString = params.toString() ? `?${params.toString()}` : '';

      const response = await fetcher(`/api/articles${queryString}`);

      if (response.success) {
        setArticles(response.data);
      } else {
        setError(response.error || 'Failed to fetch search results.');
      }

      setIsLoading(false);
    };

    fetchResults();
  }, [searchTerm, filterTag, fetcher]);

  return (
    <div className="search-page-container">
      {/* Company Jumbotron Section */}
      {companyLogoUrl && (
        <div className="company-jumbotron">
          <img
            src={companyLogoUrl}
            alt={`${companyName} Logo`}
            className="jumbotron-logo"
          />
        </div>
      )}

      <div className="search-header-section">
        <h1>{user ? `Welcome, ${user.firstName}!` : 'Knowledge Base'}</h1>
        <h2>{user ? `You are part of ${companyName}'s workspace.` : 'Explore the knowledge base.'}</h2>
        <p>
          {user ? `Search across ${companyName}'s policies, process guides, and technical documentation.` : 'Search across organizational policies, process guides, and technical documentation.'}
        </p>
      </div>

      <SearchBar
        setSearchTerm={setSearchTerm}
        setFilterTag={setFilterTag}
        availableTags={availableTags}
      />

      <TagFilter
        availableTags={availableTags}
        selectedTag={filterTag}
        onSelectTag={setFilterTag}
      />

      {error && (
        <div className="search-status-message error">
          <p>{error}</p>
        </div>
      )}

      {isLoading ? (
        <div className="search-loading">
          <div className="spinner"></div>
        </div>
      ) : articles.length > 0 ? (
        <>
          <div className="search-results-meta">
            Found {articles.length} result{articles.length === 1 ? '' : 's'}
            {(searchTerm || filterTag) && ' for your query'}
          </div>

          <div className="search-results-grid">
            {articles.map((article) => (
              <ArticleCard key={article._id} article={article} />
            ))}
          </div>
        </>
      ) : (
        <div className="search-empty-state">
          <SearchX size={48} className="empty-icon" />
          <h3>No articles found</h3>
          <p>
            We couldn't find any documentation matching "{searchTerm}". Try
            adjusting your keywords or clearing the tag filter.
          </p>
        </div>
      )}
    </div>
  );
};

export default SearchResults;

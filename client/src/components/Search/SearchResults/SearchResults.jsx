import React, { useState, useEffect } from 'react';
import { useFetcher } from '../../../hooks/useFetcher.js';
import SearchBar from '../SearchBar/SearchBar.jsx';
import ArticleCard from '../../Article/ArticleCard/ArticleCard.jsx';
import TagFilter from '../TagFilter/TagFilter.jsx';
import { SearchX, BookOpen } from 'lucide-react';
import './search-results.css';

const SearchResults = () => {
  const [articles, setArticles] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);

  // Search state passed down to the SearchBar
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTag, setFilterTag] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const { fetcher } = useFetcher();

  // 1. Initial Load: Fetch all articles to extract all unique tags for the dropdown
  useEffect(() => {
    const fetchInitialData = async () => {
      const response = await fetcher('/api/articles');
      if (response.success) {
        // Extract unique tags from all approved articles
        const tags = new Set();
        response.data.forEach(article => {
          if (article.tags) {
            article.tags.forEach(tag => tags.add(tag));
          }
        });
        setAvailableTags(Array.from(tags).sort());
      }
    };
    fetchInitialData();
  }, [fetcher]);

  // 2. Search Execution: Refetch articles when search term or tag changes
  useEffect(() => {
    const fetchResults = async () => {
      setIsLoading(true);
      setError(null);

      // Build the query string based on active filters
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
      <div className="search-header-section">
        <h1>Knowledge Base</h1>
        <p>Search across organizational policies, process guides, and technical documentation.</p>
      </div>

      <SearchBar
        setSearchTerm={setSearchTerm}
        setFilterTag={setFilterTag}
        availableTags={availableTags}
      />

      <TagFilter availableTags={availableTags} selectedTag={filterTag} onSelectTag={setFilterTag}/>

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
          <p>We couldn't find any documentation matching "{searchTerm}". Try adjusting your keywords or clearing the tag filter.</p>
        </div>
      )}
    </div>
  );
};

export default SearchResults;

import React, { useState, useEffect } from 'react';
import { useFetcher } from '../../../hooks/useFetcher.js';
import { useAuth } from '../../../hooks/useAuth.js';
import SearchBar from '../SearchBar/SearchBar.jsx';
import ArticleCard from '../../Article/ArticleCard/ArticleCard.jsx';
import TagFilter from '../TagFilter/TagFilter.jsx';
import { SearchX, SlidersHorizontal, X } from 'lucide-react';
import './search-results.css';

const DEFAULT_DEPARTMENTS = [
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

const SearchResults = () => {
  const [articles, setArticles] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [articleTitles, setArticleTitles] = useState([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
    total: 0,
  });

  const [companyDetails, setCompanyDetails] = useState({
    name: 'your organization',
    imageUrl: null,
  });
  const [departmentOptions, setDepartmentOptions] =
    useState(DEFAULT_DEPARTMENTS);

  const { fetcher } = useFetcher();
  const { user } = useAuth();

  const hasActiveFilters =
    filterDepartment || filterDateFrom || filterDateTo || filterTag;

  const clearAdvancedFilters = () => {
    setFilterDepartment('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterTag('');
  };

  useEffect(() => {
    const fetchCompanyInfo = async () => {
      if (!user?.companyId || user.companyId.length === 0) return;

      // Extract the active company (first one in the array for now)
      const activeCompany = Array.isArray(user.companyId)
        ? user.companyId[0]
        : user.companyId;

      const idToFetch =
        typeof activeCompany === 'string' ? activeCompany : activeCompany._id;

      // Scenario A: Object is populated
      if (typeof activeCompany === 'object' && activeCompany.name) {
        setCompanyDetails({
          name: activeCompany.name,
          imageUrl: activeCompany.imageUrl,
        });
      } else {
        // Scenario B: We just have the ID string
        try {
          const response = await fetcher(`/api/companies/${idToFetch}`);
          if (response.success && response.data) {
            setCompanyDetails({
              name: response.data.name,
              imageUrl: response.data.imageUrl,
            });
          }
        } catch (err) {
          console.error('Could not fetch company details', err);
        }
      }

      if (idToFetch) {
        const deptResponse = await fetcher(`/api/companies/${idToFetch}`);
        if (
          deptResponse.success &&
          Array.isArray(deptResponse.data?.departments) &&
          deptResponse.data.departments.length > 0
        ) {
          setDepartmentOptions(deptResponse.data.departments);
        }
      }
    };

    fetchCompanyInfo();
  }, [user, fetcher]);

  useEffect(() => {
    const fetchInitialData = async () => {
      const response = await fetcher('/api/articles');
      if (response.success) {
        const allArticles = Array.isArray(response.data)
          ? response.data
          : response.data.articles || [];
        const tags = new Set();
        const titles = [];
        allArticles.forEach((article) => {
          if (article.tags) article.tags.forEach((tag) => tags.add(tag));
          if (article.title) titles.push(article.title);
        });
        setAvailableTags(Array.from(tags).sort());
        setArticleTitles(titles);
      }
    };
    fetchInitialData();
  }, [fetcher]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterTag, filterDepartment, filterDateFrom, filterDateTo]);

  useEffect(() => {
    const fetchResults = async () => {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (searchTerm) params.append('keyword', searchTerm);
      if (filterTag) params.append('tag', filterTag);
      if (filterDepartment) params.append('department', filterDepartment);
      if (filterDateFrom) params.append('dateFrom', filterDateFrom);
      if (filterDateTo) params.append('dateTo', filterDateTo);
      params.append('paginate', 'true');
      params.append('page', String(currentPage));
      params.append('limit', '12');

      const queryString = params.toString() ? `?${params.toString()}` : '';

      const response = await fetcher(`/api/articles${queryString}`);

      if (response.success) {
        setArticles(response.data.articles || []);
        setPagination(
          response.data.pagination || {
            page: 1,
            totalPages: 1,
            hasNextPage: false,
            hasPrevPage: false,
            total: response.data.articles?.length || 0,
          }
        );
      } else {
        setError(response.error || 'Failed to fetch search results.');
      }

      setIsLoading(false);
    };

    fetchResults();
  }, [
    searchTerm,
    filterTag,
    filterDepartment,
    filterDateFrom,
    filterDateTo,
    currentPage,
    fetcher,
  ]);

  return (
    <div className="search-page-container">
      {companyDetails.imageUrl && (
        <div className="company-jumbotron">
          <img
            src={companyDetails.imageUrl}
            alt={`${companyDetails.name} Logo`}
            className="jumbotron-logo"
          />
        </div>
      )}

      <div className="search-header-section">
        <h1>{user ? `Welcome, ${user.firstName}!` : 'Knowledge Base'}</h1>
        <h2>
          {user
            ? `You are part of ${companyDetails.name}'s workspace.`
            : 'Explore the knowledge base.'}
        </h2>
        <p>
          {user
            ? `Search across ${companyDetails.name}'s policies, process guides, and technical documentation.`
            : 'Search across organizational policies, process guides, and technical documentation.'}
        </p>
      </div>

      <SearchBar
        setSearchTerm={setSearchTerm}
        setFilterTag={setFilterTag}
        availableTags={availableTags}
        articleTitles={articleTitles}
      />

      {/* Advanced filter toggle */}
      <div className="advanced-filter-row">
        <button
          type="button"
          className={`advanced-filter-toggle ${showAdvanced ? 'active' : ''}`}
          onClick={() => setShowAdvanced((v) => !v)}
        >
          <SlidersHorizontal size={16} />
          Advanced Filters
          {hasActiveFilters && (
            <span className="filter-active-badge">
              {
                [
                  filterDepartment,
                  filterTag,
                  filterDateFrom,
                  filterDateTo,
                ].filter(Boolean).length
              }
            </span>
          )}
        </button>
        {hasActiveFilters && (
          <button
            type="button"
            className="clear-filters-btn"
            onClick={clearAdvancedFilters}
          >
            <X size={14} /> Clear filters
          </button>
        )}
      </div>

      {showAdvanced && (
        <div className="advanced-filter-panel">
          <div className="advanced-filter-grid">
            <div className="filter-group">
              <label htmlFor="dept-filter">Department</label>
              <select
                id="dept-filter"
                value={filterDepartment}
                onChange={(e) => setFilterDepartment(e.target.value)}
                className="filter-select"
              >
                <option value="">All departments</option>
                {departmentOptions.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label htmlFor="date-from">Published from</label>
              <input
                id="date-from"
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="filter-input"
              />
            </div>

            <div className="filter-group">
              <label htmlFor="date-to">Published to</label>
              <input
                id="date-to"
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="filter-input"
              />
            </div>
          </div>
        </div>
      )}

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
            Found {pagination.total} result{pagination.total === 1 ? '' : 's'}
            {(searchTerm || filterTag) && ' for your query'}
          </div>

          <div className="search-results-grid">
            {articles.map((article) => (
              <ArticleCard key={article._id} article={article} />
            ))}
          </div>
          <div className="search-pagination">
            <button
              type="button"
              className="dashboard-search-btn"
              disabled={!pagination.hasPrevPage}
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            >
              Previous
            </button>
            <span>
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              type="button"
              className="dashboard-search-btn"
              disabled={!pagination.hasNextPage}
              onClick={() => setCurrentPage((prev) => prev + 1)}
            >
              Next
            </button>
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

import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Clock } from 'lucide-react';
import { useFetcher } from '../../../hooks/useFetcher.js';
import './search-bar.css';

const RECENT_SEARCHES_KEY = 'mkb_recent_searches';
const MAX_RECENT = 5;

const getRecentSearches = () => {
  try {
    return JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || '[]');
  } catch {
    return [];
  }
};

const saveRecentSearch = (term) => {
  if (!term.trim()) return;
  const existing = getRecentSearches().filter(
    (s) => s.toLowerCase() !== term.toLowerCase()
  );
  localStorage.setItem(
    RECENT_SEARCHES_KEY,
    JSON.stringify([term, ...existing].slice(0, MAX_RECENT))
  );
};

const SearchBar = ({ setSearchTerm, articleTitles = [] }) => {
  const [displayValue, setDisplayValue] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const containerRef = useRef(null);
  const { fetcher } = useFetcher();

  useEffect(() => {
    setRecentSearches(getRecentSearches());
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchTerm(displayValue);
    }, 500);
    return () => clearTimeout(handler);
  }, [displayValue, setSearchTerm]);

  useEffect(() => {
    if (!displayValue.trim()) {
      setSuggestions([]);
      return;
    }
    const lower = displayValue.toLowerCase();
    const localMatches = articleTitles
      .filter((t) => t.toLowerCase().includes(lower))
      .slice(0, 6);
    setSuggestions(localMatches);

    const handler = setTimeout(async () => {
      const response = await fetcher(
        `/api/articles/autocomplete?q=${encodeURIComponent(displayValue)}`
      );
      if (response.success && Array.isArray(response.data)) {
        const merged = [
          ...response.data,
          ...localMatches.filter((t) => !response.data.includes(t)),
        ];
        setSuggestions(merged.slice(0, 8));
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [displayValue, articleTitles, fetcher]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleClear = () => {
    setDisplayValue('');
    setSearchTerm('');
    setShowDropdown(false);
  };

  const handleSelect = (term) => {
    setDisplayValue(term);
    setSearchTerm(term);
    saveRecentSearch(term);
    setRecentSearches(getRecentSearches());
    setShowDropdown(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (displayValue.trim()) {
      saveRecentSearch(displayValue.trim());
      setRecentSearches(getRecentSearches());
    }
    setShowDropdown(false);
  };

  const dropdownItems = displayValue.trim() ? suggestions : recentSearches;

  const showSuggestions = showDropdown && dropdownItems.length > 0;

  return (
    <div className="search-filter-wrapper">
      <form
        className="search-container"
        ref={containerRef}
        onSubmit={handleSubmit}
      >
        <Search className="search-icon" size={20} />
        <input
          type="text"
          className="search-input"
          placeholder="Search articles, guides, or policies..."
          value={displayValue}
          onChange={(e) => setDisplayValue(e.target.value)}
          onFocus={() => setShowDropdown(true)}
          onKeyDown={(e) => e.key === 'Escape' && setShowDropdown(false)}
          autoComplete="off"
        />
        {displayValue && (
          <button
            type="button"
            className="clear-search"
            onClick={handleClear}
            aria-label="Clear search"
          >
            <X size={18} />
          </button>
        )}

        {showSuggestions && (
          <ul className="search-autocomplete-dropdown" role="listbox">
            {!displayValue.trim() && (
              <li className="autocomplete-section-label">
                <Clock size={12} /> Recent searches
              </li>
            )}
            {dropdownItems.map((item) => (
              <li
                key={item}
                role="option"
                className="autocomplete-item"
                onMouseDown={() => handleSelect(item)}
              >
                {!displayValue.trim() && (
                  <Clock size={13} className="autocomplete-item-icon" />
                )}
                {item}
              </li>
            ))}
          </ul>
        )}
      </form>
    </div>
  );
};

export default SearchBar;

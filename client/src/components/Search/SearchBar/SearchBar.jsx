import React, { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import './search-bar.css';

const SearchBar = ({ setSearchTerm, setFilterTag, availableTags = [] }) => {
  const [displayValue, setDisplayValue] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchTerm(displayValue);
    }, 500);
    return () => clearTimeout(handler);
  }, [displayValue, setSearchTerm]);

  const handleClear = () => {
    setDisplayValue('');
    setSearchTerm('');
  };

  return (
    <div className="search-filter-wrapper">
      <div className="search-container">
        <input
          type="text"
          className="search-input"
          placeholder="Search articles, guides, or policies..."
          value={displayValue}
          onChange={(e) => setDisplayValue(e.target.value)}
        />
        {displayValue && (
          <button
            className="clear-search"
            onClick={handleClear}
            aria-label="Clear search"
          >
            <X size={18} />
          </button>
        )}
        <Search className="search-icon" size={20} />
      </div>
    </div>
  );
};

export default SearchBar;

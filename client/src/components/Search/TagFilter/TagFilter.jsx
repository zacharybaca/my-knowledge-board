import React from 'react';
import { Tag } from 'lucide-react';
import './tag-filter.css';

const TagFilter = ({ availableTags, selectedTag, onSelectTag }) => {
  if (!availableTags || availableTags.length === 0) {
    return null; // Don't render anything if there are no tags
  }

  return (
    <div className="tag-filter-wrapper">
      <div className="tag-filter-header">
        <Tag size={16} className="tag-filter-icon" />
        <span>Filter by Topic:</span>
      </div>

      <div className="tag-filter-list">
        <button
          className={`tag-filter-btn ${selectedTag === '' ? 'active' : ''}`}
          onClick={() => onSelectTag('')}
        >
          All Topics
        </button>

        {availableTags.map((tag) => (
          <button
            key={tag}
            className={`tag-filter-btn ${selectedTag === tag ? 'active' : ''}`}
            onClick={() => onSelectTag(tag)}
          >
            {tag}
          </button>
        ))}
      </div>
    </div>
  );
};

export default TagFilter;

import React from 'react';
import { Link } from 'react-router-dom';

const Logo = () => {
  return (
    <Link to="/" className="brand-logo">
      <svg
        width="32"
        height="32"
        viewBox="0 0 512 512"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="brand-icon"
      >
        <rect width="512" height="512" rx="112" fill="#0f172a" />
        <rect x="152" y="136" width="48" height="240" rx="24" fill="#10b981" />
        <path
          d="M360 144L176 256"
          stroke="#10b981"
          strokeWidth="48"
          strokeLinecap="round"
        />
        <path
          d="M176 256L360 368"
          stroke="#10b981"
          strokeWidth="48"
          strokeLinecap="round"
        />
        <circle cx="360" cy="144" r="32" fill="#10b981" />
        <circle cx="360" cy="368" r="32" fill="#10b981" />
        <circle cx="176" cy="256" r="20" fill="#0f172a" />
      </svg>
      <span className="brand-text">
        My<span className="brand-accent">KnowledgeBoard</span>
        <p className="brand-tagline">
          <span className="word-color">Knowledge</span>.{' '}
          <span className="alt-word-color">Within Reach.</span>
        </p>
      </span>
    </Link>
  );
};

export default Logo;

import React, { useState } from 'react';
import { Pin, PinOff } from 'lucide-react';
import { useFetcher } from '../../../hooks/useFetcher';
import './pin-button.css';

const PinButton = ({ articleId, initialIsPinned = true, onToggleComplete }) => {
  const [isPinned, setIsPinned] = useState(initialIsPinned);
  const [isLoading, setIsLoading] = useState(false);
  const { fetcher } = useFetcher();

  const handleToggle = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isLoading) return;

    setIsLoading(true);
    const response = await fetcher(`/api/users/favorites/${articleId}`, {
      method: 'PATCH',
    });

    if (response.success) {
      setIsPinned(!isPinned);
      if (onToggleComplete) onToggleComplete(articleId, !isPinned);
    }
    setIsLoading(false);
  };

  return (
    <button
      onClick={handleToggle}
      disabled={isLoading}
      className={`pin-btn ${isPinned ? 'pinned' : ''}`}
      title={isPinned ? 'Unpin Article' : 'Pin Article'}
    >
      {isPinned ? <PinOff size={18} /> : <Pin size={18} />}
    </button>
  );
};

export default PinButton;

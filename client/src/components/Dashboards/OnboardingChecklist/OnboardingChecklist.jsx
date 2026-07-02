import React, { useState, useEffect } from 'react';
import { CheckCircle2, Circle, PartyPopper } from 'lucide-react';
import { useFetcher } from '../../../hooks/useFetcher.js';
import './onboarding-checklist.css';

const STEPS = [
  { key: 'joinedWorkspace', label: 'Join a workspace' },
  { key: 'readArticle', label: 'Read your first article' },
  { key: 'submittedArticle', label: 'Submit your first article' },
];

const OnboardingChecklist = () => {
  const { fetcher } = useFetcher();
  const [onboarding, setOnboarding] = useState(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const fetchOnboarding = async () => {
      const response = await fetcher('/api/users/me/onboarding');
      if (response.success) {
        setOnboarding(response.data);
      }
    };

    fetchOnboarding();
  }, [fetcher]);

  const allComplete = onboarding && STEPS.every((step) => onboarding[step.key]);

  useEffect(() => {
    if (!allComplete) return undefined;
    const timeout = setTimeout(() => setVisible(false), 2000);
    return () => clearTimeout(timeout);
  }, [allComplete]);

  if (!onboarding || !visible) return null;

  return (
    <div className="onboarding-checklist-card">
      {allComplete ? (
        <div className="onboarding-complete">
          <PartyPopper size={20} /> You're all set!
        </div>
      ) : (
        <>
          <h4>Getting Started</h4>
          <ul className="onboarding-steps">
            {STEPS.map((step) => (
              <li key={step.key} className={onboarding[step.key] ? 'done' : ''}>
                {onboarding[step.key] ? (
                  <CheckCircle2 size={16} />
                ) : (
                  <Circle size={16} />
                )}
                <span>{step.label}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};

export default OnboardingChecklist;

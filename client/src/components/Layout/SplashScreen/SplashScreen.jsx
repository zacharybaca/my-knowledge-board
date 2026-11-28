import React, { useEffect, useState } from 'react';
import './splash-screen.css';

/**
 * SplashScreen Component
 *
 * Renders an animated splash / onboarding screen featuring the MyKnowledgeBoard
 * geometric network-circuit logo with sequential node ignition, path tracing,
 * and glowing status indicators.
 *
 * @param {Function} onFinish - Optional callback triggered once animations complete.
 * @param {string} workspaceName - Optional tenant/company workspace name to display.
 * @param {number} duration - Milliseconds before invoking onFinish (default: 3200ms).
 */
const SplashScreen = ({ onFinish, workspaceName, duration = 3200 }) => {
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    // Initiate fade-out transition 500ms before duration ends
    const fadeTimer = setTimeout(
      () => {
        setFadingOut(true);
      },
      Math.max(duration - 500, 1000)
    );

    // Complete lifecycle
    const finishTimer = setTimeout(() => {
      if (onFinish) onFinish();
    }, duration);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(finishTimer);
    };
  }, [duration, onFinish]);

  return (
    <div className={`splash-overlay ${fadingOut ? 'splash-fade-out' : ''}`}>
      <div className="splash-card">
        {/* Animated Network Logo Container */}
        <div className="splash-logo-container">
          <div className="splash-glow-backdrop" />

          <svg
            className="splash-logo-svg"
            viewBox="0 0 160 160"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              {/* Neon Green Circuit Gradient */}
              <linearGradient
                id="mkb-gradient"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="50%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#059669" />
              </linearGradient>

              {/* Radial Glow Filter */}
              <filter
                id="mkb-glow"
                x="-20%"
                y="-20%"
                width="140%"
                height="140%"
              >
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Circuit Grid Rings / Radar Pulse */}
            <circle
              cx="80"
              cy="80"
              r="70"
              className="circuit-ring ring-outer"
            />
            <circle
              cx="80"
              cy="80"
              r="54"
              className="circuit-ring ring-inner"
            />

            {/* Connecting Circuit Network Traces (Geometric "K" & "B" Structure) */}
            <g className="circuit-pathways" filter="url(#mkb-glow)">
              {/* Vertical Spine */}
              <path d="M 46 32 L 46 128" className="circuit-line line-spine" />

              {/* Core Junctions and Diagonal Bridges */}
              <path d="M 46 80 L 92 36" className="circuit-line line-diag-up" />
              <path
                d="M 46 80 L 96 126"
                className="circuit-line line-diag-down"
              />
              <path
                d="M 92 36 L 118 64"
                className="circuit-line line-branch-1"
              />
              <path
                d="M 118 64 L 84 80"
                className="circuit-line line-branch-2"
              />
              <path
                d="M 84 80 L 118 96"
                className="circuit-line line-branch-3"
              />
              <path
                d="M 118 96 L 96 126"
                className="circuit-line line-branch-4"
              />
            </g>

            {/* Sequential Igniting Network Nodes / Vertices */}
            <g className="network-nodes">
              {/* Central Pivot Node */}
              <circle
                cx="80"
                cy="80"
                r="4.5"
                className="node-point node-center"
              />

              {/* Spine Nodes */}
              <circle cx="46" cy="32" r="4" className="node-point node-1" />
              <circle cx="46" cy="80" r="5" className="node-point node-root" />
              <circle cx="46" cy="128" r="4" className="node-point node-2" />

              {/* Right Network Nodes */}
              <circle cx="92" cy="36" r="4" className="node-point node-3" />
              <circle cx="118" cy="64" r="3.5" className="node-point node-4" />
              <circle cx="118" cy="96" r="3.5" className="node-point node-5" />
              <circle cx="96" cy="126" r="4" className="node-point node-6" />
            </g>
          </svg>
        </div>

        {/* Brand Typography & Verification Status */}
        <div className="splash-text-container">
          <h1 className="splash-title">
            MyKnowledge<span>Board</span>
          </h1>
          <p className="splash-subtitle">
            {workspaceName
              ? `Connecting to ${workspaceName} workspace...`
              : 'Decentralized Intelligence & Verified Knowledge'}
          </p>
        </div>

        {/* Micro Loader Bar */}
        <div className="splash-progress-track">
          <div className="splash-progress-fill" />
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;

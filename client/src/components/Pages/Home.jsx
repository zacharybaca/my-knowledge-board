import React from 'react';
import './home.css';
import CompanyList from '../Company/CompanyList/CompanyList.jsx';

const Home = () => {
  return (
    <div className="home-page">
      <section className="hero-section">
        <div className="container hero-layout">
          {/* Text Content */}
          <div className="hero-text">
            <h1>
              My<span className="hero-accent">KnowledgeBoard</span>
            </h1>
            <p>
              Access company policies, process guides, and essential
              documentation all in one place.
            </p>
          </div>

          {/* New Video Integration */}
          <div className="hero-video-container">
            <video
              autoPlay
              loop
              muted={false} // Note: Keeping muted={false} often fails autoplay. Keep it true initially.
              playsInline
              controls // Add this attribute
              className="intro-video"
            >
              <source
                src="https://res.cloudinary.com/djud9gkxx/video/upload/f_auto,q_auto/my-knowledgeboard-intro_tihbdg.mp4"
                type="video/mp4"
              />
              Your browser does not support the video tag.
            </video>
          </div>
        </div>
      </section>

      <div className="page-content">
        <section className="all-companies-section">
          <h2>Browse Participating Organizations</h2>
          <CompanyList />
        </section>
      </div>
    </div>
  );
};

export default Home;

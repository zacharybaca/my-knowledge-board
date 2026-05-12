import React from 'react';
import './home.css';
import CompanyList from '../Company/CompanyList/CompanyList.jsx';

const Home = () => {
  return (
    <div className="home-page">
      <section className="hero-section">
        <div className="container">
          <h1>My<span className="hero-accent">KnowledgeBoard</span></h1>
          <p>Access company policies, process guides, and essential documentation all in one place.</p>
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

import React from 'react';
import { Link } from 'react-router-dom';
import Logo from './Logo';
import './nav-bar.css';

const NavBar = () => {
  return (
    <header className="navbar">
      <div className="navbar-container">

        {/* The new professional Logo + Text component */}
        <Logo />

        <nav className="nav-links">
          <Link to="/login" className="nav-link">Log In</Link>
          <Link to="/register-company" className="nav-cta">Register Workspace</Link>
        </nav>

      </div>
    </header>
  );
};

export default NavBar;

import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth.js';
import './nav-bar.css';

const NavBar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = async (e) => {
    e.preventDefault();
    // Clears local session-specific storage if applicable
    localStorage.removeItem('user-wallpaper');

    await logout();
    setIsDropdownOpen(false);
    navigate('/login', { state: { message: 'Successfully logged out.' } });
  };

  const closeMenu = () => setIsDropdownOpen(false);

  return (
    <nav className="main-nav">
      <div className="nav-container">
        <Link to="/" className="nav-brand-wrapper" onClick={closeMenu}>
          <div className="nav-logo">
            My<span className="my-logo-accent">KnowledgeBoard</span>
          </div>
          <span className="nav-tagline">Knowledge Within Reach</span>
        </Link>

        <ul className="nav-links">
          <li>
            <Link to="/articles" className="nav-item">
              Browse Articles
            </Link>
          </li>

          {!user ? (
            <>
              <li>
                <Link to="/register" className="nav-item">
                  Sign Up
                </Link>
              </li>
              <li>
                <Link to="/login" className="nav-item">
                  Login
                </Link>
              </li>
            </>
          ) : (
            <li className="user-menu-container" ref={dropdownRef}>
              <button
                className="dropdown-toggle"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                aria-haspopup="true"
                aria-expanded={isDropdownOpen}
              >
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={`${user.firstName}'s avatar`}
                    className="nav-avatar"
                  />
                ) : (
                  <div className="nav-avatar-fallback">
                    {user.firstName ? user.firstName.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}

                <span className="nav-username">
                  {user.firstName} {user.lastName}
                </span>
                <span className={`chevron ${isDropdownOpen ? 'open' : ''}`}>
                  ▼
                </span>
              </button>

              {isDropdownOpen && (
                <div className="dropdown-menu">
                  <div className="dropdown-header">
                    Signed in as <br />
                    <strong>{user.email}</strong>
                  </div>

                  <div className="dropdown-divider"></div>

                  <Link to="/dashboard" className="dropdown-item" onClick={closeMenu}>
                    User Dashboard
                  </Link>

                  <Link to="/submit-article" className="dropdown-item" onClick={closeMenu}>
                    Submit Article
                  </Link>

                  <Link to="/favorites" className="dropdown-item" onClick={closeMenu}>
                    Favorite Articles
                  </Link>

                  {/* Show Manager/Admin options based on Role */}
                  {(user.role === 'Manager' || user.role === 'Admin') && (
                    <>
                      <div className="dropdown-divider"></div>
                      <Link to="/approvals" className="dropdown-item" onClick={closeMenu}>
                        Review Submissions
                      </Link>
                    </>
                  )}

                  {user.isAdmin && (
                    <Link to="/admin/dashboard" className="dropdown-item" onClick={closeMenu}>
                      Admin Panel
                    </Link>
                  )}

                  <div className="dropdown-divider"></div>

                  <Link to="/settings" className="dropdown-item" onClick={closeMenu}>
                    Profile Settings
                  </Link>

                  <button
                    onClick={handleLogout}
                    className="dropdown-item logout-item"
                  >
                    Logout
                  </button>
                </div>
              )}
            </li>
          )}
        </ul>
      </div>
    </nav>
  );
};

export default NavBar;

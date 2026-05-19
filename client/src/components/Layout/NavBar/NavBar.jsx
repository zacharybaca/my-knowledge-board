import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Logo from './Logo';
import { useAuth } from '../../../hooks/useAuth.js';
import {
  ChevronDown,
  LogOut,
  LayoutDashboard,
  Search,
  PenSquare,
  User,
} from 'lucide-react';
import './nav-bar.css';

const NavBar = () => {
  const { user, logout, isUserAdmin } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Close dropdown when clicking outside of it
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    setDropdownOpen(false);
    navigate('/login');
  };

  const closeDropdown = () => setDropdownOpen(false);

  return (
    <header className="navbar">
      <div className="navbar-container">
        <Logo />

        <nav className="nav-links">
          {!user ? (
            <>
              <Link to="/login" className="nav-link">
                Log In
              </Link>
              <Link to="/register-company" className="nav-cta">
                Register Workspace
              </Link>
            </>
          ) : (
            <div className="user-menu-container" ref={dropdownRef}>
              <button
                className="user-menu-toggle"
                onClick={() => setDropdownOpen(!dropdownOpen)}
              >
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt="Profile"
                    className="user-avatar"
                  />
                ) : (
                  <div className="user-avatar-placeholder">
                    {user.firstName?.charAt(0)}
                    {user.lastName?.charAt(0)}
                  </div>
                )}
                <span className="user-name">{user.firstName}</span>
                <ChevronDown
                  size={16}
                  className={`chevron ${dropdownOpen ? 'open' : ''}`}
                />
              </button>

              {dropdownOpen && (
                <div className="dropdown-menu">
                  <div className="dropdown-header">
                    <p className="dropdown-user-name">
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="dropdown-user-email">{user.email}</p>
                    <span className="dropdown-user-role">{user.role}</span>
                  </div>

                  <div className="dropdown-divider"></div>

                  <Link
                    to={
                      isUserAdmin ? '/manager-dashboard' : '/employee-dashboard'
                    }
                    className="dropdown-item"
                    onClick={closeDropdown}
                  >
                    <LayoutDashboard size={16} />
                    <span>Dashboard</span>
                  </Link>

                  <Link
                    to="/search"
                    className="dropdown-item"
                    onClick={closeDropdown}
                  >
                    <Search size={16} />
                    <span>Knowledge Base</span>
                  </Link>

                  <Link
                    to="/articles/new"
                    className="dropdown-item"
                    onClick={closeDropdown}
                  >
                    <PenSquare size={16} />
                    <span>Write Article</span>
                  </Link>

                  {/* NEW PROFILE SETTINGS LINK */}
                  <Link
                    to="/profile-settings"
                    className="dropdown-item"
                    onClick={closeDropdown}
                  >
                    <User size={16} />
                    <span>Profile Settings</span>
                  </Link>

                  <div className="dropdown-divider"></div>

                  <button
                    className="dropdown-item logout-btn"
                    onClick={handleLogout}
                  >
                    <LogOut size={16} />
                    <span>Log Out</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </nav>
      </div>
    </header>
  );
};

export default NavBar;

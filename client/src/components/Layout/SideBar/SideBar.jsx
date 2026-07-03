import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth.js';
import {
  LayoutDashboard,
  Search,
  PenSquare,
  User,
  UserPlus,
  Users,
  ScrollText,
  Building2,
  ClipboardCheck,
  BarChart2,
  Settings,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import './side-bar.css';

const ALL_NAV_ITEMS = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    route: null, // resolved dynamically
    adminOnly: false,
  },
  {
    id: 'knowledge-base',
    label: 'Knowledge Base',
    icon: Search,
    route: '/search',
    adminOnly: false,
  },
  {
    id: 'write-article',
    label: 'Write Article',
    icon: PenSquare,
    route: '/articles/new',
    adminOnly: false,
  },
  {
    id: 'profile-settings',
    label: 'Profile Settings',
    icon: User,
    route: '/profile-settings',
    adminOnly: false,
  },
  {
    id: 'provision-user',
    label: 'Provision User',
    icon: UserPlus,
    route: '/create-user',
    adminOnly: true,
  },
  {
    id: 'user-management',
    label: 'User Management',
    icon: Users,
    route: '/user-management',
    adminOnly: true,
  },
  {
    id: 'session-logs',
    label: 'Session Logs',
    icon: ScrollText,
    route: '/session-logs',
    adminOnly: true,
  },
  {
    id: 'workspaces',
    label: 'Workspace Mgmt',
    icon: Building2,
    route: '/workspaces',
    adminOnly: true,
  },
  {
    id: 'freshness',
    label: 'Freshness',
    icon: ClipboardCheck,
    route: '/freshness',
    adminOnly: true,
  },
  {
    id: 'content-gaps',
    label: 'Content Gaps',
    icon: BarChart2,
    route: '/content-gaps',
    adminOnly: true,
  },
];

const SideBar = ({ isCollapsed, onToggle, isMobileOpen, onMobileClose }) => {
  const { user, isUserAdmin } = useAuth();
  const location = useLocation();
  const [customizeOpen, setCustomizeOpen] = useState(false);

  const prefsKey = user ? `sidebar-prefs-${user._id}` : null;

  const getDefaultPrefs = () => {
    const defaults = {};
    ALL_NAV_ITEMS.forEach((item) => {
      defaults[item.id] = true;
    });
    return defaults;
  };

  const [visiblePrefs, setVisiblePrefs] = useState(() => {
    if (!prefsKey) return getDefaultPrefs();
    try {
      const stored = localStorage.getItem(prefsKey);
      return stored ? JSON.parse(stored) : getDefaultPrefs();
    } catch {
      return getDefaultPrefs();
    }
  });

  // Reload prefs when user changes (e.g. after login)
  useEffect(() => {
    if (!prefsKey) return;
    try {
      const stored = localStorage.getItem(prefsKey);
      setVisiblePrefs(stored ? JSON.parse(stored) : getDefaultPrefs());
    } catch {
      setVisiblePrefs(getDefaultPrefs());
    }
  }, [prefsKey]);

  const togglePref = (id) => {
    setVisiblePrefs((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      if (prefsKey) localStorage.setItem(prefsKey, JSON.stringify(next));
      return next;
    });
  };

  const availableItems = ALL_NAV_ITEMS.filter(
    (item) => !item.adminOnly || isUserAdmin
  );

  const visibleItems = availableItems.filter((item) => visiblePrefs[item.id]);

  const resolveRoute = (item) => {
    if (item.id === 'dashboard') {
      return isUserAdmin ? '/manager-dashboard' : '/employee-dashboard';
    }
    return item.route;
  };

  const isActive = (item) => {
    const route = resolveRoute(item);
    if (item.id === 'dashboard') {
      return (
        location.pathname === '/manager-dashboard' ||
        location.pathname === '/employee-dashboard'
      );
    }
    return location.pathname === route;
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div className="sidebar-backdrop" onClick={onMobileClose} />
      )}

      <aside
        className={[
          'sidebar',
          isCollapsed ? 'sidebar--collapsed' : 'sidebar--expanded',
          isMobileOpen ? 'sidebar--mobile-open' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {/* Toggle button (desktop) */}
        <button
          className="sidebar-toggle"
          onClick={onToggle}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>

        {/* Mobile close button */}
        <button
          className="sidebar-mobile-close"
          onClick={onMobileClose}
          aria-label="Close sidebar"
        >
          <X size={18} />
        </button>

        {/* Nav items */}
        <nav className="sidebar-nav">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const route = resolveRoute(item);
            const active = isActive(item);
            return (
              <Link
                key={item.id}
                to={route}
                className={`sidebar-item${active ? ' sidebar-item--active' : ''}`}
                title={isCollapsed ? item.label : undefined}
                onClick={onMobileClose}
              >
                <Icon size={20} className="sidebar-item-icon" />
                <span className="sidebar-item-label">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Customize button */}
        <div className="sidebar-footer">
          <button
            className={`sidebar-item sidebar-customize-btn${customizeOpen ? ' sidebar-item--active' : ''}`}
            onClick={() => setCustomizeOpen((o) => !o)}
            title={isCollapsed ? 'Customize' : undefined}
          >
            <Settings size={20} className="sidebar-item-icon" />
            <span className="sidebar-item-label">Customize</span>
          </button>
        </div>

        {/* Customization panel */}
        {customizeOpen && (
          <div className="sidebar-customize-panel">
            <p className="sidebar-customize-title">Show / Hide Items</p>
            {availableItems.map((item) => {
              const Icon = item.icon;
              return (
                <label key={item.id} className="sidebar-customize-row">
                  <input
                    type="checkbox"
                    checked={!!visiblePrefs[item.id]}
                    onChange={() => togglePref(item.id)}
                  />
                  <Icon size={15} />
                  <span>{item.label}</span>
                </label>
              );
            })}
          </div>
        )}
      </aside>
    </>
  );
};

export default SideBar;

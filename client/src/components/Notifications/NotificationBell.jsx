import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCircle } from 'lucide-react';
import { useFetcher } from '../../hooks/useFetcher';
import { useSocket } from '../../hooks/useSocket';
import './notifications.css';

const NotificationBell = () => {
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const { fetcher } = useFetcher();
  const socket = useSocket();
  const navigate = useNavigate();
  const dropdownRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    const response = await fetcher('/api/notifications');
    if (response.success) {
      setNotifications(response.data);
    }
  }, [fetcher]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    if (!socket) return;

    socket.on('new_notification', fetchNotifications);

    // --- THE FIX: Listen for global refreshes ---
    socket.on('refresh_notifications', fetchNotifications);

    return () => {
      socket.off('new_notification');
      socket.off('refresh_notifications');
    };
  }, [socket, fetchNotifications]);

  // Handle outside click to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = async (notif) => {
    if (!notif.isRead) {
      const response = await fetcher(`/api/notifications/${notif._id}/read`, {
        method: 'PATCH',
      });
      if (response.success) {
        setNotifications((prev) =>
          prev.map((n) => (n._id === notif._id ? { ...n, isRead: true } : n))
        );
      }
    }
    setIsOpen(false);

    // Route based on role context
    if (notif.type === 'Approval_Needed') {
      navigate(`/queue/${notif.referenceId}`);
    } else {
      navigate(`/articles/${notif.referenceId}`);
    }
  };

  const handleMarkAllRead = async () => {
    const response = await fetcher('/api/notifications/read-all', {
      method: 'PATCH',
    });
    if (response.success) {
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    }
  };

  const handleClearRead = async () => {
    const response = await fetcher('/api/notifications/read', {
      method: 'DELETE',
    });
    if (response.success) {
      setNotifications((prev) =>
        prev.filter((notification) => !notification.isRead)
      );
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const hasReadNotifications = notifications.some((n) => n.isRead);

  return (
    <div className="notification-wrapper" ref={dropdownRef}>
      <button
        className="notification-bell-btn"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Bell size={24} />
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="notification-dropdown">
          <div className="notification-header">
            <h4>Notifications</h4>
            <div className="notification-actions">
              {notifications.some((n) => !n.isRead) && (
                <button
                  type="button"
                  className="mark-all-read-btn"
                  onClick={handleMarkAllRead}
                >
                  Mark all as read
                </button>
              )}
              {hasReadNotifications && (
                <button
                  type="button"
                  className="clear-read-btn"
                  onClick={handleClearRead}
                >
                  Clear read
                </button>
              )}
            </div>
          </div>
          <div className="notification-list">
            {notifications.length === 0 ? (
              <p className="no-notifications">No notifications.</p>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif._id}
                  className={`notification-item ${notif.isRead ? 'read' : 'unread'}`}
                  onClick={() => handleNotificationClick(notif)}
                >
                  <div className="notification-icon">
                    <CheckCircle size={16} />
                  </div>
                  <div className="notification-content">
                    <p>{notif.message}</p>
                    <span className="notification-time">
                      {new Date(notif.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {!notif.isRead && <div className="unread-dot"></div>}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;

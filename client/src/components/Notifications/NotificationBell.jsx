import React, { useState, useEffect, useRef } from 'react';
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

  useEffect(() => {
    const fetchNotifications = async () => {
      const response = await fetcher('/api/notifications');
      if (response.success) {
        setNotifications(response.data);
      }
    };
    fetchNotifications();
  }, [fetcher]);

  useEffect(() => {
    if (!socket) return;

    socket.on('new_notification', () => {
      // Re-fetch to ensure the notification ID and data are accurate
      const fetchNew = async () => {
        const response = await fetcher('/api/notifications');
        if (response.success) setNotifications(response.data);
      };
      fetchNew();
    });

    return () => socket.off('new_notification');
  }, [socket, fetcher]);

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

  const unreadCount = notifications.filter((n) => !n.isRead).length;

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

import React, { useState, useEffect } from 'react';
import { useFetcher } from '../../hooks/useFetcher';
import { Clock } from 'lucide-react';
import Toast from '../Layout/Toast/Toast';
import './session-logs.css';

const SessionLogs = () => {
  const { fetcher } = useFetcher();
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isClearing, setIsClearing] = useState(false);
  const [toastConfig, setToastConfig] = useState(null);

  useEffect(() => {
    const fetchLogs = async () => {
      const response = await fetcher('/api/sessions');
      if (response.success) {
        setLogs(response.data);
      } else {
        setToastConfig({ type: 'error', message: response.error });
      }
      setIsLoading(false);
    };
    fetchLogs();
  }, [fetcher]);

  const handleClearLogs = async () => {
    if (logs.length === 0 || isClearing) return;

    const confirmed = window.confirm(
      'Are you sure you want to clear access logs for your workspace?'
    );

    if (!confirmed) return;

    setIsClearing(true);
    const response = await fetcher('/api/sessions', {
      method: 'DELETE',
    });
    setIsClearing(false);

    if (response.success) {
      setLogs([]);
      setToastConfig({
        type: 'success',
        message: `Logs cleared (${response.data.deletedCount || 0} removed).`,
      });
    } else {
      setToastConfig({ type: 'error', message: response.error });
    }
  };

  const formatDuration = (minutes) => {
    if (minutes < 1) return '< 1m';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  if (isLoading) return <div className="spinner"></div>;

  return (
    <div className="session-logs-container">
      {toastConfig && (
        <Toast
          message={toastConfig.message}
          type={toastConfig.type}
          onClose={() => setToastConfig(null)}
        />
      )}
      <div className="logs-header">
        <Clock size={24} color="#10b981" />
        <h2>Access & Activity Logs</h2>
        <button
          type="button"
          className="btn-clear-logs"
          onClick={handleClearLogs}
          disabled={isClearing || logs.length === 0}
        >
          {isClearing ? 'Clearing...' : 'Clear Logs'}
        </button>
      </div>

      <table className="logs-table">
        <thead>
          <tr>
            <th>User</th>
            <th>Department</th>
            <th>Login Date & Time</th>
            <th>Logout Time</th>
            <th>Duration</th>
          </tr>
        </thead>
        <tbody>
          {logs.length === 0 ? (
            <tr>
              <td colSpan={5} className="logs-empty-row">
                No access logs available.
              </td>
            </tr>
          ) : (
            logs.map((log) => (
              <tr key={log._id}>
                <td>
                  {log.userId?.firstName} {log.userId?.lastName}
                  <div className="log-email">{log.userId?.email}</div>
                </td>
                <td>{log.userId?.department}</td>
                <td>{new Date(log.loginTime).toLocaleString()}</td>
                <td>
                  {log.logoutTime ? (
                    new Date(log.logoutTime).toLocaleTimeString()
                  ) : (
                    <span className="active-badge">Active</span>
                  )}
                </td>
                <td className="duration-cell">
                  {log.logoutTime ? formatDuration(log.durationMinutes) : '---'}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default SessionLogs;

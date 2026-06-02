import React, { useState, useEffect } from 'react';
import { useFetcher } from '../../hooks/useFetcher';
import { Clock } from 'lucide-react';
import './session-logs.css';

const SessionLogs = () => {
  const { fetcher } = useFetcher();
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      const response = await fetcher('/api/sessions');
      if (response.success) {
        setLogs(response.data);
      }
      setIsLoading(false);
    };
    fetchLogs();
  }, [fetcher]);

  const formatDuration = (minutes) => {
    if (minutes < 1) return '< 1m';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  if (isLoading) return <div className="spinner"></div>;

  return (
    <div className="session-logs-container">
      <div className="logs-header">
        <Clock size={24} color="#10b981" />
        <h2>Access & Activity Logs</h2>
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
          {logs.map((log) => (
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
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default SessionLogs;

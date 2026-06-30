import React, { useState, useEffect, useCallback } from 'react';
import { useFetcher } from '../../../hooks/useFetcher';
import {
  MessageCircleQuestion,
  BarChart3,
  Clock,
  TrendingUp,
} from 'lucide-react';
import './content-gap-dashboard.css';

const ContentGapDashboard = () => {
  const { fetcher } = useFetcher();
  const [topGaps, setTopGaps] = useState([]);
  const [recentLogs, setRecentLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('top');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const response = await fetcher('/api/analytics/content-gaps');
    if (response.success) {
      setTopGaps(response.data.topGaps || []);
      setRecentLogs(response.data.logs || []);
      setTotal(response.data.total || 0);
    }
    setIsLoading(false);
  }, [fetcher]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const maxCount = topGaps.length > 0 ? topGaps[0].count : 1;

  return (
    <div className="content-gap-dashboard">
      <header className="gap-header">
        <MessageCircleQuestion size={28} className="gap-header-icon" />
        <div>
          <h1>Content Gap Analysis</h1>
          <p>
            Questions the AI couldn't answer — each entry represents a missing
            knowledge base article.
          </p>
        </div>
      </header>

      <div className="gap-metrics">
        <div className="gap-metric-card">
          <BarChart3 size={22} className="gap-metric-icon" />
          <div>
            <h3>{total}</h3>
            <p>Total unanswered</p>
          </div>
        </div>
        <div className="gap-metric-card">
          <TrendingUp size={22} className="gap-metric-icon" />
          <div>
            <h3>{topGaps.length > 0 ? topGaps[0].count : 0}</h3>
            <p>Top question count</p>
          </div>
        </div>
        <div className="gap-metric-card">
          <Clock size={22} className="gap-metric-icon" />
          <div>
            <h3>
              {recentLogs.length > 0
                ? new Date(recentLogs[0].createdAt).toLocaleDateString()
                : '—'}
            </h3>
            <p>Latest gap logged</p>
          </div>
        </div>
      </div>

      <div className="gap-tabs">
        <button
          type="button"
          className={`gap-tab ${activeTab === 'top' ? 'active' : ''}`}
          onClick={() => setActiveTab('top')}
        >
          Most Requested ({topGaps.length})
        </button>
        <button
          type="button"
          className={`gap-tab ${activeTab === 'recent' ? 'active' : ''}`}
          onClick={() => setActiveTab('recent')}
        >
          Recent Activity ({recentLogs.length})
        </button>
      </div>

      {isLoading ? (
        <div className="gap-loading">
          <div className="spinner" />
        </div>
      ) : activeTab === 'top' ? (
        topGaps.length === 0 ? (
          <div className="gap-empty">
            <MessageCircleQuestion size={40} className="gap-empty-icon" />
            <h3>No gaps detected yet</h3>
            <p>
              Unanswered AI assistant questions will appear here once employees
              start interacting with the chatbot.
            </p>
          </div>
        ) : (
          <div className="gap-top-list">
            {topGaps.map((gap, index) => (
              <div key={gap._id} className="gap-top-item">
                <span className="gap-rank">#{index + 1}</span>
                <div className="gap-question-wrap">
                  <p className="gap-question">{gap._id}</p>
                  <div className="gap-bar-wrapper">
                    <div
                      className="gap-bar"
                      style={{
                        width: `${Math.max(4, (gap.count / maxCount) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="gap-meta">
                  <span className="gap-count">{gap.count}×</span>
                  <span className="gap-date">
                    {new Date(gap.lastAsked).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )
      ) : recentLogs.length === 0 ? (
        <div className="gap-empty">
          <MessageCircleQuestion size={40} className="gap-empty-icon" />
          <h3>No activity yet</h3>
          <p>Recent unanswered questions will appear here.</p>
        </div>
      ) : (
        <div className="gap-log-table-wrapper">
          <table className="gap-log-table">
            <thead>
              <tr>
                <th>Question</th>
                <th>Asked by</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {recentLogs.map((log) => (
                <tr key={log._id}>
                  <td className="gap-log-question">{log.question}</td>
                  <td>
                    {log.userId
                      ? `${log.userId.firstName} ${log.userId.lastName}`
                      : '—'}
                  </td>
                  <td className="gap-log-date">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ContentGapDashboard;

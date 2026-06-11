import React, { useState, useRef, useEffect } from 'react';
import { useFetcher } from '../../hooks/useFetcher';
import { Link } from 'react-router-dom';
import { X, Send, FileText } from 'lucide-react'; // Added FileText for the citation icon
import './chatbot.css';

const Chatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      sender: 'bot',
      text: 'Hello. I can answer questions regarding company policies and procedures. How can I help?',
      sources: [] // Added empty sources array for the initial message
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { fetcher } = useFetcher();
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setMessages((prev) => [...prev, { sender: 'user', text: userMessage }]);
    setInput('');
    setIsLoading(true);

    // Make sure your endpoint matches what you defined in chatRoutes.js
    // If you changed it to '/' or '/ask', make sure it aligns here.
    const response = await fetcher('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ question: userMessage }),
    });

    if (response.success && response.data) {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: response.data.answer,
          sources: response.data.sources || [] // Capture the RAG citations
        },
      ]);
    } else {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: response.error || 'Error connecting to the knowledge base.',
          sources: []
        },
      ]);
    }

    setIsLoading(false);
  };

  return (
    <>
      {/* Trigger Button with Custom Logo SVG */}
      {!isOpen && (
        <button className="chatbot-trigger" onClick={() => setIsOpen(true)}>
          <svg
            width="60"
            height="60"
            viewBox="0 0 512 512"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect width="512" height="512" rx="112" fill="#0f172a" />
            <rect
              x="152"
              y="136"
              width="48"
              height="240"
              rx="24"
              fill="#10b981"
            />
            <path
              d="M360 144L176 256"
              stroke="#10b981"
              strokeWidth="48"
              strokeLinecap="round"
            />
            <path
              d="M176 256L360 368"
              stroke="#10b981"
              strokeWidth="48"
              strokeLinecap="round"
            />
            <circle cx="360" cy="144" r="32" fill="#10b981" />
            <circle cx="360" cy="368" r="32" fill="#10b981" />
            <circle cx="176" cy="256" r="20" fill="#0f172a" />
          </svg>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="chatbot-window">
          <div className="chatbot-header">
            <h3>
              <span className="color-black">MyKnowledge</span> Assistant
            </h3>
            <button onClick={() => setIsOpen(false)} className="close-btn">
              <X size={20} />
            </button>
          </div>

          <div className="chatbot-messages">
            {messages.map((msg, idx) => (
              <div key={idx} className={`message-bubble ${msg.sender}`}>
                {/* Main LLM Text */}
                <div className="message-text">{msg.text}</div>

                {/* Citations / Sources Block */}
                {msg.sources && msg.sources.length > 0 && (
                  <div
                    className="citation-container"
                    style={{
                      marginTop: '10px',
                      paddingTop: '10px',
                      borderTop: '1px solid rgba(0,0,0,0.1)'
                    }}
                  >
                    <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '4px' }}>
                      Sources:
                    </span>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {msg.sources.map((source) => (
                        <li key={source.id}>
                          <Link
                            to={`/articles/${source.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: '#3b82f6', textDecoration: 'none' }}
                          >
                            <FileText size={12} />
                            [{source.citationNumber}] {source.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="message-bubble bot typing-indicator">
                <span>.</span>
                <span>.</span>
                <span>.</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSend} className="chatbot-input-area">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about a policy..."
              disabled={isLoading}
            />
            <button type="submit" disabled={isLoading || !input.trim()}>
              <Send size={18} />
            </button>
          </form>
        </div>
      )}
    </>
  );
};

export default Chatbot;

import React, { useState, useRef, useEffect } from 'react';
import { useFetcher } from '../../hooks/useFetcher';
import { X, Send } from 'lucide-react';
import './chatbot.css';

const Chatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { sender: 'bot', text: 'Hello. I can answer questions regarding company policies and procedures. How can I help?' }
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
    setMessages(prev => [...prev, { sender: 'user', text: userMessage }]);
    setInput('');
    setIsLoading(true);

    const response = await fetcher('/api/chat/ask', {
      method: 'POST',
      body: JSON.stringify({ question: userMessage })
    });

    if (response.success) {
      setMessages(prev => [...prev, { sender: 'bot', text: response.data.answer }]);
    } else {
      setMessages(prev => [...prev, { sender: 'bot', text: response.error || 'Error connecting to the knowledge base.' }]);
    }

    setIsLoading(false);
  };

  return (
    <>
      {/* Trigger Button with Logo SVG */}
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
            <rect x="152" y="136" width="48" height="240" rx="24" fill="#10b981" />
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
            <h3>Knowledge Assistant</h3>
            <button onClick={() => setIsOpen(false)} className="close-btn">
              <X size={20} />
            </button>
          </div>

          <div className="chatbot-messages">
            {messages.map((msg, idx) => (
              <div key={idx} className={`message-bubble ${msg.sender}`}>
                {msg.text}
              </div>
            ))}
            {isLoading && (
              <div className="message-bubble bot typing-indicator">
                <span>.</span><span>.</span><span>.</span>
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

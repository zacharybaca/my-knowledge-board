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
      setMessages(prev => [...prev, { sender: 'bot', text: 'Error connecting to the knowledge base.' }]);
    }

    setIsLoading(false);
  };

  return (
    <>
      {/* Trigger Button with Animated K */}
      {!isOpen && (
        <button className="chatbot-trigger" onClick={() => setIsOpen(true)}>
          <span className="animated-k">K</span>
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

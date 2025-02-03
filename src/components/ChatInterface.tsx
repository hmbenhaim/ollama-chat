import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Settings, Send, Loader2, Bot, User } from 'lucide-react';

interface Message {
  id?: number;
  role: 'user' | 'assistant' | 'error';
  content: string;
  time: string;
  isStreaming?: boolean;
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [model, setModel] = useState('deepseek-r1:32b');
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const formatTime = () => {
    const now = new Date();
    return now.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    setIsLoading(true);
    const userMessage: Message = { 
      role: 'user', 
      content: input,
      time: formatTime()
    };
    setMessages(prev => [...prev, userMessage]);
    
    const assistantMessageId = Date.now();
    setMessages(prev => [...prev, { 
      id: assistantMessageId,
      role: 'assistant', 
      content: '',
      time: formatTime(),
      isStreaming: true
    }]);
    setInput('');

    try {
      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model,
          prompt: input,
          stream: true
        }),
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line) continue;
          try {
            const json = JSON.parse(line);
            setMessages(prev => prev.map(msg => 
              msg.id === assistantMessageId 
                ? { 
                    ...msg, 
                    content: msg.content + json.response,
                    isStreaming: !json.done
                  }
                : msg
            ));
          } catch (e) {
            console.error('Error parsing JSON:', e);
          }
        }
      }
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, { 
        role: 'error', 
        content: 'Error: Make sure Ollama is running on port 11434',
        time: formatTime()
      }]);
    } finally {
      setIsLoading(false);
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId 
          ? { ...msg, isStreaming: false }
          : msg
      ));
      inputRef.current?.focus();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-100">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-6xl mx-auto w-full px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-gray-100">Ollama Chat</h1>
            <p className="text-sm text-gray-400">Connected to {model}</p>
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 rounded-lg hover:bg-gray-700 transition-colors"
            aria-label="Settings"
          >
            <Settings className="w-6 h-6 text-gray-300" />
          </button>
        </div>
      </header>

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-gray-800 border-b border-gray-700">
          <div className="max-w-6xl mx-auto w-full px-6 py-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Model:
            </label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter model name (e.g., deepseek-r1:32b)"
            />
          </div>
        </div>
      )}

      {/* Chat Messages */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto w-full px-6 py-6">
          <div className="space-y-6">
            {messages.map((msg, idx) => (
              <div
                key={msg.id || idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`flex gap-3 max-w-[85%] ${
                    msg.role === 'user'
                      ? 'bg-blue-600'
                      : msg.role === 'error'
                      ? 'bg-red-900'
                      : 'bg-gray-800'
                  } rounded-xl px-4 py-3 shadow-lg`}
                >
                  {msg.role !== 'user' && (
                    <div className="flex-shrink-0 mt-1">
                      <Bot className="w-5 h-5 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="prose prose-invert prose-sm max-w-none">
                      {msg.role === 'assistant' ? (
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm]}
                          components={{
                            pre: ({ children }) => (
                              <pre className="bg-gray-950 text-gray-100 p-4 rounded-lg overflow-auto mt-2">
                                {children}
                              </pre>
                            ),
                            code: ({ inline, children }) => (
                              inline ? (
                                <code className="bg-gray-700 px-1 rounded text-sm">
                                  {children}
                                </code>
                              ) : (
                                <code className="text-sm">{children}</code>
                              )
                            )
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      ) : (
                        <div className="whitespace-pre-wrap">
                          {msg.content}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs mt-2 text-gray-400">
                      <span>{msg.time}</span>
                      {msg.isStreaming && (
                        <span className="inline-block w-1 h-1 bg-blue-400 rounded-full animate-pulse"/>
                      )}
                    </div>
                  </div>
                  {msg.role === 'user' && (
                    <div className="flex-shrink-0 mt-1">
                      <User className="w-5 h-5 text-gray-300" />
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </main>

      {/* Input Form */}
      <footer className="bg-gray-800 border-t border-gray-700">
        <div className="max-w-6xl mx-auto w-full px-6 py-4">
          <form onSubmit={handleSubmit} className="flex gap-4 items-center">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 p-3 bg-gray-700 border border-gray-600 rounded-full text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading}
              className="p-3 rounded-full bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </form>
        </div>
      </footer>
    </div>
  );
}
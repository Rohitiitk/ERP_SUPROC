// src/components/Chatbot.tsx

import React, { useRef, useEffect } from 'react';
import { Send, X, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import fullrobot from '../assets/fullrobot.svg';

export interface Message {
  text: string;
  sender: 'user' | 'bot';
  // --- NEW: Add message type and optional parameters ---
  type?: 'text' | 'search_mode_prompt';
  product_name?: string;
}

interface ChatbotProps {
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  isLoading: boolean;
  userInput: string;
  setUserInput: React.Dispatch<React.SetStateAction<string>>;
  handleSendMessage: (e: React.FormEvent, messageOverride?: string) => Promise<void>;
}

// --- NEW: Search Mode Button Component ---
const SearchModeSelector = ({ productName, handleSendMessage }: { productName: string; handleSendMessage: (e: React.FormEvent, messageOverride?: string) => Promise<void>; }) => {
  const modes = [
    { label: "Quick", value: "quick", description: "Fast & Free" },
    { label: "Standard", value: "basic", description: "Balanced Detail" },
    { label: "Pro", value: "advanced", description: "Deeper Reach" },
  ];

  const onModeClick = (modeValue: string) => {
    // We send a specific message back to the AI that it's trained to understand
    const message = `The user selected the '${modeValue}' search mode for the product '${productName}'.`;
    handleSendMessage({} as React.FormEvent, message);
  };

  return (
    <div className="flex flex-col sm:flex-row gap-2 mt-2">
      {modes.map(mode => (
        <button
          key={mode.value}
          onClick={() => onModeClick(mode.value)}
          className="p-3 bg-white border border-gray-300 rounded-lg text-left hover:border-blue-500 hover:bg-blue-50 transition-all w-full"
        >
          <div className="font-semibold text-gray-800">{mode.label}</div>
          <div className="text-xs text-gray-500">{mode.description}</div>
        </button>
      ))}
    </div>
  );
};

const Chatbot: React.FC<ChatbotProps> = ({
  isOpen,
  onClose,
  messages,
  isLoading,
  userInput,
  setUserInput,
  handleSendMessage
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [messages, isOpen]);

  const handleFormSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!isLoading && userInput.trim()) {
          handleSendMessage(e);
      }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleFormSubmit(e as any);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-20 z-50 flex justify-center items-center backdrop-blur-[2px] p-4"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-2xl h-full max-h-[70vh] bg-white rounded-2xl shadow-2xl flex flex-col z-50 border border-gray-200 transform transition-all duration-300 ease-out animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b bg-gray-50 rounded-t-2xl flex-shrink-0">
          <div className="flex items-center gap-3">
            <img src={fullrobot} alt="AI Assistant" className="h-10 w-10" />
            <div>
              <h3 className="font-bold text-gray-800">AI Assistant</h3>
              <p className="text-xs text-green-500 font-semibold">Online</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="flex-grow p-4 overflow-y-auto bg-gray-100">
          <div className="space-y-4">
            {messages.map((msg, index) => (
              <div key={index} className={`flex items-end gap-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.sender === 'bot' && <img src={fullrobot} alt="Bot" className="w-6 h-6 rounded-full flex-shrink-0" />}
                <div className={`prose prose-sm max-w-xs md:max-w-md lg:max-w-lg px-4 py-2 rounded-2xl ${msg.sender === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white text-gray-800 border rounded-bl-none'}`}>
                  {(isLoading && index === messages.length - 1 && !msg.text)
                    ? <div className="flex justify-center items-center h-6"><Loader2 className="animate-spin text-gray-500" size={16} /></div>
                    : (
                        <>
                          <ReactMarkdown>{msg.text}</ReactMarkdown>
                          {/* Render the search mode buttons if the message type is correct */}
                          {msg.type === 'search_mode_prompt' && msg.product_name && (
                            <SearchModeSelector productName={msg.product_name} handleSendMessage={handleSendMessage} />
                          )}
                        </>
                      )
                  }
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <form onSubmit={handleFormSubmit} className="p-4 border-t bg-white rounded-b-2xl flex-shrink-0">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask me anything..."
              className="w-full py-2 pl-4 pr-12 text-sm text-gray-800 bg-gray-100 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:bg-gray-400 transition-all duration-200 transform hover:scale-110 active:scale-95"
              disabled={isLoading || !userInput.trim()}
            >
              <Send size={16} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Chatbot;
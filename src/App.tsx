// =================================
// File: src/App.tsx
// =================================
import { useState, useEffect, useCallback, useRef } from 'react';
import { BrowserRouter as Router, Route, Routes, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { Session as AuthSession } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';

import Landing from './pages/Landing';              // <-- consolidated landing page
import DiscoverAI from './pages/DiscoverAI';
import SelectCountry from './pages/SelectCountry';
import Results from './pages/Results';
import RFQ from './pages/RFQ';
import Bidding from './pages/Bidding';
import MyProjects from './pages/MyProjects';
import ProjectBids from './pages/ProjectBids';
import MyBids from './pages/MyBids';
import BiddingDetails from './pages/BiddingDetails';
import RFP from './pages/RFP';
import Profile from './pages/Profile2';
import SupplierRegistration from './pages/SupplierRegistration';
import AuthPage from './pages/Auth/AuthPage';
import SignUpPage from './pages/Auth/SignUpPage';
import ForgotPassword from './pages/Auth/ForgotPassword';
import ResetPassword from './pages/Auth/ResetPassword';
import ERPDashboard from '@erp';
import { Home } from '@erp';
import SupLinks from './pages/SupLinks';
import EnhanceProfile from './pages/EnhanceProfile';
import SourcingHub from './pages/SourcingHub';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import Loader from './components/Loader';
import Chatbot, { Message } from './components/Chatbot';
import OAuthCallback from './pages/Auth/OAuthCallback';

interface BotAction {
  action: 'navigate';
  parameters: {
    path?: string;
    message: string;
  };
}

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
}

const DeleteConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-2 text-gray-800">Delete Chat</h3>
        <p className="text-sm text-gray-600 mb-6">
          Are you sure you want to permanently delete this chat history? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 rounded-md text-sm font-medium hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

function AppContent({ session }: { session: AuthSession | null }) {
  const location = useLocation();
  const navigate = useNavigate();
  const routeKey = location.pathname;
  const sessionWarningShownRef = useRef(false);

  const clearCookie = useCallback((name: string) => {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax`;
  }, []);

  useEffect(() => {
    if (!session?.user) {
      clearCookie('versatileErpUserId');
      sessionWarningShownRef.current = false;
      return;
    }

    // Keep the existing workspace cookie so users can reconnect to the same ERP even across accounts.
  }, [session, clearCookie]);

  useEffect(() => {
    const sensitiveRoutes = ['/workspace', '/erp'];
    const requiresSessionCheck = sensitiveRoutes.some((route) => location.pathname.startsWith(route));

    if (!requiresSessionCheck) {
      sessionWarningShownRef.current = false;
      return undefined;
    }

    let cancelled = false;
    const checkSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.error('Session check failed:', error);
        return;
      }
      if (!cancelled) {
        if (!data.session && !sessionWarningShownRef.current) {
          sessionWarningShownRef.current = true;
          alert('Your session expired. Please sign in again.');
          navigate('/login');
        }
        if (data.session) {
          sessionWarningShownRef.current = false;
        }
      }
    };

    checkSession();
    const intervalId = window.setInterval(checkSession, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [navigate, location.pathname]);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { sender: 'bot', text: 'Hello! How can I help you?', type: 'text' },
  ]);
  const [userInput, setUserInput] = useState('');

  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatSession[]>([]);

  const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);

  const getAuthToken = async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token;
  };

  const fetchChatHistory = useCallback(async () => {
    if (!session) return;
    const token = await getAuthToken();
    try {
      const response = await fetch('/api/chat/sessions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setChatHistory(data);
      }
    } catch (error) {
      console.error('Failed to fetch chat history:', error);
    }
  }, [session]);

  useEffect(() => {
    fetchChatHistory();
  }, [fetchChatHistory]);

  const startNewChat = async () => {
    const token = await getAuthToken();
    try {
      const response = await fetch('/api/chat/sessions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const newSession = await response.json();
        setCurrentSessionId(newSession.id);
        setMessages([{ sender: 'bot', text: 'Hello! How can I assist you with this new chat?', type: 'text' }]);
        setIsChatOpen(true);
        setChatHistory((prev) => [newSession, ...prev]);
      }
    } catch (error) {
      console.error('Failed to start new chat:', error);
    }
  };

  const loadChatSession = async (sessionId: string) => {
    if (sessionId === currentSessionId && isChatOpen) return;
    const token = await getAuthToken();
    setIsLoading(true);
    try {
      const response = await fetch(`/api/chat/sessions/${sessionId}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const pastMessages = await response.json();
        setCurrentSessionId(sessionId);
        setMessages(
          pastMessages.length > 0
            ? pastMessages
            : [{ sender: 'bot', text: 'Resuming conversation. How can I help?', type: 'text' }]
        );
        setIsChatOpen(true);
      }
    } catch (error) {
      console.error('Failed to load chat session:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRenameChat = async (sessionId: string, newTitle: string) => {
    const token = await getAuthToken();
    try {
      const response = await fetch(`/api/chat/sessions/${sessionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: newTitle }),
      });

      if (response.ok) {
        setChatHistory((prev) =>
          prev.map((session) => (session.id === sessionId ? { ...session, title: newTitle } : session))
        );
      }
    } catch (error) {
      console.error('Failed to rename chat:', error);
    }
  };

  const handleDeleteChat = (sessionId: string) => {
    setSessionToDelete(sessionId);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!sessionToDelete) return;
    const token = await getAuthToken();
    try {
      const response = await fetch(`/api/chat/sessions/${sessionToDelete}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        setChatHistory((prev) => prev.filter((session) => session.id !== sessionToDelete));
        if (currentSessionId === sessionToDelete) {
          setCurrentSessionId(null);
          setMessages([{ sender: 'bot', text: 'Hello! How can I help you?', type: 'text' }]);
        }
      }
    } catch (error) {
      console.error('Failed to delete chat:', error);
    } finally {
      setDeleteModalOpen(false);
      setSessionToDelete(null);
    }
  };

  const handleSendMessage = async (e: React.FormEvent, messageOverride?: string) => {
    if (e && typeof (e as any).preventDefault === 'function') { (e as any).preventDefault(); }
    const messageToSend = messageOverride || userInput.trim();
    if (!messageToSend) return;

    const newUserMessage: Message = { sender: 'user', text: messageToSend, type: 'text' };

    if (!messageOverride) {
      setMessages((prev) => [...prev, newUserMessage, { sender: 'bot', text: '', type: 'text' }]);
    } else {
      setMessages((prev) => [...prev, { sender: 'bot', text: '', type: 'text' }]);
    }

    setUserInput('');
    setIsLoading(true);

    let sessionId = currentSessionId;
    if (!sessionId) {
      const token = await getAuthToken();
      const response = await fetch('/api/chat/sessions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const newSession = await response.json();
        sessionId = newSession.id;
        setCurrentSessionId(newSession.id);
        setChatHistory((prev) => [newSession, ...prev]);
      } else {
        console.error('Failed to auto-start new chat session.');
        setIsLoading(false);
        return;
      }
    }

    try {
      const token = await getAuthToken();
      const response = await fetch('/api/chatbot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: messageToSend, sessionId: sessionId }),
      });

      if (!messageOverride) { fetchChatHistory(); }

      if (!response.ok) throw new Error('Network response was not ok');
      const contentType = response.headers.get('content-type');

      if (contentType && contentType.includes('application/json')) {
        const data = JSON.parse(await response.text());

        if (data.action === 'ask_search_mode') {
          const botMessage: Message = {
            sender: 'bot',
            text: data.parameters.message,
            type: 'search_mode_prompt',
            product_name: data.parameters.product_name,
          };
          setMessages((prev) => [...prev.slice(0, -1), botMessage]);
        } else if (data.action === 'navigate') {
          const updatedLastMessage: Message = { sender: 'bot', text: data.parameters.message, type: 'text' };
          setMessages((prev) => [...prev.slice(0, -1), updatedLastMessage]);
          if (data.parameters.path) {
            navigate(data.parameters.path);
            setIsChatOpen(false);
          }
        }
      } else {
        const reader = response.body?.getReader();
        if (!reader) throw new Error('Failed to get response reader');

        const decoder = new TextDecoder();
        let fullBotResponse = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          if (chunk) {
            fullBotResponse += chunk;
            setMessages((prev) => {
              const lastMessage = prev[prev.length - 1];
              const updatedLastMessage = { ...lastMessage, text: fullBotResponse };
              return [...prev.slice(0, -1), updatedLastMessage];
            });
          }
        }
      }
    } catch (error) {
      console.error('Error fetching chatbot response:', error);
      const errorBotMessage: Message = { sender: 'bot', text: 'Sorry, something went wrong.', type: 'text' };
      setMessages((prev) => [...prev.slice(0, -1), errorBotMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Hide sidebar Navbar on auth pages and on landing page
  const noNavRoutes = ['/', '/login', '/signup', '/forgot-password', '/reset-password', '/workspace'];
  const showNav = session && !noNavRoutes.includes(location.pathname);

  return (
    <div className={showNav ? 'flex' : ''}>
      {showNav && (
        <Navbar
          onChatToggle={() => setIsChatOpen(!isChatOpen)}
          chatHistory={chatHistory}
          onStartNewChat={startNewChat}
          onLoadChat={loadChatSession}
          onRenameChat={handleRenameChat}
          onDeleteChat={handleDeleteChat}
        />
      )}
      <main key={routeKey} className={showNav ? 'flex-grow pt-16 sm:pt-0 sm:pl-20' : 'flex-grow'}>
        <Routes>
          {/* Smart index route:
               - not signed in -> Landing
               - signed in     -> redirect to /discover */}
          <Route
            path="/"
            element={session ? <Navigate to="/discover" replace /> : <Landing />}
          />

          {/* Public / Auth */}
          <Route path="/login" element={<AuthPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/auth/callback" element={<OAuthCallback />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Public product pages (Discover is reachable directly) */}
          <Route path="/discover" element={<DiscoverAI session={session} />} />
          <Route path="/bidding" element={<Bidding session={session} />} />

          {/* Protected */}
          <Route element={<ProtectedRoute session={session} />}>
            <Route path="/suplinks" element={<SupLinks />} />
            <Route path="/select-country" element={<SelectCountry />} />
            <Route path="/results" element={<Results />} />
            <Route path="/rfq" element={<RFQ />} />
            <Route path="/rfp" element={<RFP />} />
            <Route path="/bidding/:projectId" element={<BiddingDetails session={session} />} />
            <Route path="/my-projects" element={<MyProjects />} />
            <Route path="/my-projects/:projectId/bids" element={<ProjectBids />} />
            <Route path="/my-bids" element={<MyBids />} />
            <Route path="/sourcing/:projectId" element={<SourcingHub />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/supplier-registration" element={<SupplierRegistration />} />
            <Route path="/enhance-profile" element={<EnhanceProfile />} />
            <Route path="/erp" element={<Home />} />
            <Route path="/workspace" element={<ERPDashboard />} />
          </Route>
        </Routes>
      </main>
      <Chatbot
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        messages={messages}
        isLoading={isLoading}
        userInput={userInput}
        setUserInput={setUserInput}
        handleSendMessage={handleSendMessage}
      />
      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function App() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.startAutoRefresh();
    return () => {
      supabase.auth.stopAutoRefresh();
    };
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen"><Loader /></div>
    );
  }

  return (
    <Router>
      <AppContent session={session} />
    </Router>
  );
}

export default App;

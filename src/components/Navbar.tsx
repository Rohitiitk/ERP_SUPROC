import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, FileText, Menu, X, Briefcase, ChevronDown, MoreVertical, Edit, Trash2, History } from 'lucide-react';
import { supabase } from '../supabaseClient';

import iconLogo from '../assets/logo.png';
import fullLogo from '../assets/fullLogo.png';
import Discovericon from '../assets/DiscoverAIicon.svg';
import biddingicon from '../assets/biddingicon.svg';
import rfqicon from '../assets/rfqicon.svg';
import robot from '../assets/robot.svg';
import fullrobot from '../assets/fullrobot.svg';
import profileicon from '../assets/profileicon.svg';

const SupLinksIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" className="w-6 h-6" fill="currentColor">
    <path d="M96 96C60.7 96 32 124.7 32 160L32 480C32 515.3 60.7 544 96 544L544 544C579.3 544 608 515.3 608 480L608 160C608 124.7 579.3 96 544 96L96 96zM176 352L240 352C284.2 352 320 387.8 320 432C320 440.8 312.8 448 304 448L112 448C103.2 448 96 440.8 96 432C96 387.8 131.8 352 176 352zM152 256C152 225.1 177.1 200 208 200C238.9 200 264 225.1 264 256C264 286.9 238.9 312 208 312C177.1 312 152 286.9 152 256zM392 208L504 208C517.3 208 528 218.7 528 232C528 245.3 517.3 256 504 256L392 256C378.7 256 368 245.3 368 232C368 218.7 378.7 208 392 208zM392 304L504 304C517.3 304 528 314.7 528 328C528 341.3 517.3 352 504 352L392 352C378.7 352 368 341.3 368 328C368 314.7 378.7 304 392 304z"/>
  </svg>
);

interface ChatSession {
  id: string;
  title: string;
}

interface NavbarProps {
  onChatToggle?: () => void;
  chatHistory?: ChatSession[];
  onStartNewChat?: () => void;
  onLoadChat?: (sessionId: string) => void;
  onRenameChat?: (sessionId: string, newTitle: string) => void;
  onDeleteChat?: (sessionId: string) => void;
}

const Navbar: React.FC<NavbarProps> = ({ 
    onChatToggle = () => {}, 
    chatHistory = [], 
    onStartNewChat = () => {}, 
    onLoadChat = () => {},
    onRenameChat = () => {},
    onDeleteChat = () => {}
}) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(true);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [isRenameModalOpen, setRenameModalOpen] = useState(false);
  const [sessionToRename, setSessionToRename] = useState<ChatSession | null>(null);
  const [newTitle, setNewTitle] = useState("");

  const location = useLocation();
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDrawerOpen(false);
  }, [location]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) console.error('Error logging out:', error);
    else navigate('/');
  };

  const openRenameModal = (session: ChatSession) => {
    setSessionToRename(session);
    setNewTitle(session.title);
    setRenameModalOpen(true);
    setActiveMenuId(null);
  };

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (sessionToRename && newTitle.trim()) {
      onRenameChat(sessionToRename.id, newTitle.trim());
      setRenameModalOpen(false);
    }
  };

  const showSidebarChatbot = !['/erp', '/workspace'].includes(location.pathname);

  return (
    <>
      <div className="sm:hidden fixed top-4 left-4 z-50">
        <button onClick={() => setDrawerOpen(true)} className="p-2 bg-white rounded-md shadow-md focus:outline-none"><Menu size={24} /></button>
      </div>

      <div
        className={`fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-300 ${drawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setDrawerOpen(false)}
      />

      <aside
        className={`group fixed inset-y-0 left-0 z-50 flex flex-col bg-white shadow-md transition-all duration-300 ease-in-out transform ${drawerOpen ? 'translate-x-0' : '-translate-x-full'} sm:transform-none w-64 sm:w-20 sm:hover:w-64 overflow-y-auto rounded-r-3xl`}
      >
        <div className="flex flex-col flex-grow py-6">
          <div className="sm:hidden flex justify-end p-4 flex-shrink-0">
            <button onClick={() => setDrawerOpen(false)} className="p-2 focus:outline-none"><X size={24} /></button>
          </div>
          
          <div className="sm:hidden flex justify-center items-center h-12 mb-6 px-4 flex-shrink-0">
              <img src={fullLogo} alt="Suproc Logo" className="h-8" />
          </div>
          <div className="hidden sm:flex justify-center items-center h-8 mb-10 flex-shrink-0">
              <img src={iconLogo} alt="Suproc Icon" className="h-8 group-hover:hidden" />
              <img src={fullLogo} alt="Suproc Full Logo" className="h-8 hidden group-hover:inline transition-opacity" />
          </div>

          <nav className="flex-grow flex flex-col gap-3 px-2 overflow-y-auto">
            <SidebarItem icon={<img src={Discovericon} alt="" className="w-6 h-6" />} label="Discover AI" to="/" drawerOpen={drawerOpen} />
            <SidebarItem icon={<SupLinksIcon />} label="SupLinks" to="/suplinks" drawerOpen={drawerOpen} />
            <SidebarItem icon={<Briefcase size={24} />} label="ERP" to="/erp" drawerOpen={drawerOpen} />
            <SidebarItem icon={<img src={rfqicon} alt="" className="w-6 h-6" />} label="RFQ" to="/rfq" drawerOpen={drawerOpen} />
            <SidebarItem icon={<img src={biddingicon} alt="" className="w-6 h-6" />} label="Bidding Page" to="/bidding" drawerOpen={drawerOpen} />
            <SidebarItem icon={<FileText size={24} />} label="RFP" to="/rfp" drawerOpen={drawerOpen} />
            
            <div>
              <SidebarItem 
                icon={<History size={24} />} 
                label="Chat History" 
                onClick={() => setIsHistoryOpen(!isHistoryOpen)} 
                drawerOpen={drawerOpen}
                endIcon={
                  <ChevronDown size={16} className={`transition-transform ${isHistoryOpen ? 'rotate-180' : ''}`} />
                }
              />
              
              {isHistoryOpen && chatHistory.length > 0 && (
                <div className={`mt-1 ml-6 pl-4 border-l-2 border-gray-200 ${drawerOpen ? '' : 'sm:group-hover:block hidden'}`}>
                  {chatHistory.slice(0, 5).map((session) => (
                    <div key={session.id} className="group/item relative flex items-center w-full text-left text-sm text-gray-700 hover:bg-gray-100 rounded-md">
                      <button onClick={() => onLoadChat(session.id)} className="flex-grow text-left py-2 pl-2 pr-8 truncate">
                        <span className="whitespace-nowrap">{session.title}</span>
                      </button>
                      <button onClick={() => setActiveMenuId(session.id === activeMenuId ? null : session.id)} className={`absolute right-1 top-1/2 -translate-y-1/2 flex-shrink-0 p-1 rounded-full hover:bg-gray-200 opacity-0 group-hover/item:opacity-100 transition-opacity`}>
                        <MoreVertical size={16} />
                      </button>
                      {activeMenuId === session.id && (
                        <div ref={menuRef} className="absolute right-0 bottom-full mb-1 w-28 bg-white border rounded-md shadow-lg z-10">
                          <button onClick={() => openRenameModal(session)} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-gray-100"><Edit size={14} /> Rename</button>
                          <button onClick={() => { onDeleteChat(session.id); setActiveMenuId(null); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left text-red-600 hover:bg-gray-100"><Trash2 size={14} /> Delete</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </nav>
        </div>

        <div className="flex flex-col px-4 mb-4 pt-4 flex-shrink-0">
          <button onClick={onChatToggle} className="my-4 flex justify-center items-center h-12 group focus:outline-none w-full">
            <img src={robot} alt="AI Assistant Icon" className="h-12 group-hover:hidden" />
            <img src={fullrobot} alt="AI Assistant" className="hidden h-20 group-hover:block opacity-0 group-hover:opacity-100 hover:scale-125 cursor-pointer" />
          </button>
          <nav className="flex flex-col gap-3">
            <SidebarItem icon={<img src={profileicon} alt="" className="w-6 h-6" />} label="Profile" to="/profile" drawerOpen={drawerOpen} />
            <SidebarItem icon={<LogOut size={24} />} label="Logout" onClick={handleLogout} drawerOpen={drawerOpen} />
          </nav>
        </div>
      </aside>

      {isRenameModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-30 z-50 flex justify-center items-center p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-medium mb-4">Rename Chat</h3>
            <form onSubmit={handleRenameSubmit}>
              <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" autoFocus />
              <div className="flex justify-end gap-3 mt-4">
                <button type="button" onClick={() => setRenameModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded-md text-sm hover:bg-gray-300">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

const SidebarItem = ({ icon, label, to, onClick, drawerOpen = false, endIcon }: { icon: React.ReactNode; label: string; to?: string; onClick?: () => void; drawerOpen?: boolean; endIcon?: React.ReactNode; }) => {
  const commonClasses = `flex items-center text-ellipsis overflow-hidden ${drawerOpen ? 'justify-start' : 'justify-center sm:group-hover:justify-start'} w-full gap-3 px-4 py-2 text-sm transition-colors rounded-md border-l-4 border-transparent text-gray-700 hover:bg-gray-100 hover:text-gray-900`;
  const content = (
    <>
      <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center">{icon}</span>
      <span className={`whitespace-nowrap ml-3 ${drawerOpen ? 'inline' : 'hidden'} sm:group-hover:inline`}>{label}</span>
      {endIcon && <span className={`ml-auto ${drawerOpen ? 'inline' : 'hidden'} sm:group-hover:inline`}>{endIcon}</span>}
    </>
  );

  if (to) {
    return <NavLink to={to} className={({ isActive }) => `${commonClasses} ${isActive ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold' : ''}`}>{content}</NavLink>;
  }
  return <button onClick={onClick} className={commonClasses}>{content}</button>;
};

export default Navbar;

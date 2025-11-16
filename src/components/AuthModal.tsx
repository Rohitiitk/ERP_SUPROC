import React from 'react';
import { useNavigate } from 'react-router-dom';
import fullLogo from '../assets/fullLogo.png'; // Using your existing logo

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleLogin = () => {
    onClose();
    navigate('/login');
  };

  const handleSignUp = () => {
    onClose();
    navigate('/signup');
  };

  return (
    // Backdrop with blur
    <div 
      className="fixed inset-0 bg-black bg-opacity-20 z-50 flex justify-center items-center backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Modal Container with entrance animation and border */}
      <div
        className="bg-white text-gray-800 rounded-2xl shadow-2xl p-8 max-w-xs w-full text-center transform transition-all animate-fade-in-up border border-gray-200"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal
      >
        <img src={fullLogo} alt="Logo" className="h-10 mx-auto mb-5" />
        
        <h2 className="text-lg font-medium text-gray-700 mb-6">
          To continue, please log in
        </h2>
        
        {/* Buttons are now more interactive */}
        <div className="flex justify-center items-center gap-4">
           <button
            onClick={handleSignUp}
            className="flex-1 bg-gray-100 text-gray-800 font-semibold py-2 px-4 rounded-full hover:bg-gray-200 transition-all duration-200 transform hover:scale-105 active:scale-100"
          >
            Sign Up
          </button>
          <button
            onClick={handleLogin}
            className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-semibold py-2 px-4 rounded-full hover:shadow-lg hover:from-blue-700 hover:to-blue-600 transition-all duration-200 shadow-md transform hover:scale-105 active:scale-100"
          >
            Log In
          </button>
        </div>
      </div>
      {/* Animation styles */}
      <style>{`
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default AuthModal;

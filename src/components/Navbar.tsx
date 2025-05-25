import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Shield, LogOut, LogIn, UserPlus, Copy } from "lucide-react";

const Navbar: React.FC = () => {
  const { user, logout } = useAuth(); // Dynamically fetch user and publicKey from context
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState<string | null>(null);
  const [isPublicKeyCopied, setIsPublicKeyCopied] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMessage('Copied!');
    setIsPublicKeyCopied(true);
    setTimeout(() => {
      setCopiedMessage(null);
      setIsPublicKeyCopied(false);
    }, 2000);
  };

  const handleLogout = () => {
    logout();
    navigate("/signin");
  };

  return (
    <nav className="bg-indigo-600 text-white shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center py-4">
          <Link to="/" className="flex items-center space-x-2">
            <Shield className="h-8 w-8" />
            <span className="text-xl font-bold">
              Secure Encrypted File Transfer
            </span>
          </Link>
          {/* Hamburger for mobile */}
          <button
            className="md:hidden flex items-center ml-2 focus:outline-none"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label="Toggle menu"
          >
            <svg
              className="h-7 w-7"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
          {/* Desktop menu */}
          <div className="hidden md:flex items-center space-x-4">
            {user ? (
              <>
                {user.publicKey && (
                  <div className="flex items-center space-x-2">
                    <span className="text-sm">Your Public Key:</span>
                    <span className="hidden md:inline text-sm bg-indigo-700 px-2 py-1 rounded-md overflow-hidden whitespace-nowrap text-ellipsis w-40">
                      {user.publicKey}
                    </span>
                    {user.publicKey && (
                      <button
                        onClick={() => copyToClipboard(user.publicKey || '')}
                        className={`ml-2 ${isPublicKeyCopied ? 'text-green-400' : 'text-indigo-200 hover:text-white'} focus:outline-none`}
                        title="Copy public key"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )}
                <span className="hidden md:inline">Welcome, {user.name}</span>
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-1 bg-indigo-700 hover:bg-indigo-800 px-4 py-2 rounded-md transition-colors"
                >
                  <LogOut className="h-5 w-5" />
                  <span>Logout</span>
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/signin"
                  className="flex items-center space-x-1 bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-md transition-colors"
                >
                  <LogIn className="h-5 w-5" />
                  <span>Sign In</span>
                </Link>
                <Link
                  to="/signup"
                  className="flex items-center space-x-1 bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-md transition-colors"
                >
                  <UserPlus className="h-5 w-5" />
                  <span>Sign Up</span>
                </Link>
              </>
            )}
          </div>
        </div>
        {/* Mobile menu dropdown */}
        {menuOpen && (
          <div className="md:hidden pb-4 animate-fade-in">
            <div className="flex flex-col space-y-2">
              {user ? (
                <>
                  {/* Hide public key and welcome on mobile for space */}
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      handleLogout();
                    }}
                    className="flex items-center space-x-1 bg-indigo-700 hover:bg-indigo-800 px-4 py-2 rounded-md transition-colors w-full justify-center"
                  >
                    <LogOut className="h-5 w-5" />
                    <span>Logout</span>
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/signin"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center space-x-1 bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-md transition-colors w-full justify-center"
                  >
                    <LogIn className="h-5 w-5" />
                    <span>Sign In</span>
                  </Link>
                  <Link
                    to="/signup"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center space-x-1 bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-md transition-colors w-full justify-center"
                  >
                    <UserPlus className="h-5 w-5" />
                    <span>Sign Up</span>
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;

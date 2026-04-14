import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getVistaStatus, logout } from '../../services/adminService';
import { setSessionToken } from '../../services/api';
import SessionTimerDisplay from '../shared/SessionTimerDisplay';

export default function SystemBar({ breadcrumb = '' }) {
  const navigate = useNavigate();
  const [userName, setUserName] = useState('');
  const [vistaConnected, setVistaConnected] = useState(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userRef = useRef(null);

  useEffect(() => {
    // S5.1: Session token is in httpOnly cookie — check auth by calling API
    getVistaStatus().then(res => {
      if (res?.currentUser?.userName) setUserName(res.currentUser.userName);
      setVistaConnected(res?.connected !== false);
    }).catch(() => { setVistaConnected(false); });

    const interval = setInterval(() => {
      getVistaStatus().then(res => {
        setVistaConnected(res?.connected !== false);
      }).catch(() => { setVistaConnected(false); });
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (userRef.current && !userRef.current.contains(e.target)) setShowUserMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error('Logout request failed during sign-out:', err);
    }
    setSessionToken(null);
    navigate('/login');
  };

  const isSandbox = vistaConnected && userName?.includes('PRO');

  return (
    <header data-systembar className="fixed top-0 left-0 right-0 h-10 bg-navy flex items-center px-4 z-50">
      <span className="text-white font-semibold text-sm tracking-wide mr-4">
        VistA Evolved
      </span>

      {isSandbox && (
        <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded bg-[#E6A817] text-[#1A1A2E] mr-2">
          Sandbox
        </span>
      )}

      {breadcrumb && (
        <>
          <span className="text-white/30 mx-2">|</span>
          <span className="text-white/70 text-xs uppercase tracking-wider">
            {breadcrumb}
          </span>
        </>
      )}

      <div className="flex-1" />

      <div className="mr-2 sm:mr-4 min-w-0 truncate max-w-[120px] sm:max-w-none">
        <SessionTimerDisplay />
      </div>

      {vistaConnected !== null && (
        <div className="flex items-center gap-1.5 mr-4 text-[11px]" title={vistaConnected ? 'VistA Connected' : 'VistA Disconnected'}>
          <div className={`w-2 h-2 rounded-full ${vistaConnected ? 'bg-green-400' : 'bg-red-500 animate-pulse'}`} />
          <span className={vistaConnected ? 'text-green-300' : 'text-red-300'}>
            {vistaConnected ? 'VistA' : 'VistA Offline'}
          </span>
        </div>
      )}

      {/* User menu */}
      <div className="relative" ref={userRef}>
        <button
          onClick={() => setShowUserMenu(!showUserMenu)}
          className="flex items-center gap-2 ml-3 text-white/80 hover:text-white transition-colors"
        >
          <div className="w-7 h-7 rounded-full bg-steel flex items-center justify-center text-[11px] font-semibold text-white">
            {userName.charAt(0) || 'U'}
          </div>
          <span className="text-xs font-medium hidden sm:inline">{userName || 'User'}</span>
          <span className="material-symbols-outlined text-[16px]">expand_more</span>
        </button>
        {showUserMenu && (
          <div className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg border border-[#E2E4E8] z-50 py-1">
            <div className="px-3 py-2 text-xs text-[#999] border-b border-[#E2E4E8]">
              Signed in as <span className="font-medium text-[#222]">{userName}</span>
            </div>
            <button onClick={handleLogout} className="w-full text-left px-3 py-2 text-xs text-[#CC3333] hover:bg-[#FDE8E8]">
              <span className="material-symbols-outlined text-[14px] mr-1.5 align-middle">logout</span>
              Sign Out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

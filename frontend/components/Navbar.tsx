'use client';

import React, { useEffect } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { Activity, Wifi, WifiOff, RefreshCw, Menu } from 'lucide-react';

export default function Navbar() {
  const { backendOnline, isCheckingStatus, checkBackendStatus } = useProjectStore();

  useEffect(() => {
    // Check backend connection on mount
    checkBackendStatus();
    
    // Periodically ping health status every 8 seconds
    const interval = setInterval(() => {
      checkBackendStatus();
    }, 8000);
    
    return () => clearInterval(interval);
  }, [checkBackendStatus]);

  return (
    <>
      {/* Google Teachable Machine Floating Brand Tab (Top-Left) */}
      <div className="absolute top-0 left-0 bg-white border-r border-b border-[#dadce0] rounded-br-2xl shadow-[0_2px_8px_rgba(0,0,0,0.06)] px-6 py-3.5 z-50 flex items-center gap-3">
        <button className="p-1.5 hover:bg-slate-100 rounded-full transition text-[#5f6368]" title="Menu">
          <Menu className="h-5 w-5" />
        </button>
        <span className="text-xl font-bold tracking-tight text-[var(--brand)] select-none font-sans flex items-center gap-1.5">
          OutfitLens
        </span>
      </div>

      {/* Floating ML Server Connection Pill (Top-Right) */}
      <div className="absolute top-4 right-4 z-40 flex items-center gap-2">
        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-[#dadce0] shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
          {isCheckingStatus ? (
            <>
              <RefreshCw className="h-3 w-3 animate-spin text-[#1a73e8]" />
              <span className="text-[10px] text-[#5f6368] font-bold uppercase tracking-wider">Connecting...</span>
            </>
          ) : backendOnline ? (
            <>
              <div className="h-2 w-2 rounded-full bg-[#0f9d58] animate-pulse" />
              <span className="text-[10px] font-bold text-[#0f9d58] uppercase tracking-wider flex items-center gap-1">
                <Wifi className="h-3.5 w-3.5" />
                Active Server
              </span>
            </>
          ) : (
            <>
              <div className="h-2 w-2 rounded-full bg-[#db4437] animate-pulse" />
              <span className="text-[10px] font-bold text-[#db4437] uppercase tracking-wider flex items-center gap-1">
                <WifiOff className="h-3.5 w-3.5" />
                Offline
              </span>
              <button
                onClick={() => checkBackendStatus()}
                className="ml-0.5 p-0.5 hover:bg-slate-200 rounded-full transition text-[#5f6368]"
                title="Reconnect to server"
              >
                <RefreshCw className="h-3 w-3" />
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

'use client';

import { useState } from 'react';

interface TopBarProps {
  isConnected: boolean;
  browserState: { isRunning: boolean; currentUrl: string | null; currentTitle: string | null };
  mode: 'auto' | 'step' | 'manual';
  onModeChange: (mode: 'auto' | 'step' | 'manual') => void;
  onToggleLogs: () => void;
  onToggleTheme: () => void;
  theme: 'dark' | 'light';
  isLoading: boolean;
}

export default function TopBar({ isConnected, browserState, mode, onModeChange, onToggleLogs, onToggleTheme, theme, isLoading }: TopBarProps) {
  return (
    <div className="top-bar">
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 140 }}>
        <div style={{ width: 28, height: 28, background: 'linear-gradient(135deg, #6366f1, #7c3aed)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="white" fillOpacity="0.9" />
            <path d="M2 17L12 22L22 17" stroke="white" strokeOpacity="0.6" strokeWidth="2" strokeLinecap="round" />
            <path d="M2 12L12 17L22 12" stroke="white" strokeOpacity="0.8" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: -0.5, background: 'linear-gradient(135deg, var(--text-primary), var(--accent))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          BrowserPilot
        </span>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 20, background: 'var(--border)' }} />

      {/* Status indicators */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span className={`status-dot ${isConnected ? 'status-dot-active' : 'status-dot-inactive'}`} />
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>
            {isConnected ? 'Live' : 'Offline'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span className={`status-dot ${browserState.isRunning ? 'status-dot-active' : 'status-dot-inactive'}`} />
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>
            {browserState.isRunning ? 'Browser' : 'Idle'}
          </span>
        </div>
      </div>

      {/* Current URL */}
      <div style={{ flex: 1, overflow: 'hidden', margin: '0 8px' }}>
        {browserState.currentUrl && (
          <div style={{ fontSize: 11, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', background: 'var(--bg-elevated)', padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
            {browserState.currentUrl}
          </div>
        )}
      </div>

      {/* Loading spinner */}
      {isLoading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div className="animate-spin" style={{ width: 12, height: 12, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%' }} />
          <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 500 }}>Working</span>
        </div>
      )}

      {/* Mode selector */}
      <div className="tab-group" style={{ marginBottom: 0, padding: 2, gap: 1 }}>
        {(['manual', 'step', 'auto'] as const).map((m) => (
          <button key={m} onClick={() => onModeChange(m)} className={`tab-btn ${mode === m ? 'active' : ''}`}
            style={{ padding: '4px 10px', fontSize: 10, minWidth: 50 }}>
            {m}
          </button>
        ))}
      </div>

      {/* Theme toggle */}
      <button className="btn btn-ghost btn-icon" onClick={onToggleTheme} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
        {theme === 'dark' ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
        )}
      </button>

      {/* Logs toggle */}
      <button className="btn btn-ghost btn-sm" onClick={onToggleLogs}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14,2 14,8 20,8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
        </svg>
        Logs
      </button>
    </div>
  );
}

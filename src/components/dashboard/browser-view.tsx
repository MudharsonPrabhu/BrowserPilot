'use client';

import { useState } from 'react';

interface BrowserViewProps {
  screenshotUrl: string | null;
  isRunning: boolean;
  currentUrl: string | null;
  onStartSession: (profileName?: string) => Promise<void>;
  onNavigate: (url: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export default function BrowserView({
  screenshotUrl, isRunning, currentUrl, onStartSession, onNavigate, onRefresh, isLoading, error,
}: BrowserViewProps) {
  const [urlInput, setUrlInput] = useState('');

  const handleNavigate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    let url = urlInput.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;
    onNavigate(url);
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* URL bar */}
      {isRunning && (
        <div style={{
          padding: '6px 12px', display: 'flex', gap: 6, alignItems: 'center',
          borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)',
        }}>
          <button className="btn btn-ghost btn-icon" onClick={onRefresh} title="Refresh">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 4v6h-6M1 20v-6h6" /><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
            </svg>
          </button>
          <form onSubmit={handleNavigate} style={{ flex: 1, display: 'flex', gap: 6 }}>
            <input className="input" type="text" placeholder="Enter URL or search..." value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)} style={{ flex: 1, padding: '6px 12px', fontSize: 12, borderRadius: 8, background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }} />
            <button className="btn btn-primary btn-sm" type="submit" disabled={isLoading}>→</button>
          </form>
        </div>
      )}

      {/* Browser frame */}
      <div className="browser-frame">
        {!isRunning ? (
          <div className="animate-slide-up" style={{ textAlign: 'center', padding: 48, maxWidth: 400 }}>
            {/* Hero icon */}
            <div style={{ marginBottom: 28, position: 'relative', display: 'inline-block' }}>
              <div style={{ width: 80, height: 80, background: 'linear-gradient(135deg, var(--accent-dim), rgba(124,58,237,0.1))', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)' }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
                </svg>
              </div>
              <div className="animate-breathe" style={{ position: 'absolute', top: -4, right: -4, width: 14, height: 14, background: 'var(--accent)', borderRadius: '50%', border: '2px solid var(--bg-primary)' }} />
            </div>

            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, background: 'linear-gradient(135deg, var(--text-primary), var(--accent))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Ready to Browse
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.6 }}>
              Launch a persistent Chromium session to begin autonomous web interaction. BrowserPilot will extract content, execute workflows, and maintain contextual memory.
            </p>
            <button className="btn btn-primary btn-lg animate-pulse-glow" onClick={() => onStartSession()} disabled={isLoading}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5,3 19,12 5,21" /></svg>
              Launch Browser
            </button>
          </div>
        ) : screenshotUrl ? (
          <img src={screenshotUrl} alt="Browser view" className="animate-fade-in" />
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
            <div className="animate-spin" style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', margin: '0 auto 12px' }} />
            <p style={{ fontSize: 12 }}>Capturing browser view...</p>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="animate-slide-up" style={{
            position: 'absolute', bottom: 12, left: 12, right: 12,
            padding: '10px 16px', background: 'var(--error-dim)',
            border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: 10,
            color: 'var(--error)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8,
            backdropFilter: 'blur(8px)',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

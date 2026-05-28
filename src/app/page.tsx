'use client';

import { useState, useEffect } from 'react';
import { useSSE } from '@/hooks/use-sse';
import { useBrowser } from '@/hooks/use-browser';
import TopBar from '@/components/dashboard/top-bar';
import Sidebar from '@/components/dashboard/sidebar';
import BrowserView from '@/components/dashboard/browser-view';
import AssistantPanel from '@/components/dashboard/assistant-panel';
import LogDrawer from '@/components/dashboard/log-drawer';

export default function Dashboard() {
  const { events, isConnected } = useSSE();
  const browser = useBrowser();
  const [showLogs, setShowLogs] = useState(false);
  const [mode, setMode] = useState<'auto' | 'step' | 'manual'>('manual');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Apply theme to HTML element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Restore theme from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('browserpilot-theme') as 'dark' | 'light' | null;
    if (saved) setTheme(saved);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('browserpilot-theme', next);
  };

  return (
    <div className="dashboard">
      <TopBar
        isConnected={isConnected}
        browserState={browser.state}
        mode={mode}
        onModeChange={setMode}
        onToggleLogs={() => setShowLogs(!showLogs)}
        onToggleTheme={toggleTheme}
        theme={theme}
        isLoading={browser.isLoading}
      />

      <Sidebar events={events} />

      <div className="center-panel">
        <BrowserView
          screenshotUrl={browser.screenshotUrl}
          isRunning={browser.state.isRunning}
          currentUrl={browser.state.currentUrl}
          onStartSession={browser.startSession}
          onNavigate={browser.navigate}
          onRefresh={browser.refreshScreenshot}
          isLoading={browser.isLoading}
          error={browser.error}
        />
        {showLogs && <LogDrawer events={events} />}
      </div>

      <AssistantPanel
        isRunning={browser.state.isRunning}
        onExtractPage={browser.extractPage}
        onExtractQuiz={browser.extractQuiz}
      />
    </div>
  );
}

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

interface BrowserState {
  isRunning: boolean;
  tabs: { id: string; url: string; title: string; isActive: boolean }[];
  activeTabId: string | null;
  currentUrl: string | null;
  currentTitle: string | null;
}

export function useBrowser() {
  const [state, setState] = useState<BrowserState>({
    isRunning: false, tabs: [], activeTabId: null, currentUrl: null, currentTitle: null,
  });
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/session/status');
      const data = await res.json();
      if (data.browser) setState(data.browser);
    } catch { /* polling, ignore errors */ }
  }, []);

  const refreshScreenshot = useCallback(async () => {
    if (!state.isRunning) return;
    try {
      const res = await fetch('/api/browser/screenshot?quality=50');
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        setScreenshotUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return url; });
      }
    } catch { /* ignore */ }
  }, [state.isRunning]);

  // Poll status and screenshot
  useEffect(() => {
    fetchStatus();
    pollRef.current = setInterval(() => { fetchStatus(); refreshScreenshot(); }, 2000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchStatus, refreshScreenshot]);

  const startSession = useCallback(async (profileName = 'default') => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/session/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileName }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start session');
    } finally {
      setIsLoading(false);
    }
  }, [fetchStatus]);

  const navigate = useCallback(async (url: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/browser/navigate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      await fetchStatus();
      await refreshScreenshot();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Navigation failed');
    } finally {
      setIsLoading(false);
    }
  }, [fetchStatus, refreshScreenshot]);

  const extractPage = useCallback(async () => {
    try {
      const res = await fetch('/api/extract/page', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'auto', includeScreenshot: false }),
      });
      return await res.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Extraction failed');
      return null;
    }
  }, []);

  const extractQuiz = useCallback(async () => {
    try {
      const res = await fetch('/api/extract/quiz', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'auto', includeScreenshot: true }),
      });
      return await res.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Quiz extraction failed');
      return null;
    }
  }, []);

  return { state, screenshotUrl, isLoading, error, startSession, navigate, extractPage, extractQuiz, refreshScreenshot };
}

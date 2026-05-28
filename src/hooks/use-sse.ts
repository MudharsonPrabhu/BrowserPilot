'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { BusEvent } from '@/lib/events/bus';

export function useSSE() {
  const [events, setEvents] = useState<BusEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource('/api/stream');
    eventSourceRef.current = es;

    es.onopen = () => setIsConnected(true);

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as BusEvent;
        setEvents((prev) => [...prev.slice(-200), data]);
      } catch { /* ignore parse errors */ }
    };

    es.onerror = () => {
      setIsConnected(false);
      // Auto-reconnect is built into EventSource
    };

    return () => { es.close(); };
  }, []);

  const clearEvents = useCallback(() => setEvents([]), []);

  return { events, isConnected, clearEvents };
}

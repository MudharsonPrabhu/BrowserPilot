'use client';

import { useRef, useEffect } from 'react';
import type { BusEvent } from '@/lib/events/bus';

interface LogDrawerProps {
  events: BusEvent[];
}

export default function LogDrawer({ events }: LogDrawerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

  const getLogClass = (type: string) => {
    if (type.includes('error') || type.includes('failed')) return 'log-entry-error';
    if (type.includes('warn')) return 'log-entry-warn';
    return 'log-entry-info';
  };

  return (
    <div style={{
      height: 200, borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)',
      overflow: 'hidden', display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        padding: '6px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderBottom: '1px solid var(--border)',
      }}>
        <span className="section-title" style={{ margin: 0 }}>Live Logs</span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{events.length} events</span>
      </div>
      <div ref={scrollRef} style={{ flex: 1, overflow: 'auto', padding: 4 }}>
        {events.slice(-50).map((event, i) => (
          <div key={i} className={`log-entry ${getLogClass(event.type)}`}>
            <span style={{ color: 'var(--text-muted)', marginRight: 8 }}>
              {new Date(event.timestamp).toLocaleTimeString()}
            </span>
            <span style={{ color: 'var(--accent)', marginRight: 8 }}>[{event.type}]</span>
            {Object.entries(event.data).map(([k, v]) => (
              <span key={k} style={{ marginRight: 6 }}>
                {k}=<span style={{ color: 'var(--text-primary)' }}>{String(v).slice(0, 60)}</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

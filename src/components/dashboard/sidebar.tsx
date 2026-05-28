'use client';

import { useState } from 'react';
import type { BusEvent } from '@/lib/events/bus';

interface SidebarProps {
  events: BusEvent[];
}

export default function Sidebar({ events }: SidebarProps) {
  const [tab, setTab] = useState<'tasks' | 'history' | 'study'>('tasks');

  // Build task list from events
  const taskEvents = events.filter((e) => e.type.startsWith('task:'));
  const uniqueTasks = new Map<string, { id: string; type: string; status: string; description?: string; progress?: number }>();
  taskEvents.forEach((e) => {
    const taskId = e.data.taskId as string;
    if (!taskId) return;
    const existing = uniqueTasks.get(taskId) || { id: taskId, type: '', status: '', description: '' };
    if (e.type === 'task:created') { existing.type = (e.data.type as string) || ''; existing.description = (e.data.description as string) || ''; existing.status = 'queued'; }
    if (e.type === 'task:started') existing.status = 'running';
    if (e.type === 'task:completed') existing.status = 'completed';
    if (e.type === 'task:failed') existing.status = 'failed';
    if (e.type === 'task:paused') existing.status = 'paused';
    if (e.type === 'task:cancelled') existing.status = 'cancelled';
    if (e.data.progress) existing.progress = e.data.progress as number;
    uniqueTasks.set(taskId, existing);
  });
  const tasks = Array.from(uniqueTasks.values());

  const badgeClass: Record<string, string> = {
    queued: 'badge-queued', running: 'badge-running', completed: 'badge-completed',
    failed: 'badge-failed', paused: 'badge-paused', cancelled: 'badge-paused',
  };

  return (
    <div className="sidebar">
      {/* Tab navigation */}
      <div className="tab-group">
        {(['tasks', 'history', 'study'] as const).map((t) => (
          <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {/* Tasks tab */}
      {tab === 'tasks' && (
        <div>
          <div className="section-title">Task Queue</div>
          {tasks.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.4 }}>
                  <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18" /><path d="M9 21V9" />
                </svg>
              </div>
              <div className="empty-state-title">No Tasks</div>
              <div className="empty-state-text">Launch a browser session to begin automation</div>
            </div>
          ) : (
            tasks.map((task, i) => (
              <div key={task.id} className={`card animate-fade-in stagger-${Math.min(i + 1, 4)}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--accent)' }}>
                    {task.type}
                  </span>
                  <span className={`badge ${badgeClass[task.status] || 'badge-queued'}`}>{task.status}</span>
                </div>
                {task.description && (
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{task.description}</p>
                )}
                {/* Progress bar */}
                {task.status === 'running' && task.progress !== undefined && (
                  <div className="progress-bar" style={{ marginTop: 8 }}>
                    <div className="progress-bar-fill" style={{ width: `${task.progress}%` }} />
                  </div>
                )}
                {/* Action buttons */}
                {task.status === 'running' && (
                  <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => fetch('/api/tasks', {
                      method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'pause', taskId: task.id }),
                    })}>⏸ Pause</button>
                    <button className="btn btn-danger btn-sm" onClick={() => fetch('/api/tasks', {
                      method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'stop', taskId: task.id }),
                    })}>⏹ Stop</button>
                  </div>
                )}
                {task.status === 'paused' && (
                  <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }} onClick={() => fetch('/api/tasks', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'resume', taskId: task.id }),
                  })}>▶ Resume</button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* History tab */}
      {tab === 'history' && (
        <div>
          <div className="section-title">Recent Activity</div>
          {events.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">No Events</div>
              <div className="empty-state-text">Events will appear here in real-time</div>
            </div>
          ) : (
            events.slice(-30).reverse().map((event, i) => (
              <div key={i} className={`card animate-slide-left stagger-${Math.min(i + 1, 4)}`} style={{ padding: '8px 10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: event.type.includes('error') ? 'var(--error)' : 'var(--accent)' }}>
                    {event.type}
                  </span>
                  <span style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: 'JetBrains Mono, monospace' }}>
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Study tab */}
      {tab === 'study' && (
        <StudyTab />
      )}
    </div>
  );
}

function StudyTab() {
  const [graph, setGraph] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadGraph = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/study-graph');
      const data = await res.json();
      setGraph(data);
    } catch { /* ignore */ }
    setIsLoading(false);
  };

  return (
    <div>
      <div className="section-title">Study Progress</div>
      <button className="btn btn-secondary btn-sm" onClick={loadGraph} disabled={isLoading} style={{ marginBottom: 12, width: '100%' }}>
        {isLoading ? '⏳ Loading...' : '📊 Load Study Graph'}
      </button>

      {graph && (
        <div className="animate-fade-in">
          {/* Overall progress */}
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent)' }}>
              {Math.round((graph.overallProgress || 0) * 100)}%
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Overall Progress</div>
            <div className="progress-bar" style={{ marginTop: 8 }}>
              <div className="progress-bar-fill" style={{ width: `${(graph.overallProgress || 0) * 100}%` }} />
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
            <div className="card" style={{ textAlign: 'center', padding: 10 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--success)' }}>{graph.strongAreas?.length || 0}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Strong</div>
            </div>
            <div className="card" style={{ textAlign: 'center', padding: 10 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--error)' }}>{graph.weakAreas?.length || 0}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Weak</div>
            </div>
          </div>

          {/* Recommendations */}
          {graph.recommendations?.length > 0 && (
            <div className="card">
              <div className="section-title" style={{ marginBottom: 6 }}>Recommendations</div>
              {graph.recommendations.map((r: string, i: number) => (
                <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '3px 0', borderBottom: i < graph.recommendations.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                  💡 {r}
                </div>
              ))}
            </div>
          )}

          {/* Weak areas */}
          {graph.weakAreas?.length > 0 && (
            <div className="card">
              <div className="section-title" style={{ marginBottom: 6 }}>Needs Review</div>
              {graph.weakAreas.slice(0, 5).map((topic: any, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{topic.name}</span>
                  <span className={`confidence ${topic.strength < 0.3 ? 'confidence-low' : 'confidence-medium'}`}>
                    {Math.round(topic.strength * 100)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!graph && !isLoading && (
        <div className="empty-state">
          <div className="empty-state-text">Complete lessons and quizzes to build your study graph</div>
        </div>
      )}
    </div>
  );
}

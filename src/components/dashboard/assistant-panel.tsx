'use client';

import { useState } from 'react';

interface AssistantPanelProps {
  isRunning: boolean;
  onExtractPage: () => Promise<unknown>;
  onExtractQuiz: () => Promise<unknown>;
}

export default function AssistantPanel({ isRunning, onExtractPage, onExtractQuiz }: AssistantPanelProps) {
  const [tab, setTab] = useState<'assistant' | 'summaries' | 'context' | 'memory'>('assistant');
  const [extraction, setExtraction] = useState<Record<string, unknown> | null>(null);
  const [quizData, setQuizData] = useState<Record<string, unknown> | null>(null);
  const [notes, setNotes] = useState<{ title: string; notes: string } | null>(null); // session summaries
  const [flashcards, setFlashcards] = useState<{ front: string; back: string; difficulty: string }[]>([]); // memory snapshots
  const [currentCard, setCurrentCard] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [aiSummary, setAiSummary] = useState<{ summary: string; keyPoints: string[]; topics: string[] } | null>(null);

  const handleExtract = async () => {
    setIsExtracting(true);
    const result = await onExtractPage();
    setExtraction(result as Record<string, unknown>);
    setIsExtracting(false);
  };

  const handleQuiz = async () => {
    setIsExtracting(true);
    const result = await onExtractQuiz();
    setQuizData(result as Record<string, unknown>);
    setTab('quiz');
    setIsExtracting(false);
  };

  const handleSummarize = async () => {
    if (!extraction?.content) return;
    setIsExtracting(true);
    try {
      const text = (extraction.content as any)?.text || (extraction.content as any)?.rawText || '';
      const res = await fetch('/api/ai/summarize', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      });
      const data = await res.json();
      if (data.success) setAiSummary(data);
    } catch { /* ignore */ }
    setIsExtracting(false);
  };

  const handleGenerateNotes = async () => {
    if (!extraction?.content) return;
    setIsExtracting(true);
    try {
      const text = (extraction.content as any)?.text || (extraction.content as any)?.rawText || '';
      const res = await fetch('/api/notes/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      });
      const data = await res.json();
      if (data.success) {
        setNotes({ title: data.title, notes: data.notes });
        if (data.flashcards?.length > 0) {
          setFlashcards(data.flashcards);
        }
        setTab('notes');
      }
    } catch { /* ignore */ }
    setIsExtracting(false);
  };

  const handleAnswerQuiz = async (questionIdx: number) => {
    if (!quizData) return;
    const questions = (quizData as any).questions;
    if (!questions?.[questionIdx]) return;
    setIsExtracting(true);
    try {
      const q = questions[questionIdx];
      const res = await fetch('/api/ai/answer', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q.text, options: q.options }),
      });
      const data = await res.json();
      if (data.success) {
        // Update quiz data with AI answer
        const updated = { ...quizData };
        (updated as any).questions[questionIdx].aiAnswer = data;
        setQuizData(updated);
      }
    } catch { /* ignore */ }
    setIsExtracting(false);
  };

  return (
    <div className="right-panel">
      {/* Tab navigation */}
      <div className="tab-group">
        {(['assistant', 'summaries', 'context', 'memory'] as const).map((t) => (
          <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}
            style={{ fontSize: 10, padding: '5px 0' }}>
            {t === 'memory' ? '🧠' : ''} {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Assistant Tab ── */}
      {tab === 'assistant' && (
        <div className="animate-fade-in">
          <div className="section-title">Quick Actions</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
            <button className="btn btn-primary" onClick={handleExtract} disabled={!isRunning || isExtracting}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg>
              Extract Page Content
            </button>
            <button className="btn btn-secondary" onClick={handleQuiz} disabled={!isRunning || isExtracting}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              Extract Context
            </button>
            {extraction && (
              <>
                <button className="btn btn-secondary" onClick={handleSummarize} disabled={isExtracting}>
                  ✨ AI Summarize
                </button>
                <button className="btn btn-secondary" onClick={handleGenerateNotes} disabled={isExtracting}>
                  📝 Generate Summary & Memory Snapshots
                </button>
              </>
            )}
          </div>

          {/* Loading state */}
          {isExtracting && (
            <div className="card animate-fade-in" style={{ textAlign: 'center', padding: 20 }}>
              <div className="animate-spin" style={{ width: 20, height: 20, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', margin: '0 auto 8px' }} />
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>AI is thinking...</div>
            </div>
          )}

          {/* AI Summary result */}
          {aiSummary && (
            <div className="card animate-fade-in-scale">
              <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>AI Summary</span>
                <span className="badge badge-completed">✨</span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 10 }}>
                {aiSummary.summary}
              </p>
              {aiSummary.keyPoints?.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Key Points</div>
                  {aiSummary.keyPoints.map((kp, i) => (
                    <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '3px 0 3px 12px', borderLeft: '2px solid var(--accent-dim)' }}>
                      {kp}
                    </div>
                  ))}
                </div>
              )}
              {aiSummary.topics?.length > 0 && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
                  {aiSummary.topics.map((t, i) => (
                    <span key={i} className="badge badge-info">{t}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Extraction result */}
          {extraction && !aiSummary && (
            <div className="card animate-fade-in">
              <div className="section-title">Extracted Content</div>
              {(extraction as any)?.pageType && (
                <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="badge badge-running">{(extraction as any).pageType}</span>
                  <span className={`confidence ${((extraction as any).pageTypeConfidence || 0) > 0.7 ? 'confidence-high' : 'confidence-medium'}`}>
                    {Math.round(((extraction as any).pageTypeConfidence || 0) * 100)}%
                  </span>
                </div>
              )}

              {/* Extraction chain */}
              {(extraction as any)?.extractionChain && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>Pipeline</div>
                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                    {(extraction as any).extractionChain.map((step: any, i: number) => (
                      <span key={i} className={`badge ${step.success ? 'badge-completed' : 'badge-failed'}`}>
                        {step.method} {step.duration}ms
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Content preview */}
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', maxHeight: 200, overflow: 'auto', lineHeight: 1.5 }}>
                {((extraction as any)?.content?.text || (extraction as any)?.content?.rawText || '').slice(0, 600)}...
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Notes Tab ── */}
      {tab === 'summaries' && (
        <div className="animate-fade-in">
          <div className="section-title">Session Summaries</div>
          {notes ? (
            <div className="card">
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>{notes.title}</h3>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {notes.notes}
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.3 }}>
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </div>
              <div className="empty-state-title">No Summaries Yet</div>
              <div className="empty-state-text">Extract page content, then click "Generate Summary"</div>
            </div>
          )}
        </div>
      )}

      {/* ── Quiz Tab ── */}
      {tab === 'context' && (
        <div className="animate-fade-in">
          <div className="section-title">Context Detection</div>
          {quizData && (quizData as any)?.questions?.length > 0 ? (
            (quizData as any).questions.map((q: any, qi: number) => (
              <div key={qi} className="card animate-fade-in" style={{ animationDelay: `${qi * 0.05}s` }}>
                {(quizData as any).isCopySensitive && qi === 0 && (
                  <span className="badge badge-failed" style={{ marginBottom: 8, display: 'inline-flex' }}>
                    🔒 Copy-Sensitive
                  </span>
                )}
                <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                  Q{qi + 1}: {q.text}
                </p>
                {q.options?.map((opt: any, oi: number) => {
                  const isAiPick = q.aiAnswer?.selectedOption === opt.label;
                  return (
                    <div key={oi} style={{
                      padding: '8px 12px', marginBottom: 4, borderRadius: 8, fontSize: 12,
                      background: isAiPick ? 'var(--success-dim)' : opt.isSelected || opt.checked ? 'var(--accent-dim)' : 'var(--bg-elevated)',
                      border: `1px solid ${isAiPick ? 'var(--success)' : opt.isSelected || opt.checked ? 'var(--accent)' : 'var(--border)'}`,
                      color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8,
                      transition: 'all 0.2s',
                    }}>
                      <span style={{ width: 22, height: 22, borderRadius: 6, background: isAiPick ? 'var(--success)' : 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: isAiPick ? 'white' : 'var(--accent)', flexShrink: 0 }}>
                        {opt.label}
                      </span>
                      <span style={{ flex: 1 }}>{opt.text}</span>
                      {isAiPick && <span style={{ fontSize: 10, color: 'var(--success)', fontWeight: 600 }}>AI Pick</span>}
                    </div>
                  );
                })}
                {/* AI answer details */}
                {q.aiAnswer && (
                  <div style={{ marginTop: 10, padding: '10px', background: 'var(--bg-primary)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>AI Analysis</span>
                      <span className={`confidence ${q.aiAnswer.confidence > 0.8 ? 'confidence-high' : q.aiAnswer.confidence > 0.5 ? 'confidence-medium' : 'confidence-low'}`}>
                        {Math.round(q.aiAnswer.confidence * 100)}% confident
                      </span>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{q.aiAnswer.reasoning}</p>
                    {q.aiAnswer.explanation && (
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, fontStyle: 'italic', lineHeight: 1.5 }}>
                        💡 {q.aiAnswer.explanation}
                      </p>
                    )}
                  </div>
                )}
                {!q.aiAnswer && (
                  <button className="btn btn-secondary btn-sm" style={{ marginTop: 8, width: '100%' }}
                    onClick={() => handleAnswerQuiz(qi)} disabled={isExtracting}>
                    🧠 Run Decision Engine
                  </button>
                )}
              </div>
            ))
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.3 }}>
                  <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <div className="empty-state-title">No Context Data</div>
              <div className="empty-state-text">Navigate to a page and click "Extract Context"</div>
            </div>
          )}
        </div>
      )}

      {/* ── Flashcards Tab ── */}
      {tab === 'memory' && (
        <div className="animate-fade-in">
          <div className="section-title">Memory Snapshots</div>
          {flashcards.length > 0 ? (
            <div>
              {/* Card display */}
              <div className="flashcard" onClick={() => setShowBack(!showBack)} style={{ marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 8 }}>
                    {showBack ? 'ANSWER' : 'QUESTION'} — {currentCard + 1} / {flashcards.length}
                  </div>
                  <div className={showBack ? 'flashcard-back' : 'flashcard-front'}>
                    {showBack ? flashcards[currentCard].back : flashcards[currentCard].front}
                  </div>
                  <div style={{ marginTop: 12, fontSize: 10, color: 'var(--text-dim)' }}>
                    Click to {showBack ? 'see question' : 'reveal answer'}
                  </div>
                </div>
              </div>

              {/* Difficulty badge */}
              <div style={{ textAlign: 'center', marginBottom: 12 }}>
                <span className={`badge ${flashcards[currentCard].difficulty === 'easy' ? 'badge-completed' : flashcards[currentCard].difficulty === 'hard' ? 'badge-failed' : 'badge-queued'}`}>
                  {flashcards[currentCard].difficulty}
                </span>
              </div>

              {/* Navigation */}
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => { setCurrentCard(Math.max(0, currentCard - 1)); setShowBack(false); }} disabled={currentCard === 0}>
                  ← Prev
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => { setShowBack(false); setCurrentCard(Math.min(flashcards.length - 1, currentCard + 1)); }} disabled={currentCard >= flashcards.length - 1}>
                  Next →
                </button>
              </div>

              {/* Self-assessment buttons */}
              {showBack && (
                <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginTop: 12 }}>
                  <button className="btn btn-danger btn-sm" onClick={() => { setShowBack(false); setCurrentCard(Math.min(flashcards.length - 1, currentCard + 1)); }}>
                    😕 Hard
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => { setShowBack(false); setCurrentCard(Math.min(flashcards.length - 1, currentCard + 1)); }}>
                    🤔 Okay
                  </button>
                  <button className="btn btn-success btn-sm" onClick={() => { setShowBack(false); setCurrentCard(Math.min(flashcards.length - 1, currentCard + 1)); }}>
                    😎 Easy
                  </button>
                </div>
              )}

              {/* Progress dots */}
              <div style={{ display: 'flex', gap: 3, justifyContent: 'center', marginTop: 16, flexWrap: 'wrap' }}>
                {flashcards.map((_, i) => (
                  <div key={i} onClick={() => { setCurrentCard(i); setShowBack(false); }}
                    style={{ width: 8, height: 8, borderRadius: '50%', cursor: 'pointer', transition: 'all 0.15s',
                      background: i === currentCard ? 'var(--accent)' : i < currentCard ? 'var(--success)' : 'var(--border)',
                    }} />
                ))}
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">🧠</div>
              <div className="empty-state-title">No Memory Snapshots</div>
              <div className="empty-state-text">Extract content and click "Generate Summary & Memory Snapshots" to build persistent knowledge</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

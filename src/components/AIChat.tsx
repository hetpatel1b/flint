import { useState, useRef, useEffect, useCallback } from 'react';
import { useStore } from '../store';
import { askFlintAI, fetchOllamaModels, checkOllamaStatus, buildMemoryContext } from '../services/ollama';
import { X, Send, Trash2, User, Loader2, Settings, Wifi, WifiOff, Globe, Brain, BookOpen, Network, Sparkles, Zap } from 'lucide-react';

function FlintStone({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 100 120" width={size} height={size * 1.2} fill="none">
      <ellipse cx="50" cy="65" rx="35" ry="45" fill="#2a2a2a" />
      <ellipse cx="50" cy="63" rx="32" ry="42" fill="#1a1a1a" />
      <ellipse cx="40" cy="40" rx="14" ry="8" fill="#2a2a2a" opacity="0.7" transform="rotate(-15 40 40)" />
      <path d="M35 45 L45 65 L40 85 L50 95" stroke="#333" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M45 65 L60 72 L68 85" stroke="#333" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <circle cx="65" cy="50" r="2.5" fill="#e8a030" />
      <circle cx="65" cy="50" r="4" fill="#e8a030" opacity="0.3" />
      <line x1="65" y1="43" x2="65" y2="38" stroke="#e8a030" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="70" y1="47" x2="74" y2="44" stroke="#e8a030" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

export function AIChat() {
  const { state, dispatch } = useStore();
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState('');
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [models, setModels] = useState<string[]>([]);
  const [showConfig, setShowConfig] = useState(false);
  const [contextPreview, setContextPreview] = useState<string | null>(null);
  const [memoryStats, setMemoryStats] = useState({ notes: 0, connections: 0, tags: 0 });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef(false);

  const { aiMessages, aiSettings, notes, activeNoteId } = state;

  // Calculate memory stats
  useEffect(() => {
    const connections = new Set<string>();
    let tags = 0;
    notes.forEach(n => {
      const matches = n.content.matchAll(/\[\[([^\]|]+?)(?:\|[^\]]+)?\]\]/g);
      for (const m of matches) {
        const target = notes.find(nt => nt.title.toLowerCase() === m[1].toLowerCase());
        if (target && target.id !== n.id) {
          connections.add([n.id, target.id].sort().join('-'));
        }
      }
      const tagMatches = n.content.matchAll(/#(\w[\w-]*)/g);
      for (const _ of tagMatches) tags++;
    });
    setMemoryStats({ notes: notes.length, connections: connections.size, tags });
  }, [notes]);

  // Check Ollama connection and auto-select model
  useEffect(() => {
    const check = async () => {
      const status = await checkOllamaStatus(aiSettings.ollamaUrl);
      setOllamaStatus(status);
      if (status === 'connected') {
        const fetchedModels = await fetchOllamaModels(aiSettings.ollamaUrl);
        setModels(fetchedModels);
        // Auto-select first model if current model is empty or not found
        if (fetchedModels.length > 0) {
          const currentModel = aiSettings.model;
          const modelExists = fetchedModels.some(m => m === currentModel);
          if (!currentModel || !modelExists) {
            dispatch({ type: 'UPDATE_AI_SETTINGS', payload: { model: fetchedModels[0] } });
          }
        }
      }
    };
    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, [aiSettings.ollamaUrl, aiSettings.model, dispatch]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiMessages, streamContent]);

  const activeNote = notes.find(n => n.id === activeNoteId);

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    if (!aiSettings.model) {
      const errMsg = {
        id: Math.random().toString(36).slice(2) + Date.now().toString(36),
        role: 'assistant' as const,
        content: '⚠️ No model selected. Please configure a model in the AI settings (⚙️ button above).\n\nMake sure Ollama is running:\n```bash\nollama serve\nollama pull llama3.2\n```',
        timestamp: Date.now(),
      };
      dispatch({ type: 'ADD_AI_MESSAGE', payload: errMsg });
      return;
    }

    abortRef.current = false;

    const userMsg = {
      id: Math.random().toString(36).slice(2) + Date.now().toString(36),
      role: 'user' as const,
      content: trimmed,
      timestamp: Date.now(),
      noteContext: activeNoteId ? [activeNoteId] : undefined,
    };
    dispatch({ type: 'ADD_AI_MESSAGE', payload: userMsg });
    setInput('');
    setIsStreaming(true);
    setStreamContent('');

    const chatHistory = aiMessages.slice(-10).map(m => ({ role: m.role, content: m.content }));

    await askFlintAI(
      trimmed,
      notes,
      activeNoteId,
      aiSettings,
      chatHistory,
      (chunk) => {
        if (abortRef.current) return;
        setStreamContent(prev => prev + chunk);
      },
      (fullContent, webResults) => {
        if (abortRef.current) return;
        const assistantMsg = {
          id: Math.random().toString(36).slice(2) + Date.now().toString(36),
          role: 'assistant' as const,
          content: fullContent,
          timestamp: Date.now(),
          webResults,
        };
        dispatch({ type: 'ADD_AI_MESSAGE', payload: assistantMsg });
        setIsStreaming(false);
        setStreamContent('');
      },
      (err) => {
        if (abortRef.current) return;
        const errMsg = {
          id: Math.random().toString(36).slice(2) + Date.now().toString(36),
          role: 'assistant' as const,
          content: `⚠️ Error: ${err}\n\nMake sure Ollama is running:\n\`\`\`bash\nollama serve\nollama pull ${aiSettings.model || 'llama3.2'}\n\`\`\`\n\nAlso check Settings → AI tab for configuration.`,
          timestamp: Date.now(),
        };
        dispatch({ type: 'ADD_AI_MESSAGE', payload: errMsg });
        setIsStreaming(false);
        setStreamContent('');
      },
    );
  }, [input, isStreaming, notes, activeNoteId, aiMessages, aiSettings, activeNote, dispatch]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const stopGeneration = () => {
    abortRef.current = true;
    setIsStreaming(false);
    if (streamContent) {
      const partial = {
        id: Math.random().toString(36).slice(2) + Date.now().toString(36),
        role: 'assistant' as const,
        content: streamContent + '\n\n*[Generation stopped]*',
        timestamp: Date.now(),
      };
      dispatch({ type: 'ADD_AI_MESSAGE', payload: partial });
      setStreamContent('');
    }
  };

  const showContextPreview = () => {
    if (contextPreview) {
      setContextPreview(null);
      return;
    }
    const query = input || 'general context';
    const memory = buildMemoryContext(notes, activeNoteId, query, aiSettings.maxContextNotes);
    setContextPreview(memory);
  };

  return (
    <div style={{
      width: 380, height: '100%', background: '#080808',
      borderLeft: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 14px', borderBottom: '1px solid #1a1a1a',
        display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
        background: '#060606',
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8, background: '#111',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '1px solid #222',
        }}>
          <FlintStone size={16} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#aaa' }}>Flint AI</div>
          <div className="flex items-center gap-1" style={{ fontSize: 10, color: ollamaStatus === 'connected' ? '#5a5' : ollamaStatus === 'checking' ? '#555' : '#655' }}>
            {ollamaStatus === 'connected' ? <Wifi size={8} /> : ollamaStatus === 'checking' ? <Loader2 size={8} className="animate-spin" /> : <WifiOff size={8} />}
            {ollamaStatus === 'connected'
              ? (aiSettings.model ? `Online · ${aiSettings.model}` : 'Online · Select model')
              : ollamaStatus === 'checking' ? 'Connecting...'
              : 'Ollama offline'}
          </div>
        </div>
        <button onClick={showContextPreview} title="Preview AI memory"
          style={{ background: 'none', border: 'none', color: contextPreview ? '#888' : '#444', cursor: 'pointer', display: 'flex', padding: 4 }}>
          <BookOpen size={14} />
        </button>
        <button onClick={() => setShowConfig(!showConfig)} title="AI Settings"
          style={{ background: 'none', border: 'none', color: showConfig ? '#888' : '#444', cursor: 'pointer', display: 'flex', padding: 4 }}>
          <Settings size={14} />
        </button>
        <button onClick={() => dispatch({ type: 'TOGGLE_AI_CHAT' })} title="Close"
          style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer', display: 'flex', padding: 4 }}>
          <X size={14} />
        </button>
      </div>

      {/* Memory stats bar */}
      <div style={{
        padding: '6px 14px', borderBottom: '1px solid #1a1a1a',
        display: 'flex', gap: 12, background: '#050505', flexShrink: 0,
      }}>
        <div className="flex items-center gap-1" style={{ fontSize: 9, color: '#444' }}>
          <Brain size={8} /> {memoryStats.notes} notes
        </div>
        <div className="flex items-center gap-1" style={{ fontSize: 9, color: '#444' }}>
          <Network size={8} /> {memoryStats.connections} links
        </div>
        <div className="flex items-center gap-1" style={{ fontSize: 9, color: '#444' }}>
          <Sparkles size={8} /> {memoryStats.tags} tags
        </div>
        <div className="flex items-center gap-1" style={{ fontSize: 9, color: aiSettings.internetAccess ? '#565' : '#444' }}>
          <Globe size={8} /> {aiSettings.internetAccess ? 'Web on' : 'Web off'}
        </div>
      </div>

      {/* Config panel */}
      {showConfig && (
        <div style={{ padding: 12, borderBottom: '1px solid #1a1a1a', background: '#060606', flexShrink: 0 }}>
          <ConfigField label="Ollama URL">
            <input type="text" value={aiSettings.ollamaUrl}
              onChange={e => dispatch({ type: 'UPDATE_AI_SETTINGS', payload: { ollamaUrl: e.target.value } })}
              style={{ ...inputStyle, fontSize: 11 }} />
          </ConfigField>
          <ConfigField label="Model">
            {models.length > 0 ? (
              <select value={aiSettings.model}
                onChange={e => dispatch({ type: 'UPDATE_AI_SETTINGS', payload: { model: e.target.value } })}
                style={{ ...inputStyle, fontSize: 11 }}>
                {!aiSettings.model && <option value="">Select a model...</option>}
                {models.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            ) : (
              <input type="text" value={aiSettings.model}
                onChange={e => dispatch({ type: 'UPDATE_AI_SETTINGS', payload: { model: e.target.value } })}
                placeholder="e.g. llama3.2, mistral, codellama"
                style={{ ...inputStyle, fontSize: 11 }} />
            )}
          </ConfigField>
          <ConfigField label="Context notes">
            <input type="range" min={2} max={20} value={aiSettings.maxContextNotes}
              onChange={e => dispatch({ type: 'UPDATE_AI_SETTINGS', payload: { maxContextNotes: parseInt(e.target.value) } })}
              style={{ flex: 1, accentColor: '#666' }} />
            <span style={{ fontSize: 10, color: '#555', width: 20, textAlign: 'right' }}>{aiSettings.maxContextNotes}</span>
          </ConfigField>
          <ConfigField label="Temperature">
            <input type="range" min={0} max={200} value={Math.round(aiSettings.temperature * 100)}
              onChange={e => dispatch({ type: 'UPDATE_AI_SETTINGS', payload: { temperature: parseInt(e.target.value) / 100 } })}
              style={{ flex: 1, accentColor: '#666' }} />
            <span style={{ fontSize: 10, color: '#555', width: 30, textAlign: 'right' }}>{aiSettings.temperature.toFixed(2)}</span>
          </ConfigField>
          <ConfigField label="Internet">
            <div onClick={() => dispatch({ type: 'UPDATE_AI_SETTINGS', payload: { internetAccess: !aiSettings.internetAccess } })}
              style={{
                width: 36, height: 20, borderRadius: 10, cursor: 'pointer',
                background: aiSettings.internetAccess ? '#3a5a3a' : '#1a1a1a', position: 'relative',
                transition: 'background 0.2s', border: `1px solid ${aiSettings.internetAccess ? '#4a6a4a' : '#222'}`,
              }}>
              <div style={{
                width: 14, height: 14, borderRadius: 7, background: aiSettings.internetAccess ? '#8c8' : '#444',
                position: 'absolute', top: 2, left: aiSettings.internetAccess ? 18 : 2,
                transition: 'all 0.2s',
              }} />
            </div>
            <span style={{ fontSize: 10, color: aiSettings.internetAccess ? '#6a6' : '#555' }}>
              {aiSettings.internetAccess ? 'Enabled' : 'Disabled'}
            </span>
          </ConfigField>
        </div>
      )}

      {/* Context preview */}
      {contextPreview && (
        <div style={{ padding: 10, borderBottom: '1px solid #1a1a1a', background: '#030303', maxHeight: 200, overflowY: 'auto', flexShrink: 0 }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: '#666' }}>
              <Brain size={10} style={{ display: 'inline', marginRight: 4 }} />
              AI Memory Context ({contextPreview.length.toLocaleString()} chars)
            </span>
            <button onClick={() => setContextPreview(null)} style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer' }}>
              <X size={10} />
            </button>
          </div>
          <pre style={{ fontSize: 9, color: '#444', whiteSpace: 'pre-wrap', lineHeight: 1.4, fontFamily: 'monospace' }}>
            {contextPreview}
          </pre>
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px' }} className="flint-scrollbar">
        {aiMessages.length === 0 && !isStreaming && (
          <div style={{ textAlign: 'center', padding: '24px 10px' }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14, background: '#0f0f0f',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 14px', border: '1px solid #222',
            }}>
              <FlintStone size={24} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#777', marginBottom: 6 }}>Flint AI</div>
            <div style={{ fontSize: 11, color: '#444', lineHeight: 1.6, maxWidth: 260, margin: '0 auto 8px' }}>
              I have memory of your notes and their connections.
              {aiSettings.internetAccess && ' I also have internet access.'}
            </div>
            <div className="flex items-center justify-center gap-3" style={{ fontSize: 9, color: '#333', marginBottom: 16 }}>
              <span>📝 {memoryStats.notes} notes</span>
              <span>🔗 {memoryStats.connections} links</span>
              {aiSettings.internetAccess && <span>🌐 Web</span>}
            </div>
            {activeNote && (
              <div style={{
                fontSize: 10, color: '#444', padding: '6px 10px',
                background: '#0a0a0a', borderRadius: 6,
                border: '1px solid #1a1a1a', marginBottom: 12,
              }}>
                📄 Active: {activeNote.title}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[
                'Summarize my notes',
                'What connections exist in my vault?',
                'What are the main topics I write about?',
                'Help me brainstorm new ideas',
                ...(aiSettings.internetAccess ? ['Search the web for latest AI news'] : []),
              ].map(q => (
                <button key={q} onClick={() => { setInput(q); inputRef.current?.focus(); }}
                  style={{
                    padding: '8px 12px', background: '#0a0a0a', border: '1px solid #1a1a1a',
                    borderRadius: 6, color: '#555', cursor: 'pointer', fontSize: 11, textAlign: 'left',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#111'; e.currentTarget.style.color = '#888'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#0a0a0a'; e.currentTarget.style.color = '#555'; }}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {aiMessages.map((msg) => (
          <div key={msg.id} style={{ marginBottom: 14 }}>
            <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
              {msg.role === 'user' ? (
                <div style={{ width: 18, height: 18, borderRadius: 4, background: '#141414', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <User size={10} style={{ color: '#555' }} />
                </div>
              ) : (
                <div style={{ width: 18, height: 18, borderRadius: 4, background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FlintStone size={10} />
                </div>
              )}
              <span style={{ fontSize: 10, color: '#444', fontWeight: 500 }}>
                {msg.role === 'user' ? 'You' : 'Flint AI'}
              </span>
              <span style={{ fontSize: 9, color: '#222' }}>
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              {msg.webResults && (
                <span className="flex items-center gap-1" style={{ fontSize: 9, color: '#465' }}>
                  <Globe size={8} /> web
                </span>
              )}
            </div>
            <div style={{
              padding: '10px 14px', borderRadius: 8, fontSize: 12, lineHeight: 1.7,
              background: msg.role === 'user' ? '#0c0c0c' : '#0a0a0a',
              border: `1px solid ${msg.role === 'user' ? '#181818' : '#141414'}`,
              color: msg.role === 'user' ? '#aaa' : '#999',
            }}>
              <MessageContent text={msg.content} />
            </div>
          </div>
        ))}

        {isStreaming && streamContent && (
          <div style={{ marginBottom: 14 }}>
            <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
              <div style={{ width: 18, height: 18, borderRadius: 4, background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FlintStone size={10} />
              </div>
              <span style={{ fontSize: 10, color: '#444', fontWeight: 500 }}>Flint AI</span>
              <Loader2 size={9} className="animate-spin" style={{ color: '#444' }} />
            </div>
            <div style={{
              padding: '10px 14px', borderRadius: 8, fontSize: 12, lineHeight: 1.7,
              background: '#0a0a0a', border: '1px solid #141414', color: '#999',
            }}>
              <MessageContent text={streamContent} />
              <span style={{ display: 'inline-block', width: 6, height: 14, background: '#555', marginLeft: 2, animation: 'blink 1s infinite', verticalAlign: 'text-bottom' }} />
            </div>
          </div>
        )}

        {isStreaming && !streamContent && (
          <div style={{ marginBottom: 14 }}>
            <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
              <div style={{ width: 18, height: 18, borderRadius: 4, background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FlintStone size={10} />
              </div>
              <span style={{ fontSize: 10, color: '#444', fontWeight: 500 }}>Flint AI</span>
            </div>
            <div style={{ padding: '10px 14px', borderRadius: 8, background: '#0a0a0a', border: '1px solid #141414' }}>
              <div className="flex items-center gap-3">
                <Loader2 size={12} className="animate-spin" style={{ color: '#444' }} />
                <span style={{ fontSize: 11, color: '#444' }}>
                  <Zap size={9} style={{ display: 'inline', marginRight: 4 }} />
                  {aiSettings.internetAccess ? 'Searching web & scanning' : 'Scanning'} {memoryStats.notes} notes & {memoryStats.connections} connections...
                </span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Active note + web indicator */}
      <div style={{ padding: '5px 14px', borderTop: '1px solid #1a1a1a', flexShrink: 0, background: '#050505' }}>
        <div style={{ fontSize: 9, color: '#333', display: 'flex', alignItems: 'center', gap: 6 }}>
          {activeNote && (
            <span className="flex items-center gap-1">
              <BookOpen size={8} /> {activeNote.title}
            </span>
          )}
          {aiSettings.internetAccess && (
            <span className="flex items-center gap-1" style={{ color: '#345' }}>
              <Globe size={8} /> Internet on
            </span>
          )}
        </div>
      </div>

      {/* Input area */}
      <div style={{ padding: '10px 14px', borderTop: '1px solid #1a1a1a', flexShrink: 0, background: '#060606' }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              ollamaStatus !== 'connected'
                ? 'Start Ollama to chat...'
                : !aiSettings.model
                ? 'Select a model in settings...'
                : aiSettings.internetAccess
                ? 'Ask anything (notes memory + web)...'
                : 'Ask about your notes...'
            }
            disabled={ollamaStatus !== 'connected'}
            rows={2}
            style={{
              flex: 1, background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 6,
              padding: '8px 10px', color: '#aaa', fontSize: 12, resize: 'none',
              outline: 'none', fontFamily: 'inherit', lineHeight: 1.4,
              opacity: ollamaStatus !== 'connected' ? 0.4 : 1,
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {isStreaming ? (
              <button onClick={stopGeneration} title="Stop"
                style={{ ...sendBtnStyle, background: '#1a0808', color: '#844' }}>
                <Loader2 size={14} />
              </button>
            ) : (
              <button onClick={sendMessage} title="Send (Enter)"
                disabled={!input.trim() || ollamaStatus !== 'connected' || !aiSettings.model}
                style={{
                  ...sendBtnStyle,
                  opacity: !input.trim() || ollamaStatus !== 'connected' || !aiSettings.model ? 0.3 : 1,
                }}>
                <Send size={14} />
              </button>
            )}
            <button onClick={() => dispatch({ type: 'CLEAR_AI_MESSAGES' })} title="Clear chat"
              style={{ ...sendBtnStyle, color: '#444' }}>
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageContent({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <>
      {lines.map((line, i) => {
        if (line.startsWith('### ')) return <div key={i} style={{ fontSize: 12, fontWeight: 700, color: '#bbb', marginTop: 6 }}>{line.slice(4)}</div>;
        if (line.startsWith('## ')) return <div key={i} style={{ fontSize: 13, fontWeight: 700, color: '#ccc', marginTop: 8 }}>{line.slice(3)}</div>;
        if (line.startsWith('# ')) return <div key={i} style={{ fontSize: 14, fontWeight: 700, color: '#ddd', marginTop: 8 }}>{line.slice(2)}</div>;
        if (line.startsWith('```')) return <div key={i} style={{ height: 4 }} />;
        const boldParsed = line.replace(/\*\*(.+?)\*\*/g, '<<BOLD>>$1<</BOLD>>');
        const codeParsed = boldParsed.replace(/`(.+?)`/g, '<<CODE>>$1<</CODE>>');
        const linkParsed = codeParsed.replace(/\[\[(.+?)\]\]/g, '<<LINK>>$1<</LINK>>');
        if (linkParsed.startsWith('- ') || linkParsed.startsWith('* ')) {
          return <div key={i} style={{ paddingLeft: 8 }}><RichText text={linkParsed.slice(2)} /></div>;
        }
        const numMatch = linkParsed.match(/^(\d+)\.\s/);
        if (numMatch) {
          return <div key={i} style={{ paddingLeft: 8 }}><RichText text={linkParsed} /></div>;
        }
        if (!line.trim()) return <div key={i} style={{ height: 6 }} />;
        return <div key={i}><RichText text={linkParsed} /></div>;
      })}
    </>
  );
}

function RichText({ text }: { text: string }) {
  const parts = text.split(/(<<BOLD>>.*?<<\/BOLD>>|<<CODE>>.*?<<\/CODE>>|<<LINK>>.*?<<\/LINK>>)/g);
  return (
    <span>
      {parts.map((part, i) => {
        if (part.startsWith('<<BOLD>>')) {
          return <strong key={i} style={{ color: '#ccc' }}>{part.replace(/<<BOLD>>|<<\/BOLD>>/g, '')}</strong>;
        }
        if (part.startsWith('<<CODE>>')) {
          return <code key={i} style={{ background: '#181818', padding: '1px 4px', borderRadius: 3, fontSize: 11, color: '#888' }}>{part.replace(/<<CODE>>|<<\/CODE>>/g, '')}</code>;
        }
        if (part.startsWith('<<LINK>>')) {
          return <span key={i} style={{ color: '#888', textDecoration: 'underline' }}>{part.replace(/<<LINK>>|<<\/LINK>>/g, '')}</span>;
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

function ConfigField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <span style={{ fontSize: 10, color: '#555', width: 70, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>{children}</div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: '#0a0a0a', border: '1px solid #1a1a1a',
  borderRadius: 4, padding: '5px 8px', color: '#aaa', outline: 'none',
  fontFamily: 'inherit',
};

const sendBtnStyle: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 6, background: '#111',
  border: '1px solid #1a1a1a', color: '#666', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'all 0.15s', flexShrink: 0,
};

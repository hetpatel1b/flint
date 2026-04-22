import type { Note, AISettings } from '../types';

// ============================================================
// Flint AI — Memory + Internet Access
// Notes = memory, Graph = connections, Web = internet
// ============================================================

interface GraphNode {
  id: string;
  title: string;
  connections: Set<string>;
  centrality: number;
}

// Build a knowledge graph from all notes and their [[wiki links]]
function buildKnowledgeGraph(notes: Note[]): Map<string, GraphNode> {
  const graph = new Map<string, GraphNode>();
  notes.forEach(n => {
    graph.set(n.id, { id: n.id, title: n.title, connections: new Set(), centrality: 0 });
  });
  notes.forEach(n => {
    const matches = n.content.matchAll(/\[\[([^\]|]+?)(?:\|[^\]]+)?\]\]/g);
    for (const m of matches) {
      const target = notes.find(nt => nt.title.toLowerCase() === m[1].toLowerCase());
      if (target && target.id !== n.id) {
        graph.get(n.id)!.connections.add(target.id);
        graph.get(target.id)!.connections.add(n.id);
      }
    }
  });
  graph.forEach((node) => { node.centrality = node.connections.size; });
  return graph;
}

// Find shortest path between two notes in the graph
function graphDistance(from: string, to: string, graph: Map<string, GraphNode>): number {
  if (from === to) return 0;
  const visited = new Set<string>([from]);
  const queue: Array<{ id: string; dist: number }> = [{ id: from, dist: 0 }];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const node = graph.get(current.id);
    if (!node) continue;
    for (const neighborId of node.connections) {
      if (neighborId === to) return current.dist + 1;
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        queue.push({ id: neighborId, dist: current.dist + 1 });
      }
    }
  }
  return Infinity;
}

// Score and rank notes by relevance to a query
function scoreNotes(
  query: string,
  notes: Note[],
  activeNoteId: string | null,
  graph: Map<string, GraphNode>,
): Map<string, number> {
  const scores = new Map<string, number>();
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
  const potentialRefs = notes.filter(n => queryLower.includes(n.title.toLowerCase()));

  notes.forEach(note => {
    let score = 0;
    const titleLower = note.title.toLowerCase();
    const contentLower = note.content.toLowerCase();
    const node = graph.get(note.id);

    if (potentialRefs.some(ref => ref.id === note.id)) score += 20;
    queryWords.forEach(w => { if (titleLower.includes(w)) score += 8; });
    queryWords.forEach(w => {
      const matches = contentLower.split(w).length - 1;
      if (matches > 0) score += Math.min(matches * 2, 12);
    });
    if (note.id === activeNoteId) score += 15;
    if (activeNoteId && node?.connections.has(activeNoteId)) score += 8;
    if (activeNoteId) {
      const dist = graphDistance(activeNoteId, note.id, graph);
      if (dist === 1) score += 8;
      else if (dist === 2) score += 4;
      else if (dist === 3) score += 1;
    }
    if (node) score += Math.min(node.centrality * 1.5, 10);
    const tags = note.content.matchAll(/#(\w[\w-]*)/g);
    for (const tag of tags) {
      if (queryWords.some(w => tag[1].toLowerCase().includes(w))) score += 5;
    }
    if (score > 0) scores.set(note.id, score);
  });
  return scores;
}

// Build the memory context string
export function buildMemoryContext(
  notes: Note[],
  activeNoteId: string | null,
  query: string,
  maxNotes: number,
): string {
  if (!notes.length) return 'No notes available in the vault yet.';
  const graph = buildKnowledgeGraph(notes);
  const scores = scoreNotes(query, notes, activeNoteId, graph);
  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]).slice(0, maxNotes);
  const selectedIds = new Set(ranked.map(([id]) => id));
  ranked.forEach(([id]) => {
    const node = graph.get(id);
    if (node) node.connections.forEach(connId => selectedIds.add(connId));
  });
  const selectedNotes = [...selectedIds].slice(0, maxNotes + 5)
    .map(id => notes.find(n => n.id === id)).filter(Boolean) as Note[];
  return formatMemoryContext(selectedNotes, graph, notes, activeNoteId);
}

function formatMemoryContext(
  selectedNotes: Note[],
  graph: Map<string, GraphNode>,
  allNotes: Note[],
  activeNoteId: string | null,
): string {
  const lines: string[] = [];
  lines.push('=== YOUR MEMORY (Flint Vault Knowledge Base) ===');
  lines.push(`Total notes in vault: ${allNotes.length}`);
  lines.push('');
  lines.push('=== MEMORY MAP (Note Connections) ===');
  const sortedByConnections = [...graph.entries()]
    .sort((a, b) => b[1].connections.size - a[1].connections.size);
  for (const [, node] of sortedByConnections) {
    if (node.connections.size > 0) {
      const connNames = [...node.connections]
        .map(id => allNotes.find(n => n.id === id)?.title).filter(Boolean);
      if (connNames.length) {
        lines.push(`"${node.title}" → ${connNames.map(n => `"${n}"`).join(', ')}`);
      }
    }
  }
  lines.push('');
  if (activeNoteId) {
    const activeNote = allNotes.find(n => n.id === activeNoteId);
    if (activeNote) {
      const node = graph.get(activeNoteId);
      const neighbors = node ? [...node.connections]
        .map(id => allNotes.find(n => n.id === id)?.title).filter(Boolean) : [];
      lines.push(`=== CURRENTLY OPEN NOTE ===`);
      lines.push(`Title: "${activeNote.title}"`);
      if (neighbors.length) lines.push(`Connected to: ${neighbors.join(', ')}`);
      lines.push(activeNote.content.length > 3000
        ? activeNote.content.slice(0, 3000) + '\n...[truncated]'
        : activeNote.content);
      lines.push('');
    }
  }
  lines.push('=== RELATED MEMORIES (Relevant Notes) ===');
  for (const note of selectedNotes) {
    if (note.id === activeNoteId) continue;
    const node = graph.get(note.id);
    const neighbors = node ? [...node.connections]
      .map(id => allNotes.find(n => n.id === id)?.title).filter(Boolean) : [];
    lines.push(`\n--- Note: "${note.title}" ---`);
    if (neighbors.length) lines.push(`Connected to: ${neighbors.join(', ')}`);
    const content = note.content.length > 1500
      ? note.content.slice(0, 1500) + '\n...[truncated]'
      : note.content;
    lines.push(content);
  }
  lines.push('');
  lines.push('=== INSTRUCTIONS ===');
  lines.push('Use the above memory to answer the user\'s question.');
  lines.push('Reference specific note names when mentioning information from them.');
  lines.push('If information isn\'t in the notes, say so honestly.');
  lines.push('You can suggest creating new notes or connections between existing ones.');
  return lines.join('\n');
}

// ============================================================
// Web Search — Internet Access for the Agent
// ============================================================

interface SearchResult {
  title: string;
  snippet: string;
  url: string;
}

// Search Wikipedia
async function searchWikipedia(query: string): Promise<SearchResult[]> {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=5&format=json&origin=*`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const data = await res.json();
    const results: SearchResult[] = [];
    if (data[1] && data[2] && data[3]) {
      for (let i = 0; i < data[1].length; i++) {
        if (data[2][i]) {
          results.push({
            title: data[1][i],
            snippet: data[2][i],
            url: data[3][i] || '',
          });
        }
      }
    }
    return results;
  } catch {
    return [];
  }
}

// Get Wikipedia article summary
async function getWikiSummary(title: string): Promise<string> {
  try {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return '';
    const data = await res.json();
    return data.extract || '';
  } catch {
    return '';
  }
}

// Main web search function
export async function webSearch(query: string): Promise<string> {
  const results = await searchWikipedia(query);
  if (results.length === 0) return 'No web results found.';

  // Get detailed summaries for top results
  const detailed: string[] = [];
  for (let i = 0; i < Math.min(results.length, 3); i++) {
    const summary = await getWikiSummary(results[i].title);
    if (summary) {
      detailed.push(`**${results[i].title}**: ${summary}`);
    }
  }

  if (detailed.length > 0) {
    return `=== WEB SEARCH RESULTS for "${query}" ===\n\n${detailed.join('\n\n')}\n\n=== END WEB RESULTS ===`;
  }

  // Fallback to snippets
  const snippets = results.map(r => `- ${r.title}: ${r.snippet}`).join('\n');
  return `=== WEB SEARCH RESULTS for "${query}" ===\n${snippets}\n=== END WEB RESULTS ===`;
}

// Check if a query likely needs internet access
function needsInternet(query: string): boolean {
  const internetKeywords = [
    'what is', 'who is', 'when was', 'where is', 'how does',
    'latest', 'recent', 'current', 'today', 'news', 'weather',
    'price', 'stock', 'score', 'update', 'new', 'trending',
    'search', 'look up', 'find out', 'google', 'internet', 'web',
    'explain', 'define', 'meaning of', 'tell me about',
    'compare', 'difference between', 'vs', 'versus',
    'best', 'top', 'popular', 'recommended',
    'how to', 'tutorial', 'guide', 'learn',
  ];
  const lower = query.toLowerCase();
  // Short factual questions likely need internet
  if (query.split(/\s+/).length <= 6) return true;
  return internetKeywords.some(kw => lower.includes(kw));
}

// ============================================================
// Ollama API — Works with ANY model
// ============================================================

export async function chatWithOllama(
  messages: { role: string; content: string }[],
  settings: AISettings,
  onChunk: (chunk: string) => void,
  onDone: () => void,
  onError: (err: string) => void,
): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180000); // 3 min timeout

  try {
    const response = await fetch(`${settings.ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: settings.model,
        messages,
        stream: true,
        options: {
          temperature: settings.temperature,
          num_ctx: 8192,
          top_p: 0.9,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      // Try to parse Ollama error for helpful message
      try {
        const errJson = JSON.parse(errText);
        if (errJson.error?.includes('not found') || errJson.error?.includes('model')) {
          throw new Error(`Model "${settings.model}" not found. Run: ollama pull ${settings.model}`);
        }
        throw new Error(errJson.error || `Ollama error (${response.status})`);
      } catch (parseErr) {
        if (parseErr instanceof Error && parseErr.message.includes('not found')) throw parseErr;
        throw new Error(`Ollama error (${response.status}): ${errText || response.statusText}`);
      }
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response stream');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const json = JSON.parse(line);
          if (json.message?.content) {
            onChunk(json.message.content);
          }
          if (json.done) {
            clearTimeout(timeout);
            onDone();
            return;
          }
        } catch {
          // skip malformed lines
        }
      }
    }
    clearTimeout(timeout);
    onDone();
  } catch (err: unknown) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === 'AbortError') {
      onError('Request timed out after 3 minutes. Try a shorter query or a faster model.');
    } else {
      const msg = err instanceof Error ? err.message : String(err);
      onError(msg);
    }
  }
}

// Fetch available models from Ollama
export async function fetchOllamaModels(url: string): Promise<string[]> {
  try {
    const res = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.models || []).map((m: { name: string }) => m.name);
  } catch {
    return [];
  }
}

// Check if Ollama is running
export async function checkOllamaStatus(url: string): Promise<'connected' | 'disconnected'> {
  try {
    const res = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(3000) });
    return res.ok ? 'connected' : 'disconnected';
  } catch {
    return 'disconnected';
  }
}

// ============================================================
// Main AI Chat Function — orchestrates everything
// ============================================================

export async function askFlintAI(
  userQuery: string,
  notes: Note[],
  activeNoteId: string | null,
  settings: AISettings,
  chatHistory: { role: string; content: string }[],
  onChunk: (chunk: string) => void,
  onDone: (fullContent: string, webResults?: string) => void,
  onError: (err: string) => void,
): Promise<void> {
  // 1. Build memory from notes + graph
  const memory = buildMemoryContext(notes, activeNoteId, userQuery, settings.maxContextNotes);

  // 2. Search the web if internet access is enabled
  let webResults = '';
  if (settings.internetAccess && needsInternet(userQuery)) {
    try {
      webResults = await webSearch(userQuery);
    } catch {
      webResults = ''; // Silently fail web search
    }
  }

  // 3. Build the full system prompt
  const activeNote = notes.find(n => n.id === activeNoteId);
  let systemContent = `${settings.systemPrompt}\n\n${memory}`;

  if (webResults) {
    systemContent += `\n\n=== INTERNET ACCESS ===\nYou have internet access. Here are web search results for the user's query:\n${webResults}\n\nUse these web results alongside your memory to give comprehensive answers. Cite web sources when using them.`;
  } else if (settings.internetAccess) {
    systemContent += '\n\n=== INTERNET ACCESS ===\nYou have internet access enabled but no specific web results were found for this query. Answer from your training data if you can, and say if you\'re unsure.';
  }

  systemContent += `\n\nCurrent active note: "${activeNote?.title || 'None'}"`;

  // 4. Build messages array
  const ollamaMessages = [
    { role: 'system', content: systemContent },
    ...chatHistory.slice(-10),
    { role: 'user', content: userQuery },
  ];

  // 5. Stream from Ollama
  let fullContent = '';
  await chatWithOllama(
    ollamaMessages,
    settings,
    (chunk) => {
      fullContent += chunk;
      onChunk(chunk);
    },
    () => {
      onDone(fullContent, webResults || undefined);
    },
    onError,
  );
}

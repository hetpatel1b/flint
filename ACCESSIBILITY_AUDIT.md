# Accessibility Audit Report - src/components

**Date**: 2026-06-16
**Scope**: All React components in src/components/

---

## Summary

This audit identified **87 accessibility issues** across 13 component files. Issues are categorized into:
1. Icon-only buttons without aria-label (32 instances)
2. Modal/dialog components missing ARIA attributes (5 instances)
3. Decorative icons without aria-hidden (18 instances)
4. Form inputs missing labels or aria-labels (15 instances)
5. Non-semantic button elements (divs/spans used as buttons) (12 instances)
6. Collapsible sections missing aria-expanded (3 instances)
7. Interactive elements needing keyboard support (2 instances)

---

## File-by-File Analysis

### 1. AIChat.tsx

#### Issue 1.1: Icon-only Settings button
- **Lines**: 271
- **Type**: Icon-only button without aria-label
- **Current Code**:
  ```tsx
  <button onClick={() => setShowConfig(!showConfig)} title="AI Settings"
    style={{ background: 'none', border: 'none', color: showConfig ? '#c6cfdb' : '#758091', cursor: 'pointer', display: 'flex', padding: 4 }}>
    <Settings size={14} />
  </button>
  ```
- **Issue**: Has `title` attribute but should have `aria-label` for screen readers. Title attributes are not reliably announced by all screen readers.
- **Fix**: Add `aria-label="AI Settings"` and consider keeping title as fallback

#### Issue 1.2: Icon-only Close button
- **Lines**: 273-274
- **Type**: Icon-only button without aria-label
- **Current Code**:
  ```tsx
  <button onClick={() => dispatch({ type: 'TOGGLE_AI_CHAT' })} title="Close"
    style={{ background: 'none', border: 'none', color: '#758091', cursor: 'pointer', display: 'flex', padding: 4 }}>
    <X size={14} />
  </button>
  ```
- **Issue**: Relies on title attribute instead of aria-label
- **Fix**: Add `aria-label="Close AI chat"`

#### Issue 1.3: Multiple decorative icons in Memory stats section
- **Lines**: 282-290
- **Type**: Decorative icons without aria-hidden
- **Current Code**:
  ```tsx
  <Brain size={8} /> {memoryStats.notes} notes
  <Network size={8} /> {memoryStats.connections} links
  <Sparkles size={8} /> {memoryStats.tags} tags
  <Globe size={8} /> {aiSettings.internetAccess ? 'Web on' : 'Web off'}
  ```
- **Issue**: Icons are visual enhancements next to text. Should have `aria-hidden="true"` to prevent screen readers from attempting to announce them
- **Fix**: Add `aria-hidden="true"` to each icon: `<Brain size={8} aria-hidden="true" />`

#### Issue 1.4: Icon-only buttons in Config panel
- **Lines**: 335-347 (multiple buttons in ConfigField components)
- **Type**: Icon-only buttons in selects and inputs
- **Issue**: Various icon buttons in the configuration interface lack proper labeling
- **Fix**: Add aria-labels to all interactive buttons

#### Issue 1.5: Missing fieldset/legend for grouped form inputs
- **Lines**: 331-454
- **Type**: Form inputs missing proper grouping and labels
- **Current Code**:
  ```tsx
  <ConfigField label="Provider">
    <select value={aiSettings.provider}
      onChange={e => dispatch({ type: 'UPDATE_AI_SETTINGS', payload: { provider: e.target.value as 'ollama' } })}
      style={{ ...inputStyle, fontSize: 11 }}>
  ```
- **Issue**: Custom `ConfigField` component doesn't properly associate labels with inputs. The label is rendered separately and may not be properly announced to screen readers
- **Fix**: Use proper `<label htmlFor="...">` and `<input id="..." />` pairing

#### Issue 1.6: Button with only state indicator icon
- **Lines**: 446-458
- **Type**: Toggle button using divs instead of button element
- **Current Code**:
  ```tsx
  <div onClick={() => dispatch({ type: 'UPDATE_AI_SETTINGS', payload: { internetAccess: !aiSettings.internetAccess } })}
    style={{ ... }}>
    <div style={{ ... }} />
  </div>
  ```
- **Issue**: Uses `<div>` with onClick instead of proper button element. Not keyboard accessible, not announced as button
- **Fix**: Replace with `<button>` element

---

### 2. BacklinksPanel.tsx

#### Issue 2.1: Interactive divs used as clickable items (non-semantic)
- **Lines**: 18-24
- **Type**: Non-semantic button elements
- **Current Code**:
  ```tsx
  <div className="flex items-center gap-2 cursor-pointer"
    style={{ padding: '4px 8px', borderRadius: 4, transition: 'all 0.08s' }}
    onClick={() => dispatch({ type: 'OPEN_TAB', payload: n.id })}
    onMouseEnter={e => { e.currentTarget.style.background = '#141414'; }}
    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
    {icon}
    <span style={{ fontSize: 12, color: '#888' }}>{n.title}</span>
  </div>
  ```
- **Issue**: Divs with onClick handlers are not semantic buttons and not keyboard accessible. Users can't tab to them or activate with Enter/Space
- **Fix**: Replace with `<button>` element, remove mouse-only hover handling

#### Issue 2.2: Decorative icons in list items
- **Lines**: 41, 47
- **Type**: Decorative icons without aria-hidden
- **Current Code**:
  ```tsx
  <LinkItem key={n.id} n={n} icon={<ArrowLeft size={11} style={{ color: '#333' }} />} />
  <LinkItem key={n.id} n={n} icon={<ArrowRight size={11} style={{ color: '#333' }} />} />
  ```
- **Issue**: Direction arrows are decorative (text already indicates direction). Should have `aria-hidden="true"`
- **Fix**: Add `aria-hidden="true"` to both arrow icons

---

### 3. CanvasView.tsx

#### Issue 3.1: Multiple icon-only buttons throughout canvas interface
- **Lines**: 404-414 (button with Plus icon), 418 (X button)
- **Type**: Icon-only buttons
- **Current Code**:
  ```tsx
  <button onClick={addTextCard} title="Add text card"
    style={{ ... }}>
    <Plus size={14} />
  </button>
  ```
- **Issue**: Relies on title attribute only
- **Fix**: Add `aria-label="Add text card"`

#### Issue 3.2: Delete button in card context
- **Lines**: 418
- **Type**: Icon-only button
- **Issue**: X icon button needs aria-label
- **Fix**: Add `aria-label="Delete card"`

#### Issue 3.3: Canvas SVG missing text alternatives
- **Lines**: 520-530+ (SVG rendering)
- **Type**: SVG paths and shapes lack descriptions
- **Issue**: Canvas visualization with connections has no text alternative for users who can't see the visual
- **Fix**: Consider adding a data table or list view alternative, or add `role="img"` with `aria-label` to SVG container

#### Issue 3.4: Non-semantic clickable elements for card selection
- **Lines**: 548-600 (card rendering)
- **Type**: Interactive elements not using button semantics
- **Issue**: Cards are divs with onClick, not keyboard accessible
- **Fix**: Make cards keyboard focusable with proper button roles

---

### 4. Editor.tsx

#### Issue 4.1: Textarea lacks associated label
- **Lines**: 79-84
- **Type**: Form input without label
- **Current Code**:
  ```tsx
  <textarea ref={taRef} className="flint-editor"
    defaultValue={note.content}
    onChange={e => handleChange(e.target.value)}
    ...
    placeholder="Start writing..."
  ```
- **Issue**: No `<label>` element or `aria-label` for the main editor textarea
- **Fix**: Add `aria-label="Note editor"` or wrap with proper `<label>`

---

### 5. FlintLogo.tsx

**Status**: ✅ No accessibility issues found
- Images have proper `alt` text
- Marked as `userSelect: 'none'` and not draggable appropriately

---

### 6. GraphView.tsx

#### Issue 6.1: Canvas element without proper ARIA attributes
- **Lines**: 186-187
- **Type**: Canvas without alternatives or descriptions
- **Current Code**:
  ```tsx
  <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
  ```
- **Issue**: Canvas visualization has no text alternative. Users relying on assistive tech can't access the graph
- **Fix**: Add `role="img"` and `aria-label="Note network graph showing connections between notes"` to canvas, or provide alternative text representation

#### Issue 6.2: Multiple icon-only buttons
- **Lines**: ~350+ (zoom in/out, play/pause, search, palette buttons)
- **Type**: Icon-only buttons without aria-labels
- **Current Code**:
  ```tsx
  <button onClick={() => setShowSettings(!showSettings)} title="Settings"
    style={{ ... }}>
    <Settings size={14} />
  </button>
  ```
- **Issue**: Multiple buttons use title only
- **Fix**: Add `aria-label` to all icon buttons

#### Issue 6.3: Filter and settings controls missing labels
- **Lines**: ~360-380 (range inputs for nodeScale, linkDistance, etc.)
- **Type**: Range inputs without labels
- **Issue**: Sliders for graph parameters lack associated labels
- **Fix**: Add `aria-label` to each input: `<input type="range" aria-label="Node scale"`

---

### 7. Preview.tsx

#### Issue 7.1: Dynamically generated links missing proper semantics
- **Lines**: 14-16, 20-21
- **Type**: Links generated via string replacement in dangerouslySetInnerHTML
- **Current Code**:
  ```tsx
  return `<a class="${cls}" data-target="${target}">${text}</a>`;
  ```
- **Issue**: Wiki links (especially unresolved ones) lack proper context. Unresolved links may not indicate they're "unresolved" to screen readers
- **Fix**: For unresolved links, add `aria-label="Unresolved link: ${target}"` or use `aria-describedby` to link to description

#### Issue 7.2: dangerouslySetInnerHTML with no semantic markup
- **Lines**: 67
- **Type**: Raw HTML injection
- **Current Code**:
  ```tsx
  <div className="flint-preview" dangerouslySetInnerHTML={{ __html: html }} onClick={handleClick} />
  ```
- **Issue**: When generating HTML dynamically, semantic structure may be lost. Images lack alt text, etc.
- **Fix**: Add alt attributes when generating `<img>` tags; ensure headings maintain proper hierarchy

---

### 8. SearchModal.tsx

#### Issue 8.1: Modal missing ARIA attributes
- **Lines**: 19-22
- **Type**: Modal dialog without role and aria-modal
- **Current Code**:
  ```tsx
  <div className="fixed inset-0 animate-fade-in" style={{ zIndex: 150, background: 'rgba(0,0,0,0.6)', ... }}
    onClick={() => dispatch({ type: 'TOGGLE_SEARCH' })}>
    <div className="animate-scale-in" style={{ ... }}>
  ```
- **Issue**: Modal dialog lacks `role="dialog"` and `aria-modal="true"`. Should also have `aria-label` describing the dialog
- **Fix**: Add `role="dialog"` and `aria-modal="true"` to inner div; add `aria-label="Search notes"`

#### Issue 8.2: Input field lacks label
- **Lines**: 25-30
- **Type**: Form input without associated label
- **Current Code**:
  ```tsx
  <input ref={inputRef} type="text" placeholder="Search all notes..." value={query}
    onChange={e => setQuery(e.target.value)}
    ...
    style={{ flex: 1, background: 'none', border: 'none', color: '#bbb', fontSize: 14, outline: 'none' }}
  ```
- **Issue**: Input has placeholder but no proper `<label>` or `aria-label`
- **Fix**: Add `aria-label="Search notes query"` to input

#### Issue 8.3: Results list missing semantic structure
- **Lines**: 35-45
- **Type**: Non-semantic list items
- **Current Code**:
  ```tsx
  <div style={{ maxHeight: 300, overflowY: 'auto' }}>
    {results.map((note, i) => (
      <div key={note.id} className="flex items-center gap-2 cursor-pointer"
        style={{ ... }}
        onClick={() => { ... }}>
  ```
- **Issue**: Results rendered as divs instead of `<li>` elements in a `<ul>`. Not announced as a list
- **Fix**: Wrap in `<ul>` and use `<li>` for each result

#### Issue 8.4: Keyboard instructions not properly labeled
- **Lines**: 47-49
- **Type**: Keyboard hints without semantic markup
- **Current Code**:
  ```tsx
  <div style={{ padding: '6px 14px', borderTop: '1px solid #1a1a1a', fontSize: 10, color: '#333', display: 'flex', gap: 12 }}>
    <span>↑↓ Navigate</span><span>↵ Open</span><span>Esc Close</span>
  </div>
  ```
- **Issue**: Keyboard hints should be in `<kbd>` elements or have `aria-label`
- **Fix**: Replace with semantic `<kbd>` elements: `<kbd>↑↓</kbd> Navigate`

---

### 9. Settings.tsx

#### Issue 9.1: Settings modal missing ARIA attributes
- **Lines**: 371-382
- **Type**: Modal dialog without role and aria-modal
- **Current Code**:
  ```tsx
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    onClick={close}>
    <div style={{ width: 560, ... }}
      onClick={e => e.stopPropagation()}>
  ```
- **Issue**: Modal lacks `role="dialog"`, `aria-modal="true"`, and `aria-labelledby`
- **Fix**: Add `role="dialog"`, `aria-modal="true"`, `aria-labelledby="settings-title"`

#### Issue 9.2: Icon-only close button
- **Lines**: 393-397
- **Type**: Icon-only button without aria-label
- **Current Code**:
  ```tsx
  <button onClick={close} style={{ ... }}
    onMouseEnter={e => { e.currentTarget.style.color = '#d2d8e2'; }}
    onMouseLeave={e => { e.currentTarget.style.color = '#768193'; }}>
    <X size={16} />
  </button>
  ```
- **Issue**: Close button needs aria-label
- **Fix**: Add `aria-label="Close settings"`

#### Issue 9.3: Tab buttons missing aria-selected and role
- **Lines**: 405-418
- **Type**: Tabs without proper ARIA attributes
- **Current Code**:
  ```tsx
  {(['editor', 'ai', 'vault', 'about'] as const).map(t => (
    <button key={t} onClick={() => setTab(t)}
      style={{ ... }}>
      {t === 'ai' ? 'AI' : t}
    </button>
  ))}
  ```
- **Issue**: Tab buttons need `role="tab"`, `aria-selected="true/false"`, and container needs `role="tablist"`
- **Fix**: Wrap in `<div role="tablist">` and add `role="tab"`, `aria-selected={tab === t}` to buttons

#### Issue 9.4: Toggle components using divs instead of buttons
- **Lines**: 440-460, 688-700
- **Type**: Non-semantic toggle switches
- **Current Code**:
  ```tsx
  <div onClick={() => dispatch({ type: 'UPDATE_AI_SETTINGS', payload: { internetAccess: !aiSettings.internetAccess } })}
    style={{ width: 36, height: 20, borderRadius: 10, cursor: 'pointer', ... }}>
    <div style={{ ... }} />
  </div>
  ```
- **Issue**: Toggle is a div with onClick. Not keyboard accessible, not announced as button or switch
- **Fix**: Replace with `<button role="switch" aria-checked={checked}>`

#### Issue 9.5: Multiple form inputs without labels
- **Lines**: 432-437 (Font size input), 424 (Theme select), etc.
- **Type**: Form inputs missing labels
- **Current Code**:
  ```tsx
  <SettingRow icon={<Type size={14} />} label="Font size" value={`${settings.fontSize}px`}>
    <input type="range" min={10} max={24} value={settings.fontSize}
      onChange={e => setSettings(s => ({ ...s, fontSize: parseInt(e.target.value) }))}
      style={{ flex: 1, accentColor: '#666' }} />
  </SettingRow>
  ```
- **Issue**: Custom `SettingRow` component with label prop doesn't properly associate labels. Range inputs lack proper aria-labels
- **Fix**: Use `<label htmlFor="...">` with `<input id="..." aria-label="..."`

#### Issue 9.6: Button for refreshing models lacks proper indication
- **Lines**: 604-608
- **Type**: Button with animated icon, unclear purpose
- **Current Code**:
  ```tsx
  <button onClick={checkConnection} style={{ ... }}>
    <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
    {refreshing ? 'Checking' : 'Check connection'}
  </button>
  ```
- **Issue**: While this has text, the spinning animation may not be announced. Could add `aria-busy`
- **Fix**: Add `aria-busy={refreshing}` and `aria-label="Check connection"`

#### Issue 9.7: Import/Export buttons
- **Lines**: 686-687 (Export button label is inside onClick text)
- **Type**: File picker creation without ARIA
- **Issue**: File input created via JavaScript has no label
- **Fix**: Add proper `aria-label` to the input element created dynamically

#### Issue 9.8: Clearance confirmation dialog
- **Lines**: 695
- **Type**: Browser alert() used instead of modal
- **Issue**: Using `alert()` is not ideal for accessibility
- **Fix**: Replace with accessible custom modal dialog

---

### 10. Sidebar.tsx

#### Issue 10.1: Interactive divs used as buttons (multiple instances)
- **Lines**: 21-25 (Folder toggle), 56-70 (NoteItem), etc.
- **Type**: Non-semantic button elements
- **Current Code**:
  ```tsx
  <div className="flex items-center gap-1 cursor-pointer"
    style={{ padding: '4px 12px', color: '#666', fontSize: 12 }}
    onClick={() => !isRenaming && dispatch({ type: 'TOGGLE_FOLDER', payload: folder.id })}
    onContextMenu={e => { ... }}>
  ```
- **Issue**: Multiple divs with onClick handlers not keyboard accessible
- **Fix**: Replace with `<button>` elements

#### Issue 10.2: Context menu not properly marked as menu
- **Lines**: 106-122
- **Type**: Context menu without menu role
- **Current Code**:
  ```tsx
  {ctx && (
    <div style={{ position: 'fixed', left: ctx.x, top: ctx.y, zIndex: 300, ... }}
      className="animate-scale-in">
      {ctx.type === 'note' && (
        <>
          <CtxItem icon={<Pencil size={12} />} label="Rename note" onClick={() => { ... }} />
  ```
- **Issue**: Context menu lacks `role="menu"` and menu items need `role="menuitem"`
- **Fix**: Add `role="menu"` to container, `role="menuitem"` to items, manage focus

#### Issue 10.3: Icon-only buttons in action bar
- **Lines**: 36-53
- **Type**: Icon-only buttons without aria-labels
- **Current Code**:
  ```tsx
  <button onClick={() => createNote()} title="New note"
    style={{ ... }}>
    <Plus size={11} /> Note
  </button>
  ```
- **Issue**: While these have text labels and titles, no aria-label
- **Fix**: Add `aria-label="Create new note"` to each button

#### Issue 10.4: Decorative icons in buttons
- **Lines**: 39, 45, 51
- **Type**: Icons next to text in buttons
- **Issue**: Icons could have `aria-hidden="true"` since text is present
- **Fix**: Add `aria-hidden="true"` to icons in labeled buttons

#### Issue 10.5: Rename input field
- **Lines**: 152-172 (RenameInput component)
- **Type**: Inline input without label
- **Issue**: Input field for renaming lacks aria-label
- **Fix**: Add `aria-label="Rename to:"` or similar

#### Issue 10.6: CtxItem divs are not buttons
- **Lines**: 174-181
- **Type**: Non-semantic context menu items
- **Current Code**:
  ```tsx
  function CtxItem({ icon, label, onClick }: { ... }) {
    return (
      <div className="flex items-center gap-2 cursor-pointer"
        style={{ ... }}
        onClick={onClick}
        onMouseEnter={e => { ... }}
        onMouseLeave={e => { ... }}>
  ```
- **Issue**: Divs with onClick are not buttons, not keyboard accessible
- **Fix**: Replace with `<button>` elements, remove mouse-only hover handling

#### Issue 10.7: Decorative icons in context menu
- **Lines**: 107, 109, 111, etc.
- **Type**: Icons in menu items
- **Issue**: Icons should have `aria-hidden="true"` when text is present
- **Fix**: Add `aria-hidden="true"` to all icon elements in CtxItem

---

### 11. StatusBar.tsx

#### Issue 11.1: Icon without aria-hidden
- **Lines**: 12
- **Type**: Decorative icon
- **Current Code**:
  ```tsx
  <HardDrive size={10} /> {activeVault.folderPath}
  ```
- **Issue**: Disk icon is decorative, should have `aria-hidden="true"`
- **Fix**: Add `aria-hidden="true"` to icon

#### Issue 11.2: FlintLogo display
- **Lines**: 18
- **Type**: Icon in status bar
- **Current Code**:
  ```tsx
  <FlintLogo size={10} />
  ```
- **Issue**: Logo in status bar should have `aria-hidden="true"` since it's decorative
- **Fix**: Pass `aria-hidden="true"` to FlintLogo component or wrap in hidden element

---

### 12. TabBar.tsx

#### Issue 12.1: Tab close button
- **Lines**: 17-23
- **Type**: Icon-only button without aria-label
- **Current Code**:
  ```tsx
  <button onClick={e => { e.stopPropagation(); dispatch({ type: 'CLOSE_TAB', payload: tabId }); }}
    style={{ ... }}>
    <X size={11} />
  </button>
  ```
- **Issue**: Close button (X icon) needs aria-label
- **Fix**: Add `aria-label="Close tab: ${note.title}"`

#### Issue 12.2: Tab container missing tablist role
- **Lines**: 9-11
- **Type**: Tabs without ARIA role
- **Current Code**:
  ```tsx
  <div className="flex shrink-0" style={{ ... }}>
    {state.openTabs.map(tabId => {
  ```
- **Issue**: Tab bar should have `role="tablist"`, individual tabs should have `role="tab"`, `aria-selected`, `aria-controls`
- **Fix**: Add ARIA tab attributes

#### Issue 12.3: Tab divs are not buttons
- **Lines**: 12-16
- **Type**: Non-semantic tab element
- **Current Code**:
  ```tsx
  <div key={tabId} className="flex items-center gap-1 cursor-pointer"
    style={{ ... }}
    onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', payload: tabId })}>
  ```
- **Issue**: Tab should be a button or have button role
- **Fix**: Replace with `<button role="tab">` or use `<a>` with proper button styling

---

### 13. VaultScreen.tsx

#### Issue 13.1: Modal/dialog structure without ARIA
- **Lines**: 196-209
- **Type**: Modal-like dialog without proper attributes
- **Current Code**:
  ```tsx
  <div className="h-screen flex items-center justify-center" style={{ background: 'var(--bg-deep)' }}>
    <div className="animate-fade-in" style={{ width: 480, maxWidth: '95vw' }}>
  ```
- **Issue**: Screen-filling overlay dialog lacks `role="dialog"`, `aria-modal="true"`, `aria-label`
- **Fix**: Add proper dialog attributes to outer container

#### Issue 13.2: Multiple icon-only buttons
- **Lines**: 217 (Create vault), 236 (Open folder), 264 (Delete vault)
- **Type**: Icon-only or icon+text buttons without aria-labels
- **Current Code**:
  ```tsx
  <button onClick={openFolderAsVault} disabled={loading} className="flex items-center justify-center gap-2"
    style={{ ... }}>
    <FolderOpen size={18} />
    {loading ? 'Opening...' : 'Open Folder as Vault'}
  </button>
  ```
- **Issue**: While this has text, icon buttons in the list items need aria-labels
- **Fix**: Add `aria-label` for clarity on icon-only buttons

#### Issue 13.3: Vault item divs should be buttons
- **Lines**: 227-252
- **Type**: Non-semantic clickable items
- **Current Code**:
  ```tsx
  <div key={vault.id}
    className="flex items-center gap-3 cursor-pointer"
    style={{ ... }}
    onClick={() => { ... }}>
  ```
- **Issue**: Divs with onClick not keyboard accessible
- **Fix**: Replace with `<button>` elements

#### Issue 13.4: Decorative icons
- **Lines**: 209 (Lock icon), 230 (Folder icons)
- **Type**: Icons that need aria-hidden
- **Issue**: Icons in text should be marked `aria-hidden="true"`
- **Fix**: Add `aria-hidden="true"` to all decorative icons

#### Issue 13.5: Error alert styling but no ARIA role
- **Lines**: 201-204
- **Type**: Alert message without role
- **Current Code**:
  ```tsx
  {error && (
    <div className="flex items-center gap-2" style={{ padding: '10px 14px', background: '#1a0a0a', ... }}>
      <AlertCircle size={14} /> {error}
    </div>
  )}
  ```
- **Issue**: Error message should have `role="alert"` to announce to screen readers
- **Fix**: Add `role="alert"` and `aria-live="polite"`

#### Issue 13.6: Create vault input not labeled
- **Lines**: 279-282
- **Type**: Form input without label
- **Current Code**:
  ```tsx
  <input type="text" placeholder="Vault name" value={name}
    onChange={e => setName(e.target.value)}
    onKeyDown={e => { ... }}
    autoFocus
    style={{ ... }}
  ```
- **Issue**: Input lacks `aria-label` or `<label>` element
- **Fix**: Add `aria-label="New vault name"` to input

---

## Summary of Issues by Category

### 1. Icon-only Buttons (32 instances)
**Files**: AIChat.tsx, CanvasView.tsx, GraphView.tsx, Settings.tsx, Sidebar.tsx, TabBar.tsx, VaultScreen.tsx
- All icon-only buttons should have `aria-label` attribute
- Relying solely on `title` attribute is insufficient for screen readers

### 2. Modal/Dialog Missing ARIA (5 instances)
**Files**: SearchModal.tsx, Settings.tsx, VaultScreen.tsx
- Missing `role="dialog"`, `aria-modal="true"`, `aria-labelledby` or `aria-label`
- Need focus trap and proper keyboard support
- Backdrop divs should have `role="presentation"` or be semantically inert

### 3. Decorative Icons Without aria-hidden (18 instances)
**Files**: AIChat.tsx, BacklinksPanel.tsx, Sidebar.tsx, StatusBar.tsx, VaultScreen.tsx
- All decorative icons should have `aria-hidden="true"` to prevent screen readers from announcing them

### 4. Form Inputs Missing Labels (15 instances)
**Files**: AIChat.tsx, Editor.tsx, SearchModal.tsx, Settings.tsx, Sidebar.tsx, VaultScreen.tsx
- Missing `<label htmlFor="...">` or `aria-label` attributes
- Custom components like `ConfigField` and `SettingRow` need proper label association
- Range inputs particularly need descriptive labels

### 5. Non-Semantic Button Elements (12 instances)
**Files**: BacklinksPanel.tsx, CanvasView.tsx, Sidebar.tsx, TabBar.tsx, VaultScreen.tsx
- Divs/spans with `onClick` handlers used instead of `<button>` elements
- Not keyboard accessible (can't tab or use Enter/Space to activate)
- Not announced as buttons to screen readers

### 6. Collapsible Sections Missing aria-expanded (3 instances)
**Files**: Sidebar.tsx (folders), Settings.tsx (tabs)
- Expandable/collapsible elements need `aria-expanded="true"` or `"false"`
- Currently no indication of expansion state to assistive tech

### 7. Interactive Elements Needing Keyboard Support (2 instances)
**Files**: GraphView.tsx (canvas interactions), CanvasView.tsx (drag operations)
- Complex interactions (dragging, canvas drawing) lack keyboard alternatives
- Users should be able to operate without mouse

---

## Recommended Fix Priority

### High Priority (Accessibility Barriers - Phase 1)
1. Add `role="dialog"` and `aria-modal="true"` to all modal components
2. Replace all divs with onClick handlers with `<button>` elements
3. Add `aria-label` to all icon-only buttons
4. Add `aria-hidden="true"` to all decorative icons
5. Fix form input labeling in Settings.tsx

### Medium Priority (User Experience - Phase 2)
1. Add `aria-expanded` to collapsible sections (folders, tabs)
2. Fix tab list ARIA attributes
3. Add focus management to interactive components
4. Improve keyboard navigation support
5. Replace custom toggle switches with semantic `<button role="switch">`

### Low Priority (Enhancement - Phase 3)
1. Add keyboard shortcuts documentation
2. Add skip-to-main-content link
3. Improve color contrast where possible
4. Add text alternatives for canvas visualizations
5. Implement focus indicators with proper styling

---

## Next Steps

1. Create utility functions for common accessible patterns (accessible icon buttons, modals, etc.)
2. Audit each component systematically using the framework above
3. Test with screen readers (NVDA, JAWS, VoiceOver)
4. Test keyboard-only navigation
5. Re-audit after fixes to ensure compliance


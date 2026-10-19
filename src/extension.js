'use strict';
const vscode = require('vscode');
const path = require('node:path');
const { Worker } = require('node:worker_threads');
const { GitReader, MAX_BYTES } = require('./git');
const { Scheduler } = require('./scheduler');
const { rejectText, digest } = require('./diff');

async function activate(context) {
  const output = vscode.window.createOutputChannel('Git Change Highlighter Pro');
  const emitter = new vscode.EventEmitter();
  const states = new Map(), accepted = new Map(), styles = new Map(), workers = new Set();
  let stopped = false;
  const gitExtension = vscode.extensions.getExtension('vscode.git');
  if (!gitExtension) return;
  const git = (await gitExtension.activate()).getAPI(1);
  const reader = new GitReader(git.git.path);
  const config = uri => vscode.workspace.getConfiguration('gchPro', uri);
  const auto = doc => config(doc.uri).get('autoRefresh', true);
  const keyOf = doc => doc.uri.toString();
  const visible = () => [...new Set(vscode.window.visibleTextEditors.map(e => e.document))];
  const range = (doc, line) => new vscode.Range(Math.max(0, Math.min(line, doc.lineCount - 1)), 0, Math.max(0, Math.min(line, doc.lineCount - 1)), 0);
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 90);
  status.command = 'gchPro.next'; status.tooltip = 'Next Git change (Ctrl+Alt+N); previous: Ctrl+Alt+P';
  function updateStatus() {
    const doc = vscode.window.activeTextEditor?.document;
    const count = doc ? shown(doc).length : 0;
    if (count) { status.text = `$(diff) ${count} changes $(arrow-down)`; status.show(); } else status.hide();
  }
  function shown(doc) {
    const state = states.get(keyOf(doc));
    if (!state || state.version !== doc.version) return [];
    return state.hunks.filter(h => !accepted.get(keyOf(doc))?.has(h.id));
  }
  function getStyles(doc) {
    const key = keyOf(doc);
    if (styles.has(key)) return styles.get(key);
    const c = config(doc.uri), defaults = { added: '#00A83B', modified: '#0066FF', deleted: '#E00032' };
    const types = {};
    for (const kind of Object.keys(defaults)) {
      const value = c.get(`${kind}Color`, defaults[kind]);
      const color = /^#[\da-f]{6}$/i.test(value) ? value : defaults[kind];
      const opacity = Math.min(1, Math.max(0, Number(c.get('opacity', 0.24)) || 0));
      const rgba = `rgba(${parseInt(color.slice(1, 3), 16)},${parseInt(color.slice(3, 5), 16)},${parseInt(color.slice(5, 7), 16)},${opacity})`;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect x="1" y="3" width="14" height="10" rx="2" fill="${color}"/><path stroke="white" stroke-width="2" d="M4 8h8"/></svg>`;
      types[kind] = vscode.window.createTextEditorDecorationType({
        isWholeLine: true,
        rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
        backgroundColor: kind !== 'deleted' && c.get('wholeLine', true) ? rgba : undefined,
        gutterIconPath: kind === 'deleted' ? vscode.Uri.parse(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`) : undefined,
        gutterIconSize: 'contain',
        overviewRulerColor: c.get('overviewRuler', false) ? color : undefined,
        after: kind === 'deleted' && c.get('deletionLabels', true) ? {
          color, backgroundColor: rgba, fontWeight: 'bold', margin: '0 0 0 1em'
        } : undefined,
        overviewRulerLane: vscode.OverviewRulerLane.Right
      });
    }
    styles.set(key, types); return types;
  }
  function paint(doc) {
    const hunks = shown(doc), types = getStyles(doc);
    for (const editor of vscode.window.visibleTextEditors.filter(e => keyOf(e.document) === keyOf(doc))) {
      for (const kind of ['added', 'modified']) {
        editor.setDecorations(types[kind], hunks.flatMap(h => h[kind].map(line => ({ range: range(doc, line),
          hoverMessage: kind === 'deleted' ? 'Deleted lines at this position relative to HEAD' : undefined }))));
      }
      // Multiple deletion gaps can clamp to the same display line at EOF; combine their counts.
      const deletions = new Map();
      for (const h of hunks) for (const block of h.deletedBlocks) {
        const line = range(doc, block.line).start.line;
        const item = deletions.get(line) || { count: 0, eof: false };
        item.count += block.count; item.eof ||= block.line >= doc.lineCount;
        deletions.set(line, item);
      }
      editor.setDecorations(types.deleted, [...deletions].map(([line, item]) => ({
        range: doc.lineAt(line).range,
        hoverMessage: `相对 HEAD，此处${item.eof ? '之后' : '之前'}删除了 ${item.count} 行。删除位置标记不代表当前行被删除。`,
        renderOptions: config(doc.uri).get('deletionLabels', true) ? {
          after: { contentText: ` −${item.count} 行${item.eof ? '（末尾）' : ''} ` }
        } : undefined
      })));
    }
    emitter.fire(); updateStatus();
  }
  let activeWorkers = 0;
  const slots = [];
  async function computeAsync(base, current) {
    if (activeWorkers >= 2) await new Promise(resolve => slots.push(resolve));
    activeWorkers++;
    try {
      if (stopped) throw new Error('Extension disposed');
      return await new Promise((resolve, reject) => {
        const worker = new Worker(path.join(__dirname, 'worker.js'));
        workers.add(worker);
        const timeout = setTimeout(() => finish(new Error('Diff worker time limit exceeded')), 4000);
        let done = false;
        function finish(error, result) {
          if (done) return; done = true; clearTimeout(timeout); workers.delete(worker); void worker.terminate();
          if (error) reject(error); else resolve(result);
        }
        worker.once('error', finish);
        worker.once('exit', code => finish(new Error(`Diff worker exited (${code})`)));
        worker.once('message', message => finish(message.error ? new Error(message.error) : null, message.result));
        worker.postMessage({ id: 1, base, current });
      });
    } finally { activeWorkers--; slots.shift()?.(); }
  }
  const scheduler = new Scheduler(async (doc, current) => {
    const key = keyOf(doc), version = doc.version;
    try {
      const repo = git.getRepository(doc.uri);
      if (!repo) { if (current()) { states.delete(key); paint(doc); } return; }
      const text = doc.getText();
      if (Buffer.byteLength(text) > MAX_BYTES) throw new Error('File exceeds 5 MiB limit');
      const snapshot = await reader.read(repo.rootUri.fsPath, doc.uri.fsPath);
      if (!current() || doc.isClosed || doc.version !== version) return;
      const cacheKey = digest(snapshot.head + '\0' + snapshot.path + '\0' + snapshot.base + '\0' + text);
      const previous = states.get(key);
      if (previous?.cacheKey === cacheKey) { previous.version = version; paint(doc); return; }
      const result = await computeAsync(snapshot.base, text);
      if (!current() || doc.isClosed || doc.version !== version) return;
      if (previous?.head !== snapshot.head) accepted.delete(key);
      const ids = new Set(result.hunks.map(h => h.id));
      if (accepted.has(key)) accepted.set(key, new Set([...accepted.get(key)].filter(id => ids.has(id))));
      states.set(key, { ...result, cacheKey, head: snapshot.head, version }); paint(doc);
    } catch (error) {
      if (current() && !stopped) { states.delete(key); paint(doc); output.appendLine(`${doc.fileName}: ${error.message}`); }
    }
  });
  function schedule(doc, force = false) {
    if (!stopped && doc.uri.scheme === 'file' && (force || auto(doc))) scheduler.schedule(keyOf(doc), doc);
  }
  function refresh(force = false) { for (const doc of visible()) schedule(doc, force); updateStatus(); }
  const watched = new Map();
  function watch(repo) {
    if (watched.has(repo)) return;
    watched.set(repo, repo.state.onDidChange(() => refresh())); refresh();
  }
  for (const repo of git.repositories) watch(repo);
  function navigate(direction) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    const hunks = shown(editor.document);
    if (!hunks.length) return;
    const positions = [...new Set(hunks.map(h => range(editor.document, h.added[0] ?? h.modified[0] ?? h.deleted[0] ?? 0).start.line))].sort((a, b) => a - b);
    const line = editor.selection.active.line;
    const next = direction > 0 ? positions.find(p => p > line) ?? positions[0] : positions.slice().reverse().find(p => p < line) ?? positions.at(-1);
    const r = range(editor.document, next);
    editor.selection = new vscode.Selection(r.start, r.start); editor.revealRange(r, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
  }
  async function reject(uri, id) {
    const doc = await vscode.workspace.openTextDocument(uri);
    const initial = states.get(keyOf(doc));
    const hunk = shown(doc).find(h => h.id === id);
    if (!hunk || !initial) return;
    const editor = await vscode.window.showTextDocument(doc);
    const version = doc.version, text = doc.getText();
    try {
      const repo = git.getRepository(uri);
      if (!repo) return;
      const snapshot = await reader.read(repo.rootUri.fsPath, uri.fsPath);
      const fresh = await computeAsync(snapshot.base, text);
      if (doc.version !== version || snapshot.head !== initial.head || fresh.fingerprint !== initial.fingerprint) {
        schedule(doc, true); return;
      }
      const replacement = rejectText(text, hunk);
      const eol = doc.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';
      // Only this explicit user action edits a buffer. No save, stage, apply, or index mutation.
      await editor.edit(builder => builder.replace(new vscode.Range(doc.positionAt(0), doc.positionAt(text.length)), replacement.replace(/\n/g, eol)),
        { undoStopBefore: true, undoStopAfter: true });
      schedule(doc, true);
    } catch (error) { output.appendLine(`Reject: ${error.message}`); schedule(doc, true); }
  }
  const command = (name, fn) => vscode.commands.registerCommand(`gchPro.${name}`, fn);
  context.subscriptions.push(output, emitter, status,
    git.onDidOpenRepository(watch),
    git.onDidCloseRepository(repo => { watched.get(repo)?.dispose(); watched.delete(repo); refresh(); }),
    vscode.window.onDidChangeActiveTextEditor(() => refresh()),
    vscode.window.onDidChangeVisibleTextEditors(() => refresh()),
    vscode.workspace.onDidOpenTextDocument(doc => schedule(doc)),
    vscode.workspace.onDidSaveTextDocument(doc => schedule(doc)),
    vscode.workspace.onDidChangeTextDocument(event => {
      if (!event.contentChanges.length || event.document.uri.scheme !== 'file') return;
      // Clear stale positions even with auto refresh disabled.
      paint(event.document); schedule(event.document);
    }),
    vscode.workspace.onDidCloseTextDocument(doc => {
      const key = keyOf(doc); scheduler.forget(key); states.delete(key); accepted.delete(key);
      for (const type of Object.values(styles.get(key) || {})) type.dispose(); styles.delete(key);
    }),
    vscode.workspace.onDidChangeConfiguration(event => {
      if (!event.affectsConfiguration('gchPro')) return;
      scheduler.dispose();
      for (const types of styles.values()) for (const type of Object.values(types)) type.dispose();
      styles.clear(); for (const doc of visible()) paint(doc); refresh();
    }),
    vscode.languages.registerCodeLensProvider({ scheme: 'file' }, {
      onDidChangeCodeLenses: emitter.event,
      provideCodeLenses(doc) {
        if (!config(doc.uri).get('codeLens', true)) return [];
        const hunks = shown(doc);
        return hunks.flatMap((h, i) => {
          const r = range(doc, h.added[0] ?? h.modified[0] ?? h.deleted[0] ?? 0);
          const removed = h.deletedBlocks.reduce((sum, block) => sum + block.count, 0);
          return [new vscode.CodeLens(r, { title: `Change ${i + 1}/${hunks.length}${removed ? ` · −${removed} 行` : ''}`, command: '' }),
            new vscode.CodeLens(r, { title: 'Accept', command: 'gchPro.accept', arguments: [doc.uri, h.id] }),
            new vscode.CodeLens(r, { title: 'Reject', command: 'gchPro.reject', arguments: [doc.uri, h.id] })];
        });
      }
    }),
    command('next', () => navigate(1)), command('previous', () => navigate(-1)), command('refresh', () => refresh(true)),
    command('accept', async (uri, id) => {
      const doc = await vscode.workspace.openTextDocument(uri), key = keyOf(doc);
      if (!shown(doc).some(h => h.id === id)) return;
      if (!accepted.has(key)) accepted.set(key, new Set()); accepted.get(key).add(id); paint(doc);
    }), command('reject', reject)
  );
  // Git API notifications are primary; polling catches external HEAD/ref changes and disabled Git auto-refresh.
  const poll = setInterval(() => refresh(), 3000);
  context.subscriptions.push({ dispose() {
    stopped = true; clearInterval(poll); scheduler.dispose();
    for (const disposable of watched.values()) disposable.dispose();
    for (const types of styles.values()) for (const type of Object.values(types)) type.dispose();
    for (const worker of workers) void worker.terminate(); states.clear(); accepted.clear(); reader.cache.clear();
  } });
  refresh();
}
module.exports = { activate };

'use strict';
// Run by VS Code's --extensionTestsPath, against a disposable fixture only.
const vscode = require('vscode');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn, label) {
  for (let i = 0; i < 100; i++) { const result = await fn(); if (result) return result; await wait(100); }
  throw new Error(`Timeout: ${label}`);
}
exports.run = async () => {
  const passed = [], report = path.join(__dirname, '../docs/HOST-RESULTS.json');
  try {
    const root = vscode.workspace.workspaceFolders[0].uri.fsPath;
    assert.ok(root.includes('gch-host-'), 'Refuse to mutate any non-test workspace');
    const git = (...args) => execFileSync('git', args, { cwd: root, windowsHide: true, encoding: 'utf8' });
    const ext = vscode.extensions.getExtension('local-tools.git-change-highlighter-pro');
    assert.ok(ext); await ext.activate(); passed.push('Extension activation');
    const uri = vscode.Uri.file(path.join(root, 'sample.py'));
    const doc = await vscode.workspace.openTextDocument(uri);
    let editor = await vscode.window.showTextDocument(doc);
    const lenses = () => vscode.commands.executeCommand('vscode.executeCodeLensProvider', uri);
    await until(async () => (await lenses())?.length === 3, 'initial automatic highlights/CodeLens');
    passed.push('Open file: automatic hunk/CodeLens');
    const index = await fs.readFile(path.join(root, '.git/index'));
    await vscode.commands.executeCommand('gchPro.next');
    assert.equal(editor.selection.active.line, 0); passed.push('Navigation');
    const accept = (await lenses()).find(l => l.command.command === 'gchPro.accept');
    await vscode.commands.executeCommand(accept.command.command, ...accept.command.arguments);
    assert.equal((await lenses()).length, 0); passed.push('Accept dismisses hunk');
    await editor.edit(b => b.replace(new vscode.Range(0, 0, 0, 9), 'value = 3'));
    await until(async () => (await lenses())?.length === 3, 'changed accepted hunk');
    passed.push('Unsaved buffer refresh and content-based Accept invalidation');
    await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
    assert.equal(vscode.window.visibleTextEditors.filter(e => e.document === doc).length, 2);
    passed.push('Same document in two visible editors');
    const reject = (await lenses()).find(l => l.command.command === 'gchPro.reject');
    await vscode.commands.executeCommand(reject.command.command, ...reject.command.arguments);
    assert.equal(doc.getText(), 'value = 1\n');
    assert.equal(doc.isDirty, true);
    assert.deepEqual(await fs.readFile(path.join(root, '.git/index')), index);
    passed.push('Explicit Reject: buffer restored, index untouched, no implicit save');
    await vscode.commands.executeCommand('undo');
    assert.equal(doc.getText(), 'value = 3\n'); passed.push('Reject is undoable');
    await doc.save(); await until(async () => (await lenses())?.length === 3, 'save refresh');
    git('add', '.'); git('commit', '-m', 'host commit');
    await until(async () => (await lenses())?.length === 0, 'commit clears markers');
    passed.push('Save and external commit refresh without manual command');
    await vscode.workspace.getConfiguration('gchPro', uri).update('autoRefresh', false, vscode.ConfigurationTarget.Workspace);
    editor = await vscode.window.showTextDocument(doc);
    await editor.edit(b => b.insert(new vscode.Position(1, 0), 'extra\n'));
    await wait(600); assert.equal((await lenses()).length, 0);
    await vscode.commands.executeCommand('gchPro.refresh');
    await until(async () => (await lenses())?.length === 3, 'manual refresh');
    passed.push('autoRefresh=false and explicit manual refresh');
    await editor.edit(b => b.replace(new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length)), ''));
    await vscode.commands.executeCommand('gchPro.refresh');
    await until(async () => (await lenses())?.some(l => l.command.title.includes('−1 行')), 'pure deletion count');
    const deletionReject = (await lenses()).find(l => l.command.command === 'gchPro.reject');
    await vscode.commands.executeCommand(deletionReject.command.command, ...deletionReject.command.arguments);
    assert.equal(doc.getText(), 'value = 3\n');
    passed.push('Pure deletion: count label, empty-buffer decorations and Reject');
    await fs.writeFile(report, JSON.stringify({ vscode: vscode.version, passed, status: 'PASS' }, null, 2));
  } catch (error) {
    await fs.writeFile(report, JSON.stringify({ vscode: vscode.version, passed, status: 'FAIL', error: error.stack }, null, 2));
    throw error;
  }
};

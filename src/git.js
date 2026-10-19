'use strict';
const { execFile } = require('node:child_process');
const path = require('node:path');
const MAX_BYTES = 5 * 1024 * 1024;
class GitReader {
  constructor(executable = 'git') { this.executable = executable; this.cache = new Map(); }
  run(root, args) {
    return new Promise((resolve, reject) => execFile(this.executable,
      ['--no-optional-locks', '-c', 'core.quotepath=false', ...args],
      { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 5000, maxBuffer: MAX_BYTES * 2,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_LITERAL_PATHSPECS: '1' } },
      (err, stdout) => err ? reject(err) : resolve(stdout)));
  }
  async read(root, file) {
    const rel = path.relative(root, file).split(path.sep).join('/');
    if (rel.startsWith('../') || path.isAbsolute(rel)) throw new Error('File outside repository');
    let head;
    try { head = (await this.run(root, ['rev-parse', '--verify', 'HEAD'])).trim(); }
    catch (error) {
      // A symbolic, unborn branch is different from a Git failure or corrupt HEAD.
      const ref = (await this.run(root, ['symbolic-ref', '-q', 'HEAD'])).trim();
      try { await this.run(root, ['show-ref', '--verify', '--quiet', ref]); throw error; }
      catch (missing) { if (missing.code !== 1) throw error; }
      return { head: 'unborn', base: '', path: rel };
    }
    let original = rel;
    const changes = (await this.run(root, ['diff', '--name-status', '-z', '--find-renames', head, '--'])).split('\0');
    for (let i = 0; i < changes.length;) {
      const kind = changes[i++], from = changes[i++];
      if (/^[RC]/.test(kind)) { const to = changes[i++]; if (to === rel && kind[0] === 'R') original = from; }
    }
    const key = `${root}\0${head}\0${original}`;
    if (this.cache.has(key)) return { head, base: this.cache.get(key), path: original };
    const entry = await this.run(root, ['ls-tree', '-z', head, '--', original]);
    const base = entry ? await this.run(root, ['show', `${head}:${original}`]) : '';
    if (Buffer.byteLength(base) > MAX_BYTES) throw new Error('File exceeds 5 MiB limit');
    this.cache.set(key, base);
    // Bound baseline retention to approximately 40 MiB, including small-file overhead.
    let size = 0;
    for (const value of this.cache.values()) size += Buffer.byteLength(value) + 1024;
    while (size > 40 * 1024 * 1024) {
      const first = this.cache.keys().next().value;
      size -= Buffer.byteLength(this.cache.get(first)) + 1024; this.cache.delete(first);
    }
    return { head, base, path: original };
  }
}
module.exports = { GitReader, MAX_BYTES };

'use strict';
// One running job per document; invalidation happens immediately, before debounce expires.
class Scheduler {
  constructor(run, delay = 180) { this.run = run; this.delay = delay; this.entries = new Map(); }
  schedule(key, value) {
    let e = this.entries.get(key);
    if (!e) { e = { generation: 0, running: false }; this.entries.set(key, e); }
    e.generation++; e.value = value; e.pending = true;
    clearTimeout(e.timer);
    e.timer = setTimeout(() => this.flush(key, e), this.delay);
  }
  async flush(key, e) {
    if (e.running || !e.pending || this.entries.get(key) !== e) return;
    e.running = true; e.pending = false;
    const generation = e.generation;
    try { await this.run(e.value, () => this.entries.get(key) === e && generation === e.generation); }
    finally {
      e.running = false;
      if (e.pending && this.entries.get(key) === e) {
        clearTimeout(e.timer);
        e.timer = setTimeout(() => this.flush(key, e), this.delay);
      }
    }
  }
  forget(key) { const e = this.entries.get(key); if (e) clearTimeout(e.timer); this.entries.delete(key); }
  dispose() { for (const key of this.entries.keys()) this.forget(key); }
}
module.exports = { Scheduler };

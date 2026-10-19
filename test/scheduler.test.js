'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Scheduler } = require('../src/scheduler');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
test('rapid edits invalidate in-flight results before debounce and coalesce newest result', async () => {
  const applied = [], started = [];
  let release;
  const blocked = new Promise(resolve => { release = resolve; });
  const scheduler = new Scheduler(async (value, valid) => {
    started.push(value); if (value === 1) await blocked;
    if (valid()) applied.push(value);
  }, 5);
  scheduler.schedule('file', 1); await wait(20);
  scheduler.schedule('file', 2); scheduler.schedule('file', 3);
  release(); await wait(40);
  assert.deepEqual(started, [1, 3]); assert.deepEqual(applied, [3]); scheduler.dispose();
});
test('multiple documents and close/dispose cannot publish stale work', async () => {
  const applied = [];
  const scheduler = new Scheduler(async (v, valid) => { await wait(20); if (valid()) applied.push(v); }, 2);
  scheduler.schedule('a', 1); scheduler.schedule('b', 2); await wait(10); scheduler.forget('a');
  await wait(40); assert.deepEqual(applied, [2]); scheduler.dispose();
});

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { compute, parseUnified, rejectText, pairLines } = require('../src/diff');
const flatten = (r, kind) => r.hunks.flatMap(h => h[kind]);
test('pure single and multiple added lines', () => {
  assert.deepEqual(flatten(compute('a\n', 'a\nb\nc\n'), 'added'), [1, 2]);
  assert.deepEqual(flatten(compute('', 'one\n'), 'added'), [0]);
});
test('single and multiple replacements are blue', () => {
  assert.deepEqual(flatten(compute('a\nb\n', 'c\nd\n'), 'modified'), [0, 1]);
  assert.deepEqual(flatten(compute('a\n', 'b\n'), 'modified'), [0]);
});
test('similarity aligns inserted line before replacement in same block', () => {
  const r = compute('value = 10\n', 'print("hello")\nvalue = 20\n');
  assert.deepEqual(flatten(r, 'added'), [0]); assert.deepEqual(flatten(r, 'modified'), [1]);
});
test('context separates addition and replacement inside one hunk', () => {
  const r = compute('a\ncontext\nold\n', 'a\nnew\ncontext\nchanged\n');
  assert.equal(r.hunks.length, 1);
  assert.deepEqual(flatten(r, 'added'), [1]); assert.deepEqual(flatten(r, 'modified'), [3]);
});
test('pure deletions at top, middle, EOF and entire file are gaps', () => {
  assert.deepEqual(flatten(compute('a\nb\n', 'b\n'), 'deleted'), [0]);
  assert.deepEqual(flatten(compute('a\nb\nc\n', 'a\nc\n'), 'deleted'), [1]);
  assert.deepEqual(flatten(compute('a\nb\n', 'a\n'), 'deleted'), [1]);
  assert.deepEqual(flatten(compute('a\n', ''), 'deleted'), [0]);
});
test('deletion badges count removed lines without counting paired replacements', () => {
  assert.deepEqual(compute('a\nb\nc\n', '').hunks[0].deletedBlocks, [{ line: 0, count: 3 }]);
  assert.deepEqual(compute('a\n', 'b\n').hunks[0].deletedBlocks, []);
  const mixed = compute('keep\nvalue = 10\nremove\n', 'keep\nvalue = 20\n');
  assert.deepEqual(mixed.hunks[0].deletedBlocks, [{ line: 2, count: 1 }]);
  const separated = compute('a\nkeep\nb\n', 'keep\n');
  assert.deepEqual(separated.hunks[0].deletedBlocks, [{ line: 0, count: 1 }, { line: 1, count: 1 }]);
});
test('separate hunks keep new-side offsets after insertion', () => {
  const base = Array.from({ length: 30 }, (_, i) => `line ${i}\n`).join('');
  const current = 'insert\n' + base.replace('line 25\n', 'changed 25\n');
  const r = compute(base, current);
  assert.equal(r.hunks.length, 2); assert.deepEqual(flatten(r, 'added'), [0]); assert.deepEqual(flatten(r, 'modified'), [26]);
});
test('no-newline markers and content starting +++/--- are not headers', () => {
  const r = parseUnified('@@ -1,2 +1,3 @@\n---old\n-old\n\\ No newline at end of file\n+++new\n+new\n+third\n\\ No newline at end of file\n');
  assert.equal(r[0].added.length + r[0].modified.length, 3);
  assert.deepEqual(flatten(compute('old', 'new'), 'modified'), [0]);
});
test('empty, CRLF-only and unchanged documents', () => {
  assert.equal(compute('', '').hunks.length, 0);
  assert.equal(compute('a\r\n', 'a\n').hunks.length, 0);
  assert.equal(compute('a\n', 'a\n').hunks.length, 0);
});
test('Reject reverses untouched original hunks including newline changes', () => {
  for (const [base, current] of [['a\n', 'b\n'], ['a', 'b'], ['a\n', 'a'], ['', 'a\n'], ['a\n', ''], ['a\nb\n', 'a\nc\nd\n']]) {
    const r = compute(base, current);
    assert.equal(rejectText(current, r.hunks[0]), base);
  }
});
test('Reject leaves unrelated hunks alone and refuses stale text', () => {
  const base = Array.from({ length: 30 }, (_, i) => `line ${i}\n`).join('');
  const current = base.replace('line 0\n', 'first\n').replace('line 29\n', 'last\n');
  assert.equal(rejectText(current, compute(base, current).hunks[0]), base.replace('line 29\n', 'last\n'));
  assert.throws(() => rejectText('unexpected\n', compute('a\n', 'b\n').hunks[0]), /stale/);
});
test('content identity changes even when hunk header is unchanged', () => {
  assert.notEqual(compute('a\n', 'b\n').hunks[0].id, compute('a\n', 'c\n').hunks[0].id);
});
test('bounded conservative pairing for ambiguous and large replacement blocks', () => {
  assert.deepEqual(pairLines(['a'], ['x', 'y']), [[0, 0]]);
  assert.equal(pairLines(Array(200).fill('old'), Array(201).fill('new')).length, 200);
});
test('large MATLAB, Python and LaTeX documents', t => {
  for (const [name, line] of [['MATLAB', i => `x(${i}) = sin(${i});\n`], ['Python', i => `result_${i} = calculate(${i})\n`], ['LaTeX', i => `\\section{Section ${i}} text ${i}\n`]]) {
    const base = Array.from({ length: 40000 }, (_, i) => line(i)).join('');
    const current = base.replace(line(20000), line(20000).replace('20000', '99999'));
    const start = performance.now(); const r = compute(base, current);
    assert.deepEqual(flatten(r, 'modified'), [20000]);
    t.diagnostic(`${name}: 40,000 lines, ${(performance.now() - start).toFixed(1)} ms`);
  }
});
test('binary and malformed patches fail safely', () => {
  assert.throws(() => compute('a\0', 'b\0'), /Binary/);
  assert.throws(() => parseUnified('@@ -1,2 +1,2 @@\n-a\n+b\n'), /Malformed|Invalid/);
});

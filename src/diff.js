'use strict';
const { createHash } = require('node:crypto');
const { createTwoFilesPatch } = require('diff');

const digest = text => createHash('sha256').update(text).digest('hex');
const normalize = text => text.replace(/\r\n/g, '\n');

// Bounded token similarity: long generated lines must not make alignment quadratic.
function similarity(a, b) {
  a = a.trim().slice(0, 512); b = b.trim().slice(0, 512);
  if (a === b) return 1;
  if (!a || !b) return 0;
  const grams = s => new Set(Array.from({ length: Math.max(0, s.length - 1) }, (_, i) => s.slice(i, i + 2)));
  const x = grams(a), y = grams(b);
  let shared = 0;
  for (const g of x) if (y.has(g)) shared++;
  return 2 * shared / Math.max(1, x.size + y.size);
}

function pairLines(old, added) {
  const n = old.length, m = added.length;
  if (!n || !m) return [];
  // Equal sized replacement blocks have an unambiguous conservative ordinal mapping.
  if (n === m) return old.map((_, i) => [i, i]);
  // Bound work for large rewrites; never attempt all pairwise comparisons there.
  if (n * m > 16384) return Array.from({ length: Math.min(n, m) }, (_, i) => [i, i]);
  const scores = Array.from({ length: n + 1 }, () => new Float32Array(m + 1));
  const choices = Array.from({ length: n + 1 }, () => new Uint8Array(m + 1));
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
    const s = similarity(old[i - 1], added[j - 1]);
    const paired = s >= 0.35 ? scores[i - 1][j - 1] + s : -1;
    const up = scores[i - 1][j], left = scores[i][j - 1];
    scores[i][j] = Math.max(paired, up, left);
    choices[i][j] = paired >= up && paired >= left ? 1 : up >= left ? 2 : 3;
  }
  const pairs = [];
  for (let i = n, j = m; i && j;) {
    if (choices[i][j] === 1) { pairs.push([--i, --j]); }
    else if (choices[i][j] === 2) i--; else j--;
  }
  // With no credible anchors, ordinal pairing avoids claiming every replacement is an addition.
  return pairs.length ? pairs.reverse() : Array.from({ length: Math.min(n, m) }, (_, i) => [i, i]);
}

function parseUnified(patch) {
  const lines = patch.split('\n'), hunks = [];
  const header = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;
  for (let i = 0; i < lines.length;) {
    const match = header.exec(lines[i++]);
    if (!match) continue;
    const oldStart = +match[1], oldCount = match[2] === undefined ? 1 : +match[2];
    const newStart = +match[3], newCount = match[4] === undefined ? 1 : +match[4];
    const body = [];
    let oldSeen = 0, newSeen = 0;
    while (i < lines.length && (oldSeen < oldCount || newSeen < newCount || lines[i].startsWith('\\'))) {
      const line = lines[i++];
      if (line[0] === '\\') { body.push(line); continue; }
      if (![' ', '+', '-'].includes(line[0])) throw new Error('Malformed unified diff');
      body.push(line);
      if (line[0] !== '+') oldSeen++;
      if (line[0] !== '-') newSeen++;
    }
    if (oldSeen !== oldCount || newSeen !== newCount) throw new Error('Invalid hunk counts');
    let cursor = newCount === 0 ? newStart : newStart - 1;
    const added = [], modified = [], deleted = [];
    const deletionCounts = new Map();
    for (let b = 0; b < body.length;) {
      if (body[b][0] === ' ') { cursor++; b++; continue; }
      if (body[b][0] === '\\') { b++; continue; }
      const old = [], fresh = [], start = cursor;
      while (b < body.length && body[b][0] !== ' ') {
        const l = body[b++];
        if (l[0] === '-') old.push(l.slice(1));
        if (l[0] === '+') { fresh.push(l.slice(1)); cursor++; }
      }
      const pairs = pairLines(old, fresh), usedOld = new Set(pairs.map(p => p[0])), usedNew = new Set(pairs.map(p => p[1]));
      fresh.forEach((_, j) => (usedNew.has(j) ? modified : added).push(start + j));
      // A deletion is a gap. Anchor before the next matched line, or after the block.
      old.forEach((_, j) => {
        if (!usedOld.has(j)) {
          const line = start + (pairs.find(p => p[0] > j)?.[1] ?? fresh.length);
          deleted.push(line);
          deletionCounts.set(line, (deletionCounts.get(line) || 0) + 1);
        }
      });
    }
    hunks.push({ oldStart, oldCount, newStart, newCount, body, added, modified,
      deleted: [...new Set(deleted)], deletedBlocks: [...deletionCounts].map(([line, count]) => ({ line, count })),
      id: digest(JSON.stringify([oldStart, newStart, body])) });
  }
  return hunks;
}

function compute(base, current) {
  base = normalize(base); current = normalize(current);
  if (base.includes('\0') || current.includes('\0')) throw new Error('Binary file skipped');
  const patch = createTwoFilesPatch('HEAD', 'buffer', base, current, '', '', { context: 3, timeout: 1500 });
  if (patch === undefined) throw new Error('Diff time limit exceeded');
  return { hunks: parseUnified(patch), fingerprint: digest(base + '\0' + current) };
}

// Reverse the original hunk, not the color classifications. Preserve no-newline markers.
function rejectText(current, hunk) {
  current = normalize(current);
  const parts = current.match(/[^\n]*\n|[^\n]+$/g) || [];
  const before = [], after = [];
  for (let i = 0; i < hunk.body.length; i++) {
    const line = hunk.body[i];
    if (line[0] === '\\') continue;
    const text = line.slice(1) + (hunk.body[i + 1]?.[0] === '\\' ? '' : '\n');
    if (line[0] !== '+') before.push(text);
    if (line[0] !== '-') after.push(text);
  }
  const start = hunk.newCount === 0 ? hunk.newStart : hunk.newStart - 1;
  if (parts.slice(start, start + hunk.newCount).join('') !== after.join('')) throw new Error('Hunk is stale');
  parts.splice(start, hunk.newCount, ...before);
  return parts.join('');
}
module.exports = { compute, parseUnified, pairLines, rejectText, normalize, digest };

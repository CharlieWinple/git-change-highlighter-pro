'use strict';
const { parentPort } = require('node:worker_threads');
const { compute } = require('./diff');
parentPort.on('message', ({ id, base, current }) => {
  try { parentPort.postMessage({ id, result: compute(base, current) }); }
  catch (error) { parentPort.postMessage({ id, error: error.message }); }
});

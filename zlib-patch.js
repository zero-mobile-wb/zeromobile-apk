// Patched zlib that avoids promisify errors
const zlib = require('browserify-zlib');
const util = require('util');

// Start by copying all exports from browserify-zlib
const safeZlib = { ...zlib };

// List of async functions to promisify
const asyncFunctions = [
  'deflate',
  'deflateRaw',
  'gzip',
  'gunzip',
  'inflate',
  'inflateRaw',
  'unzip',
];

// Iterate over the known async functions and create promisified versions
for (const funcName of asyncFunctions) {
  const originalFunc = zlib[funcName];
  if (typeof originalFunc === 'function') {
    safeZlib[`${funcName}Async`] = util.promisify(originalFunc);
  }
}

module.exports = safeZlib;
// Debug version of util to catch problematic calls
const util = require('util');
const originalPromisify = util.promisify;

util.promisify = function(original) {
  if (typeof original !== 'function') {
    // Log the stack trace to see what's calling this
    console.error('❌ promisify called with non-function!');
    console.error('Type:', typeof original);
    console.error('Value:', original);
    console.error('Stack:', new Error().stack);
    
    // Return a dummy async function instead of crashing
    return async function() {
      throw new TypeError('The "original" argument must be of type Function. Check console for details.');
    };
  }
  
  return originalPromisify(original);
};

// Preserve custom symbol
util.promisify.custom = originalPromisify.custom;

module.exports = util;
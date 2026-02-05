// Safe util module for React Native
const util = require('util');

// Store the original promisify
const originalPromisify = util.promisify;

// Create a safer promisify that handles edge cases
function safePromisify(original) {
  // If it's undefined, null, or not a function, return a no-op async function
  // This prevents the error but allows the app to continue
  if (typeof original !== 'function') {
    // Return a function that resolves to undefined
    // This is safer than throwing an error for libraries that might call promisify incorrectly
    return async function(...args) {
      return undefined;
    };
  }

  // Use original promisify for valid functions
  try {
    return originalPromisify(original);
  } catch (error) {
    // Fallback: Return a wrapper that calls the original function
    return function(...args) {
      return new Promise((resolve, reject) => {
        try {
          const callback = (err, result) => {
            if (err) reject(err);
            else resolve(result);
          };
          original(...args, callback);
        } catch (err) {
          reject(err);
        }
      });
    };
  }
}

// Copy the custom symbol
safePromisify.custom = originalPromisify.custom;

// Export util with safe promisify
module.exports = {
  ...util,
  promisify: safePromisify,
};
// CRITICAL: This must be imported before EVERYTHING else
// This sets up global polyfills that other modules depend on

// 0. Patch util.promisify BEFORE any imports
const util = require('util');
const originalPromisify = util.promisify;
util.promisify = function safePromisify(original) {
  if (typeof original !== 'function') {
    // Return a no-op function instead of throwing
    return async function() {
      return undefined;
    };
  }
  return originalPromisify(original);
};
util.promisify.custom = originalPromisify.custom;

// 1. Get random values FIRST (required by crypto operations)
import 'react-native-get-random-values';

// 2. URL polyfill
import 'react-native-url-polyfill/auto';

// 3. Import dependencies
import { Buffer } from '@craftzdog/react-native-buffer';
import process from 'process';

// 4. Set up Buffer globally BEFORE any crypto operations
global.Buffer = global.Buffer || Buffer;

// 5. Set up process
global.process = global.process || process;
global.process.env = global.process.env || {};
global.process.env.NODE_ENV = __DEV__ ? 'development' : 'production';
global.process.version = 'v16.0.0'; // Fake Node version
global.process.versions = { node: '16.0.0' };

// 6. nextTick - critical for many async operations
global.process.nextTick = global.process.nextTick || setImmediate;

// 7. Set up crypto with expo-crypto
if (!global.crypto) {
  const expoCrypto = require('expo-crypto');
  global.crypto = {
    getRandomValues: (array) => {
      // Handle undefined or null array
      if (!array) {
        console.warn('[crypto] getRandomValues called with undefined/null array');
        return new Uint8Array(0);
      }
      // Handle arrays without length property
      if (typeof array.length !== 'number' || array.length === 0) {
        console.warn('[crypto] getRandomValues called with invalid array');
        return array;
      }
      const randomBytes = expoCrypto.getRandomBytes(array.length);
      for (let i = 0; i < array.length; i++) {
        array[i] = randomBytes[i];
      }
      return array;
    },
    randomUUID: () => expoCrypto.randomUUID(),
    subtle: {},
  };
}

// 8. TextEncoder/TextDecoder
if (!global.TextEncoder) {
  global.TextEncoder = class TextEncoder {
    encode(str) {
      if (str === undefined || str === null) return new Uint8Array(0);
      const buf = Buffer.from(String(str), 'utf8');
      return new Uint8Array(buf);
    }
  };
}

if (!global.TextDecoder) {
  global.TextDecoder = class TextDecoder {
    decode(arr) {
      if (!arr || !arr.length) return '';
      return Buffer.from(arr).toString('utf8');
    }
  };
}

// 9. setImmediate/clearImmediate
global.setImmediate = global.setImmediate || ((fn, ...args) => setTimeout(fn, 0, ...args));
global.clearImmediate = global.clearImmediate || ((id) => clearTimeout(id));

// 10. Performance
if (!global.performance) {
  global.performance = {
    now: () => Date.now(),
  };
}

// 11. URL constructor
if (!global.URL) {
  const { URL, URLSearchParams } = require('react-native-url-polyfill');
  global.URL = URL;
  global.URLSearchParams = URLSearchParams;
}

// 12. btoa/atob for base64
if (!global.btoa) {
  global.btoa = (str) => Buffer.from(str, 'binary').toString('base64');
}
if (!global.atob) {
  global.atob = (str) => Buffer.from(str, 'base64').toString('binary');
}

console.log('✅ Shim loaded - all polyfills ready');
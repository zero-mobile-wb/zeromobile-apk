// CRITICAL: This must be imported before EVERYTHING else
// This sets up global polyfills that other modules depend on

// 0. Patch util.promisify BEFORE any imports
const util = require('util');
const originalPromisify = util.promisify;
util.promisify = function safePromisify(original) {
  if (typeof original !== 'function') {
    // Return a no-op function instead of throwing
    return async function () {
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

// 12. btoa/atob for base64 - Standalone and robust (overwrites native to ensure leniency)
const b64chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
const b64lookup = new Uint8Array(256);
for (let i = 0; i < b64chars.length - 1; i++) b64lookup[b64chars.charCodeAt(i)] = i;

global.btoa = (input) => {
  let str = String(input);
  let output = '';
  for (let block, charCode, idx = 0; str.charAt(idx | 0) || (idx % 1); output += b64chars.charAt(63 & block >> 8 - idx % 1 * 8)) {
    charCode = str.charCodeAt(idx += 3 / 4);
    if (charCode > 255) throw new Error("'btoa' failed: The string to be encoded contains characters outside of the Latin1 range.");
    block = block << 8 | charCode;
  }
  return output;
};

global.atob = (input) => {
  let str = String(input).replace(/[\t\n\f\r ]+/g, "").replace(/=+$/, "");
  let output = '';
  if (str.length % 4 == 1) throw new Error("'atob' failed: The string to be decoded is not correctly encoded.");
  for (let bc = 0, bs, buffer, idx = 0; buffer = str.charAt(idx++);) {
    buffer = b64chars.indexOf(buffer);
    if (buffer === -1 || buffer === 64) continue;
    bs = bc % 4 ? bs * 64 + buffer : buffer;
    if (bc++ % 4) output += String.fromCharCode(255 & bs >> (-2 * bc & 6));
  }
  return output;
};

// 13. base64ToArrayBuffer utility
global.base64ToArrayBuffer = (base64) => {
  const binary = global.atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

global.base64FromArrayBuffer = (arrayBuffer) => {
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return global.btoa(binary);
};

console.log('✅ Shim loaded - all polyfills ready');
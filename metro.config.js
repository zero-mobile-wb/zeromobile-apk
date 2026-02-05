// Load array polyfills for Node.js < 20
require('./array-polyfills');

const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Enable symlink resolution for npm linked packages
config.watchFolders = [
  path.resolve(__dirname, '.')
];

// Enable symlinks
config.resolver.unstable_enableSymlinks = true;

// Add proper aliases for problematic packages - NO NATIVE MODULES
config.resolver.extraNodeModules = {
  crypto: require.resolve('crypto-browserify'),
  stream: require.resolve('readable-stream'),
  buffer: require.resolve('@craftzdog/react-native-buffer'),
  zlib: require.resolve('./zlib-patch.js'),
  util: require.resolve('./util-polyfill.js'),
  http: require.resolve('stream-http'),
  https: require.resolve('https-browserify'),
  events: require.resolve('events'),
  url: require.resolve('url'),
  path: require.resolve('path-browserify'),
  assert: require.resolve('assert'),
  process: require.resolve('process/browser.js'),
  vm: require.resolve('vm-browserify'),
  viem: path.resolve(__dirname, 'node_modules/viem'),
  fs: false,
  net: false,
  tls: false,
  child_process: false,
  dns: false,
};

// Fix for @noble/hashes
config.resolver.extraNodeModules['@noble/hashes'] = path.resolve(
  __dirname,
  'node_modules/@noble/hashes'
);

// Resolve browser versions first
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];

// Add cjs and mjs extensions
config.resolver.sourceExts = [...config.resolver.sourceExts, 'cjs', 'mjs'];

// Add alias for problematic viem imports
config.resolver.alias = {
  '@noble/hashes/sha3': path.resolve(
    __dirname,
    'node_modules/@noble/hashes/sha3.js'
  ),
  '@noble/hashes/sha256': path.resolve(
    __dirname,
    'node_modules/@noble/hashes/sha256.js'
  ),
  '@noble/hashes/ripemd160': path.resolve(
    __dirname,
    'node_modules/@noble/hashes/ripemd160.js'
  ),
  '@noble/hashes/utils': path.resolve(
    __dirname,
    'node_modules/@noble/hashes/utils.js'
  ),
};

module.exports = config;
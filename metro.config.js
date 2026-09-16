// Load array polyfills for Node.js < 20
require('./array-polyfills');

const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Enable symlink resolution for npm linked packages
const sdkPath = path.resolve(__dirname, 'node_modules/zero-offline-payment-sdk');
const fs = require('fs');
config.watchFolders = [
  path.resolve(__dirname, '.'),
  ...(fs.existsSync(sdkPath) ? [sdkPath] : []),
];

// Tell Metro precisely where to find node_modules to avoid picking up the SDK's copy
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules')
];

// Enable symlinks
config.resolver.unstable_enableSymlinks = true;

// Add proper aliases for problematic packages - NO NATIVE MODULES
config.resolver.extraNodeModules = {
  'react': path.resolve(__dirname, 'node_modules/react'),
  'react-native': path.resolve(__dirname, 'node_modules/react-native'),
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
  fs: path.resolve(__dirname, 'empty-module.js'),
  net: path.resolve(__dirname, 'empty-module.js'),
  tls: path.resolve(__dirname, 'empty-module.js'),
  child_process: path.resolve(__dirname, 'empty-module.js'),
  dns: path.resolve(__dirname, 'empty-module.js'),
  readline: path.resolve(__dirname, 'empty-module.js'),
  os: path.resolve(__dirname, 'empty-module.js'),
  worker_threads: path.resolve(__dirname, 'empty-module.js'),
  'web-worker': path.resolve(__dirname, 'empty-module.js'),
  constants: require.resolve('constants-browserify'),
  fastfile: path.resolve(__dirname, 'empty-module.js'),
  snarkjs: path.resolve(__dirname, 'empty-module.js'),
  circomlibjs: path.resolve(__dirname, 'empty-module.js'),
  wasmcurves: path.resolve(__dirname, 'empty-module.js'),
  wasmbuilder: path.resolve(__dirname, 'empty-module.js'),
  'zero-offline-payment-sdk': path.resolve(__dirname, 'node_modules/zero-offline-payment-sdk'),
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
  'react': path.resolve(__dirname, 'node_modules/react'),
  'react/jsx-runtime': path.resolve(__dirname, 'node_modules/react/jsx-runtime'),
  'react/jsx-dev-runtime': path.resolve(__dirname, 'node_modules/react/jsx-dev-runtime'),
  'react-native': path.resolve(__dirname, 'node_modules/react-native'),
  'react-native/Libraries/Renderer': path.resolve(__dirname, 'node_modules/react-native/Libraries/Renderer'),
  // Force ALL buffer imports to use the RN-compatible self-contained version
  'buffer': path.resolve(__dirname, 'node_modules/@craftzdog/react-native-buffer'),
  '@noble/hashes/sha3': path.resolve(
    __dirname,
    'node_modules/@noble/hashes/sha3.js'
  ),
  '@noble/hashes/sha256': path.resolve(
    __dirname,
    'node_modules/@noble/hashes/sha256.js'
  ),
  '@noble/hashes/crypto': path.resolve(
    __dirname,
    'node_modules/@noble/hashes/crypto.js'
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

// Block Node-only files from ZK libraries that use dynamic import() or Node internals
// These files cannot be transpiled by Metro for React Native
config.resolver.blockList = [
  /node_modules\/web-worker\/cjs\/node\.js$/,
  /node_modules\/fastfile\/.*/,
  /node_modules\/snarkjs\/.*/,
  /node_modules\/circomlibjs\/.*/,
  /node_modules\/wasmcurves\/.*/,
  /node_modules\/wasmbuilder\/.*/,
  /node_modules\/ffjavascript\/.*/,
];

// Handle package exports for Privy and related libraries
const resolveRequestWithPackageExports = (context, moduleName, platform) => {
  // isows (viem dep) — disable package exports
  if (moduleName === 'isows') {
    return context.resolveRequest({ ...context, unstable_enablePackageExports: false }, moduleName, platform);
  }
  // zustand@4 — disable package exports
  if (moduleName.startsWith('zustand')) {
    return context.resolveRequest({ ...context, unstable_enablePackageExports: false }, moduleName, platform);
  }
  // jose — use browser condition
  if (moduleName === 'jose') {
    return context.resolveRequest({ ...context, unstable_conditionNames: ['browser'] }, moduleName, platform);
  }
  // @privy-io — enable package exports
  if (moduleName.startsWith('@privy-io/')) {
    return context.resolveRequest({ ...context, unstable_enablePackageExports: true }, moduleName, platform);
  }
  // zod v4's v3 compat layer uses ESM internals Metro can't bundle — force CJS main
  if (moduleName === 'zod' || moduleName.startsWith('zod/')) {
    return context.resolveRequest({ ...context, unstable_enablePackageExports: false }, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

config.resolver.resolveRequest = resolveRequestWithPackageExports;

module.exports = config;
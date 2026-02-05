const path = require('path');

module.exports = {
  resolveRequest: (context, moduleName, platform) => {
    // Handle @noble/hashes imports
    if (moduleName.startsWith('@noble/hashes/')) {
      const modulePath = path.resolve(
        __dirname,
        'node_modules',
        moduleName + '.js'
      );
      return { filepath: modulePath, type: 'sourceFile' };
    }
    
    // Handle jose imports
    if (moduleName === 'http' || moduleName === 'https') {
      return {
        filepath: require.resolve('stream-http'),
        type: 'sourceFile'
      };
    }
    
    // Let Metro handle other imports
    return context.resolveRequest(context, moduleName, platform);
  },
};
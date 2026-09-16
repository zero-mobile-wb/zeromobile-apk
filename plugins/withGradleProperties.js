const { withGradleProperties } = require('@expo/config-plugins');

module.exports = function withCustomGradleProperties(config) {
    return withGradleProperties(config, (config) => {
        config.modResults.push({
            type: 'property',
            key: 'android.useAndroidX',
            value: 'true',
        });
        config.modResults.push({
            type: 'property',
            key: 'android.enableJetifier',
            value: 'true',
        });
        return config;
    });
};
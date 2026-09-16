export default {
    expo: {
        name: "zero",
        slug: "zero-mobile",
        owner: "blockchainjoshs-organization",
        version: "1.0.0",
        runtimeVersion: { policy: "appVersion" },
        updates: {
            url: "https://u.expo.dev/b16d98b7-d951-4210-82ed-29f196ce1d4e"
        },
        orientation: "portrait",
        icon: "./assets/images/zero-icon.png",
        userInterfaceStyle: "light",
        newArchEnabled: true,
        platforms: [
            "ios",
            "android"
        ],
        scheme: "zero",
        splash: {
            "image": "./assets/zero-hero.png",
            "resizeMode": "contain",
            "backgroundColor": "#ffffff"
        },
        ios: {
            "supportsTablet": true,
            "bundleIdentifier": "com.zero.wallet",
            "infoPlist": {
                "ITSAppUsesNonExemptEncryption": false
            }
        },
        android: {
            "androidStatusBar": {
                "barStyle": "light-content",
                "backgroundColor": "#111111",
                "translucent": true
            },
            "adaptiveIcon": {
                "foregroundImage": "./assets/images/zero-icon-adaptive.png",
                "backgroundColor": "#0D5C54"
            },
            "predictiveBackGestureEnabled": false,
            "package": "com.zero.wallet",
            "permissions": [
                "RECEIVE_BOOT_COMPLETED",
                "VIBRATE",
                "POST_NOTIFICATIONS",
                "CAMERA"
            ]
        },
        jsEngine: "hermes",
        plugins: [
            "./plugins/withGradleProperties",
            "expo-build-properties",
            "expo-font",
            "expo-secure-store",
            "expo-sharing",
            "expo-splash-screen",
            "expo-status-bar",
            "expo-web-browser",
            [
                "expo-camera",
                {
                    "cameraPermission": "Allow Zero to access your camera for scanning Solana wallet QR codes."
                }
            ],
            [
                "expo-notifications",
                {
                    "icon": "./assets/images/zero-icon-adaptive.png",
                    "color": "#0D5C54"
                }
            ]
        ],
        extra: {
            privyAppId: "cmkbvfb9s03ynk00dnjbp7ajf",
            privyClientId: "client-WY6V6xD7tGWELpSqNZZfQ2yMVos4MoPdEkD13CzVar1G4",
            heliusApiKey: process.env.HELIUS_API_KEY || "f9a619f4-308f-41a8-935f-43d89b0d3c3e",
            heliusBaseUrl: "https://api-mainnet.helius-rpc.com/v0",
            jupiterApiKey: process.env.JUPITER_API_KEY || "jup_c9f829a5c0bb741b428dd8446437e5378b368d50143dc5899d744ac12e531d10",
            jupiterBaseUrl: "https://api.jup.ag",
            backendUrl: "https://zeroserver.pxxl.click",
            zerospendUrl: "http://54.224.130.78:3001",
            solLogoUrl: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
            shadowIdStatusUrl: "https://shadow.radr.fun/shadowpay/shadowid/v1/id/status",
            rpcFallbackUrl: "https://api.mainnet-beta.solana.com",
            deloraApiKey: "ppk_7d62d7c7a197a344f6a7d58e348174c08fed40290282d00553c7b33f6d5a4c00",
            eas: {
                projectId: "b16d98b7-d951-4210-82ed-29f196ce1d4e"
            }
        }
    }
};
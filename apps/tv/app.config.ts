const isTv = /^(1|true)$/i.test(process.env.EXPO_TV ?? '');

export default {
  expo: {
    name: 'LeliBramBas+',
    slug: 'lelibrambas-plus',
    version: '1.0.0',
    orientation: isTv ? 'landscape' : 'default',
    userInterfaceStyle: 'dark',
    newArchEnabled: true,
    android: {
      package: 'studios.lelibrambas.plus',
      versionCode: 1,
    },
    ios: {
      bundleIdentifier: 'studios.lelibrambas.plus',
      buildNumber: '1',
      supportsTablet: false,
    },
    plugins: [
      [
        '@react-native-tvos/config-tv',
        {
          isTV: isTv,
          tvosDeploymentTarget: '17.0',
          removeFlipperOnAndroid: true,
        },
      ],
      'expo-video',
    ],
    extra: { isPrivatePrototype: true, target: isTv ? 'tv' : 'mobile' },
  },
};

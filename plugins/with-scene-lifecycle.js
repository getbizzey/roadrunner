const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

// iOS 27 asserts at launch unless the app adopts the UIScene life cycle.
// The SDK 57 template still uses the app-delegate window, so switch it over to
// Expo's `ExpoAppSceneDelegate`, which creates the window and starts React Native.

function withSceneManifest(config) {
  return withInfoPlist(config, (config) => {
    config.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: 'EXExpoAppSceneDelegate',
          },
        ],
      },
    };
    return config;
  });
}

function withSceneAppDelegate(config) {
  return withAppDelegate(config, (config) => {
    if (config.modResults.language !== 'swift') {
      throw new Error('with-scene-lifecycle only supports a Swift AppDelegate');
    }
    let contents = config.modResults.contents;

    if (!contents.includes('ExpoReactNativeFactoryProvider')) {
      contents = contents.replace(
        /class AppDelegate: ExpoAppDelegate \{/,
        'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {'
      );
    }

    // The scene delegate owns the window now; drop the app-delegate window setup.
    contents = contents.replace(
      /\n#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)[\s\S]*?#endif\n/,
      '\n'
    );

    if (!contents.includes('ExpoReactNativeFactoryProvider') || contents.includes('UIScreen.main.bounds')) {
      throw new Error('with-scene-lifecycle could not patch AppDelegate.swift; the template may have changed');
    }

    config.modResults.contents = contents;
    return config;
  });
}

module.exports = function withSceneLifecycle(config) {
  return withSceneAppDelegate(withSceneManifest(config));
};

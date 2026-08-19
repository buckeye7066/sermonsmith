import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sermonsmith.app',
  appName: 'Sermon Smith',
  webDir: '../web/dist',
  server: {
    androidScheme: 'https',
    iosScheme: 'https'
  },
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    scheme: 'SermonSmith'
  },
  android: {
    allowMixedContent: false
  },
  plugins: {
    // Manual OTA web-bundle updates only, driven by the Settings "App Updates"
    // card and the launch/resume checker. No Capgo cloud service: autoUpdate is
    // off and the stats/update endpoints are cleared, so the plugin never talks
    // to anything but our own pinned feed. Every bundle is sha256-verified
    // before it is applied (apps/web/src/lib/mobileUpdater.js) — that is the
    // property whose absence removed the first OTA path in PR #96.
    CapacitorUpdater: {
      autoUpdate: false,
      statsUrl: '',
      updateUrl: ''
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0f172a',
      showSpinner: true,
      spinnerColor: '#3b82f6'
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#0f172a'
    }
  }
};

export default config;

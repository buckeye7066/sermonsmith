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
    // Manual OTA web-bundle updates only (Settings -> "App Updates").
    // No Capgo cloud: autoUpdate off, stats/update endpoints cleared.
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

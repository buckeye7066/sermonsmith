import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sermonsmith.app',
  appName: 'Sermon Smith',
  webDir: '../web/dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;

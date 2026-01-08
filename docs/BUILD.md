# Build Instructions for Sermon Smith

This document provides detailed instructions for building Sermon Smith from source for desktop (Electron) and mobile (Android via Capacitor) platforms.

## Prerequisites

### Required Software

1. **Node.js** (v18 or higher)
   - Download from [nodejs.org](https://nodejs.org/)
   - Verify installation: `node --version`

2. **npm** (comes with Node.js)
   - Verify installation: `npm --version`

3. **Git**
   - Download from [git-scm.com](https://git-scm.com/)
   - Verify installation: `git --version`

### Platform-Specific Requirements

#### Windows
- **For building Windows installers:**
  - Windows 10 or higher
  - No additional requirements (electron-builder handles everything)

#### macOS
- **For building macOS apps:**
  - macOS 10.13 or higher
  - Xcode Command Line Tools: `xcode-select --install`
  - For code signing: Apple Developer account and certificates

#### Linux
- **For building Linux packages:**
  - Any modern Linux distribution
  - Additional packages: `sudo apt-get install build-essential`

#### Android
- **For building Android apps:**
  - Java Development Kit (JDK) 17
  - Android Studio (for building and testing)
  - Android SDK (automatically installed with Android Studio)
  - Set `ANDROID_SDK_ROOT` environment variable

## Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/buckeye7066/sermonsmith.git
   cd sermonsmith
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Generate app icons:**
   ```bash
   npm run generate:icons
   ```

## Building for Desktop (Electron)

### Development Mode

Run the app in development mode with hot reload:

```bash
npm run electron:dev
```

This will:
- Start the Vite dev server on `http://localhost:5173`
- Launch the Electron app pointing to the dev server
- Enable DevTools for debugging

### Production Builds

#### Build for Current Platform

```bash
npm run electron:build
```

This builds for your current operating system.

#### Build for Specific Platforms

**Windows:**
```bash
npm run electron:build:win
```

Output: `dist-electron/Sermon Smith Setup.exe` and portable version

**macOS:**
```bash
npm run electron:build:mac
```

Output: `dist-electron/Sermon Smith.dmg` and `.zip`

**Linux:**
```bash
npm run electron:build:linux
```

Output: `dist-electron/Sermon Smith.AppImage` and `.deb` package

#### Build for All Platforms

```bash
npm run electron:build:all
```

**Note:** Cross-platform builds have limitations:
- Windows builds can only be created on Windows or Linux (with Wine)
- macOS builds can only be created on macOS
- Linux builds can be created on any platform

### Build Configuration

The build is configured via `electron-builder.yml`:

```yaml
appId: com.sermonsmith.app
productName: Sermon Smith
directories:
  output: dist-electron
```

Customize this file to change:
- App icon locations
- Build targets
- Installer options
- Code signing configuration

## Building for Mobile (Android)

### Initial Setup

1. **Install Android Studio:**
   - Download from [developer.android.com/studio](https://developer.android.com/studio)
   - Install Android SDK via Android Studio's SDK Manager
   - Accept SDK licenses: `yes | sdkmanager --licenses`

2. **Set environment variables:**

   **macOS/Linux:**
   ```bash
   export ANDROID_SDK_ROOT=$HOME/Library/Android/sdk
   export PATH=$PATH:$ANDROID_SDK_ROOT/tools:$ANDROID_SDK_ROOT/platform-tools
   ```

   **Windows:**
   ```cmd
   set ANDROID_SDK_ROOT=%LOCALAPPDATA%\Android\Sdk
   set PATH=%PATH%;%ANDROID_SDK_ROOT%\tools;%ANDROID_SDK_ROOT%\platform-tools
   ```

3. **Add Android platform (if not already added):**
   ```bash
   npx cap add android
   ```

### Development Workflow

1. **Build the web app and sync to Android:**
   ```bash
   npm run cap:sync
   ```

2. **Open in Android Studio:**
   ```bash
   npm run cap:open:android
   ```

3. **Run on device/emulator:**
   - Click the green "Run" button in Android Studio
   - Select your device or emulator
   - App will be built and installed

### Production Build

1. **Sync latest changes:**
   ```bash
   npm run cap:sync
   ```

2. **In Android Studio:**
   - Build → Generate Signed Bundle / APK
   - Select APK or Android App Bundle
   - Choose release build variant
   - Sign with your keystore

3. **Output locations:**
   - APK: `android/app/build/outputs/apk/release/`
   - AAB: `android/app/build/outputs/bundle/release/`

### Android Configuration

The Android app is configured via `capacitor.config.ts`:

```typescript
{
  appId: 'com.sermonsmith.app',
  appName: 'Sermon Smith',
  webDir: 'dist'
}
```

Additional Android-specific settings in `android/app/build.gradle`:
- Package name: `com.sermonsmith.app`
- Version code and name
- Minimum SDK version
- Target SDK version

## Common Build Issues

### Electron Issues

**Problem:** "electron: command not found"
- **Solution:** Run `npm install` to ensure all dependencies are installed

**Problem:** Icon not showing in built app
- **Solution:** Run `npm run generate:icons` before building

**Problem:** App opens with blank white screen
- **Solution:** Check that `vite build` completed successfully and `dist/` folder exists

### Capacitor/Android Issues

**Problem:** "Android SDK not found"
- **Solution:** Set `ANDROID_SDK_ROOT` environment variable correctly

**Problem:** Build fails with "Could not find method implementation()"
- **Solution:** Update Android Studio and Gradle to latest versions

**Problem:** App crashes on Android
- **Solution:** Check Android logcat: `adb logcat | grep Capacitor`

### General Issues

**Problem:** Dependencies fail to install
- **Solution:** 
  - Clear npm cache: `npm cache clean --force`
  - Delete `node_modules` and `package-lock.json`
  - Run `npm install` again

**Problem:** Build is very slow
- **Solution:**
  - Close unnecessary applications
  - For Electron, build for specific platform instead of all platforms
  - Consider using a faster machine or CI/CD service

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Build Desktop Apps

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
    
    runs-on: ${{ matrix.os }}
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Generate icons
        run: npm run generate:icons
      
      - name: Build
        run: npm run electron:build
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: ${{ matrix.os }}-build
          path: dist-electron/
```

## Versioning

Update version numbers in:
1. `package.json` - `"version": "1.0.0"`
2. `android/app/build.gradle` - `versionCode` and `versionName`
3. Create git tag: `git tag v1.0.0 && git push --tags`

## Code Signing

### macOS
1. Get Apple Developer account
2. Create Developer ID Application certificate
3. Add to `electron-builder.yml`:
   ```yaml
   mac:
     identity: "Developer ID Application: Your Name (TEAM_ID)"
   ```

### Windows
1. Get code signing certificate (e.g., from DigiCert)
2. Add to `electron-builder.yml`:
   ```yaml
   win:
     certificateFile: "path/to/cert.pfx"
     certificatePassword: "password"
   ```

### Android
1. Generate keystore: `keytool -genkey -v -keystore my-release-key.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000`
2. Add keystore path to `android/app/build.gradle`
3. Never commit keystore to version control!

## Support

For build issues:
- Check [Electron Builder docs](https://www.electron.build/)
- Check [Capacitor docs](https://capacitorjs.com/)
- Open an issue on GitHub

## License

See the main README.md for license information.

# Sermon Smith

**Sermon Smith** is a comprehensive sermon preparation and Bible study application available as a web app, desktop application, and mobile app. Built on the Base44 platform, it provides powerful tools for pastors, teachers, and Bible students.

## Features

- 📖 **Bible Study Tools** - Read and compare multiple Bible translations
- ✍️ **Sermon Preparation** - Create and organize sermon notes and outlines
- 🤖 **AI-Powered Assistance** - Get help with sermon ideas and content generation
- 📱 **Cross-Platform** - Available on Windows, macOS, Linux, and Android
- 🔌 **Offline Support** - Access previously viewed content without internet
- 🎨 **Modern Interface** - Clean, intuitive design built with React

## Installation

### Desktop Apps

#### Windows
1. Download `Sermon Smith Setup.exe` from the [Releases](https://github.com/buckeye7066/sermonsmith/releases) page
2. Run the installer
3. Choose installation directory (or use default)
4. Create desktop shortcut when prompted
5. Launch Sermon Smith from the desktop icon or Start menu

#### macOS
1. Download `Sermon Smith.dmg` from the [Releases](https://github.com/buckeye7066/sermonsmith/releases) page
2. Open the DMG file
3. Drag "Sermon Smith" to the Applications folder
4. Launch from Applications or Spotlight
5. If prompted about an unidentified developer, go to System Preferences → Security & Privacy and click "Open Anyway"

#### Linux
1. Download `Sermon Smith.AppImage` from the [Releases](https://github.com/buckeye7066/sermonsmith/releases) page
2. Make it executable: `chmod +x Sermon-Smith.AppImage`
3. Run: `./Sermon-Smith.AppImage`
4. Or use the `.deb` package: `sudo dpkg -i sermon-smith.deb`

### Android
1. Download the APK from the [Releases](https://github.com/buckeye7066/sermonsmith/releases) page
2. Enable "Install from Unknown Sources" in Android settings
3. Open the APK file to install
4. Launch "Sermon Smith" from your app drawer

### Web App
Visit the hosted version at your Base44 instance URL.

## First-Run Configuration

When you launch Sermon Smith for the first time on desktop, you'll see a setup wizard that asks for:

1. **Base44 App ID** - Your Base44 application identifier (e.g., `app_123456789`)
2. **Backend URL** - Your Base44 backend instance URL (e.g., `https://your-backend.base44.io`)

**Where to find these:**
- Your Base44 App ID is available in your Base44 dashboard
- The Backend URL is provided when you set up your Base44 backend
- Contact your administrator if you don't have these credentials

**Note:** Mobile and web versions get these from environment variables configured during deployment.

### Reconfiguring
You can update these settings later from the app's Settings page.

## Offline Mode

Sermon Smith supports hybrid offline functionality:

### What Works Offline ✅
- Previously viewed sermons
- Previously viewed Bible passages
- Your saved sermons and studies
- Reading and reviewing cached content
- Navigation through cached pages

### What Requires Internet ❌
- AI-powered content generation
- Fetching new Bible passages
- Creating new sermons with AI assistance
- Syncing data across devices
- Authentication and login

### How Offline Mode Works
- Content is automatically cached when you view it
- An offline banner appears when you lose internet connection
- Cached content remains available for 30 days
- When back online, the app automatically syncs latest changes

## Development

### Prerequisites
- Node.js 18 or higher
- npm

### Setup
```bash
# Clone the repository
git clone https://github.com/buckeye7066/sermonsmith.git
cd sermonsmith

# Install dependencies
npm install

# Start development server
npm run dev
```

### Building from Source

See [docs/BUILD.md](docs/BUILD.md) for detailed build instructions.

**Quick commands:**
```bash
# Desktop development
npm run electron:dev

# Build desktop app (current platform)
npm run electron:build

# Build for specific platforms
npm run electron:build:win    # Windows
npm run electron:build:mac    # macOS
npm run electron:build:linux  # Linux

# Android development
npm run cap:sync              # Sync web app to Android
npm run cap:open:android      # Open in Android Studio

# Generate app icons
npm run generate:icons
```

## Project Structure

```
sermonsmith/
├── src/                      # React application source
│   ├── components/          # React components
│   ├── lib/                 # Utilities and libraries
│   │   ├── offlineCache.js  # IndexedDB caching
│   │   └── offlineDetector.js # Offline detection
│   ├── pages/               # Page components
│   └── App.jsx              # Main app component
├── electron/                # Electron main process
│   ├── main.js              # Main process entry
│   ├── preload.js           # Preload script
│   └── first-run.html       # Setup wizard
├── android/                 # Capacitor Android project
├── public/                  # Static assets
│   └── sw.js                # Service worker
├── scripts/                 # Build scripts
│   ├── generate-base-icon.js
│   └── generate-icons.js
├── docs/                    # Documentation
│   └── BUILD.md             # Build instructions
└── dist/                    # Production build output
```

## Technology Stack

- **Frontend:** React 18, React Router, Tailwind CSS
- **UI Components:** Radix UI, shadcn/ui
- **State Management:** TanStack Query
- **Desktop:** Electron 28
- **Mobile:** Capacitor 5
- **Backend:** Base44 SDK
- **Offline Storage:** IndexedDB (via idb)
- **Build Tools:** Vite, electron-builder

## Error Handling

### Connection Issues
If you can't connect to your Base44 backend:
1. Verify your App ID and Backend URL in Settings
2. Check your internet connection
3. Ensure your Base44 backend is running
4. Check firewall/proxy settings

### First-Run Wizard Issues
If the setup wizard doesn't appear:
1. Clear the app's stored configuration
   - Windows: `%APPDATA%/sermon-smith/`
   - macOS: `~/Library/Application Support/sermon-smith/`
   - Linux: `~/.config/sermon-smith/`
2. Restart the application

### Offline Mode Issues
If cached content isn't available:
1. Ensure you viewed the content while online
2. Check that you haven't cleared browser/app data
3. Content cache expires after 30 days

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Support

- **Issues:** [GitHub Issues](https://github.com/buckeye7066/sermonsmith/issues)
- **Documentation:** [docs/BUILD.md](docs/BUILD.md)
- **Base44 Platform:** [base44.com](https://base44.com)

## License

This project is built on the Base44 platform. See LICENSE file for details.

## Acknowledgments

- Built with [Base44 SDK](https://github.com/base44)
- Icons use Christian cross design with modern gradient
- UI components from [shadcn/ui](https://ui.shadcn.com)
- Powered by [Vite](https://vitejs.dev), [Electron](https://electronjs.org), and [Capacitor](https://capacitorjs.com)

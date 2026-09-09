# Update delivery

Browser tabs, including Safari and installed PWAs, check the existing production mobile feed on startup, focus and every 15 minutes while visible. Update reloads only after the user's confirmation; Later leaves the current session running. Build identity is generated once by Vite, embedded in the renderer, and reused in the OTA manifest. Every build is discoverable even when the package version is unchanged.

Android/iOS keep the existing checksum-verified Capacitor OTA path. Checks also run while the app remains open. Native shell changes still require a signed package from the platform distribution channel; OTA cannot install native plugins or permissions. This release does not provision APNs/FCM: a closed app receives no remote push.

Windows desktop uses electron-updater with a pinned public GitHub feed at the desktop-updates release. It checks on startup, focus and hourly, offers Update, verifies the download, then separately offers Restart and install. It never installs on ordinary quit. Check for updates remains in the application menu. User data and configuration directories are unchanged.

Desktop release workflow runs only after successful main-branch CI for the exact source SHA. Installer version is 1.run_number.run_attempt, independent of package edits. Installers and blockmaps upload before latest.yml. desktop-updates is not marked GitHub's latest release, preserving existing Android links. Old payloads remain available for clients reading the previous manifest during publication.

## Rollout limitations

- Older desktop installations contain no updater. They need one bootstrap install of the new NSIS package; editing this repository cannot change a binary already installed on another machine.
- No Windows signing certificate or Apple signing/notarization secrets were present during the September 2026 rollout inspection. Windows artifacts therefore remain unsigned unless publisher credentials are configured. SHA-512 verification and HTTPS feed integrity do not imply Authenticode signing.
- macOS installers require the owner's Apple Developer signing/notarization credentials and a macOS release runner before a supported automatic native update can be claimed. iOS store distribution likewise remains an external release requirement.
- Tests of decision logic are automated simulations; they do not prove an installed-device upgrade or signing.

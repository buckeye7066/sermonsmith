# Repo-direct Android updates

SermonSmith publishes a signed release APK from `main` after the repository release gates pass. The Android package id remains `com.sermonsmith.app`, and subsequent releases verify the persistent signing certificate against the prior Android release fingerprint.

## One-time bootstrap for older repo-installed copies

The previous GitHub workflow distributed a debug-signed Android APK. Android will not install a release-signed APK over a package signed with a different debug certificate.

If the phone currently has the old debug APK, back up any device-local data that matters, uninstall that copy once, and install the first `SermonSmith-*.apk` from the GitHub Android release feed. Future repo-direct releases can then update in place because they retain the same package id and signing identity.

Every signed release includes `sermonsmith-signing-cert.sha256` and an APK checksum. After the bootstrap release, CI compares its configured keystore certificate with the prior published fingerprint before building another update.

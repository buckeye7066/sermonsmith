import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ICON_DIR = join(__dirname, '..', 'src', 'assets', 'icons');
const SOURCE_PNG = join(ICON_DIR, 'icon.png');

// Windows ICO sizes (electron-builder will handle conversion from PNG)
const WINDOWS_SIZES = [256];

// macOS sizes (electron-builder will handle conversion from PNG to .icns)
const MAC_SIZES = [512];

// Android icon sizes
const ANDROID_SIZES = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192
};

async function generateWindowsIcon() {
  console.log('Generating Windows icon (256x256 PNG - electron-builder will convert to .ico)...');
  
  const icoPath = join(ICON_DIR, 'icon-256.png');
  await sharp(SOURCE_PNG)
    .resize(256, 256)
    .png()
    .toFile(icoPath);
  
  console.log(`✓ Created: ${icoPath}`);
  console.log('  Note: electron-builder will automatically convert this to .ico during build');
}

async function generateMacIcon() {
  console.log('Generating macOS icon (512x512 PNG - electron-builder will convert to .icns)...');
  
  // electron-builder can convert from 512x512 PNG to .icns
  const icnsPath = join(ICON_DIR, 'icon-512.png');
  await sharp(SOURCE_PNG)
    .resize(512, 512)
    .png()
    .toFile(icnsPath);
  
  console.log(`✓ Created: ${icnsPath}`);
  console.log('  Note: electron-builder will automatically convert this to .icns during build');
}

async function generateAndroidIcons() {
  console.log('Generating Android adaptive icons...');
  
  const androidDir = join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');
  
  // Check if android directory exists
  if (!existsSync(androidDir)) {
    console.log('⚠ Android directory not found. Run "npm run cap:sync" first to create it.');
    return;
  }
  
  for (const [folder, size] of Object.entries(ANDROID_SIZES)) {
    const folderPath = join(androidDir, folder);
    if (!existsSync(folderPath)) {
      mkdirSync(folderPath, { recursive: true });
    }
    
    const iconPath = join(folderPath, 'ic_launcher.png');
    await sharp(SOURCE_PNG)
      .resize(size, size)
      .png()
      .toFile(iconPath);
    
    console.log(`✓ Created: ${iconPath}`);
  }
}

async function main() {
  if (!existsSync(SOURCE_PNG)) {
    console.error('Error: Base icon not found at', SOURCE_PNG);
    console.log('Run: node scripts/generate-base-icon.js first');
    process.exit(1);
  }
  
  console.log('Starting icon generation from', SOURCE_PNG);
  console.log('');
  
  try {
    await generateWindowsIcon();
    await generateMacIcon();
    await generateAndroidIcons();
    
    console.log('');
    console.log('✓ All icons generated successfully!');
  } catch (error) {
    console.error('Error generating icons:', error);
    process.exit(1);
  }
}

main();

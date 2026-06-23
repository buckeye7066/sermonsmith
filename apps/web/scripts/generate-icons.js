import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ICON_DIR = join(__dirname, '..', 'src', 'assets', 'icons');
const SOURCE_SVG = join(ICON_DIR, 'icon.svg');

// Standalone PNG deliverables (also the masters electron-builder consumes).
const PNG_SIZES = [1024, 512, 256];
// Frames packed into the multi-resolution Windows .ico. 256 gives a crisp
// Start-Menu / large-tile icon; 16-32 keep the taskbar/tray sharp.
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];
// Android adaptive launcher densities.
const ANDROID_SIZES = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

// Render a transparent square PNG of `size` from the SVG. density 384 keeps
// edges/glow crisp when the vector is rasterised down to small sizes.
function render(size) {
  return sharp(SOURCE_SVG, { density: 384 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

// Build a Windows .ico from PNG-compressed entries (supported on Vista+).
function buildIco(entries) {
  const count = entries.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: 1 = icon
  header.writeUInt16LE(count, 4);

  const dir = Buffer.alloc(16 * count);
  let offset = 6 + 16 * count;
  const bodies = [];
  entries.forEach((e, i) => {
    const base = i * 16;
    dir.writeUInt8(e.size >= 256 ? 0 : e.size, base + 0); // width (0 => 256)
    dir.writeUInt8(e.size >= 256 ? 0 : e.size, base + 1); // height
    dir.writeUInt8(0, base + 2); // palette count
    dir.writeUInt8(0, base + 3); // reserved
    dir.writeUInt16LE(1, base + 4); // color planes
    dir.writeUInt16LE(32, base + 6); // bits per pixel
    dir.writeUInt32LE(e.buffer.length, base + 8);
    dir.writeUInt32LE(offset, base + 12);
    offset += e.buffer.length;
    bodies.push(e.buffer);
  });
  return Buffer.concat([header, dir, ...bodies]);
}

async function generatePngs() {
  for (const size of PNG_SIZES) {
    writeFileSync(join(ICON_DIR, `icon-${size}.png`), await render(size));
    console.log(`✓ icon-${size}.png`);
  }
  // icon.png is the canonical master referenced by electron-builder.yml.
  writeFileSync(join(ICON_DIR, 'icon.png'), await render(1024));
  console.log('✓ icon.png (1024 master)');
}

async function generateIco() {
  const entries = [];
  for (const size of ICO_SIZES) entries.push({ size, buffer: await render(size) });
  writeFileSync(join(ICON_DIR, 'icon.ico'), buildIco(entries));
  console.log(`✓ icon.ico [${ICO_SIZES.join(', ')}]`);
}

async function generateAndroidIcons() {
  const androidDir = join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');
  if (!existsSync(androidDir)) {
    console.log('⚠ Android dir not found — run "npm run cap:sync" first (skipped).');
    return;
  }
  for (const [folder, size] of Object.entries(ANDROID_SIZES)) {
    const folderPath = join(androidDir, folder);
    if (!existsSync(folderPath)) mkdirSync(folderPath, { recursive: true });
    writeFileSync(join(folderPath, 'ic_launcher.png'), await render(size));
    console.log(`✓ ${folder}/ic_launcher.png`);
  }
}

async function main() {
  if (!existsSync(SOURCE_SVG)) {
    console.error('Error: source icon not found at', SOURCE_SVG);
    process.exit(1);
  }
  console.log('Generating icons from', SOURCE_SVG, '\n');
  try {
    await generatePngs();
    await generateIco();
    await generateAndroidIcons();
    console.log('\n✓ All icons generated.');
  } catch (error) {
    console.error('Error generating icons:', error);
    process.exit(1);
  }
}

main();

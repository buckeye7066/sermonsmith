import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Icon configuration
const SIZE = 512;
const OUTPUT_DIR = join(__dirname, '..', 'src', 'assets', 'icons');

// Ensure output directory exists
if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Create SVG for the icon (cross on blue gradient)
const createIconSVG = () => {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bg-gradient" cx="50%" cy="50%" r="50%">
      <stop offset="0%" style="stop-color:#60a5fa;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#3b82f6;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#1e40af;stop-opacity:1" />
    </radialGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="10"/>
      <feOffset dx="0" dy="0" result="offsetblur"/>
      <feComponentTransfer>
        <feFuncA type="linear" slope="2"/>
      </feComponentTransfer>
      <feMerge>
        <feMergeNode/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  
  <!-- Background circle with gradient -->
  <circle cx="${SIZE/2}" cy="${SIZE/2}" r="${SIZE/2}" fill="url(#bg-gradient)"/>
  
  <!-- Cross with glow effect -->
  <g filter="url(#glow)">
    <!-- Vertical bar of cross -->
    <rect x="${SIZE/2 - 30}" y="${SIZE/2 - 150}" width="60" height="300" rx="10" fill="white"/>
    <!-- Horizontal bar of cross -->
    <rect x="${SIZE/2 - 120}" y="${SIZE/2 - 30}" width="240" height="60" rx="10" fill="white"/>
  </g>
</svg>`;
};

async function generateBaseIcon() {
  console.log('Generating base icon (512x512 PNG)...');
  
  const svg = createIconSVG();
  const outputPath = join(OUTPUT_DIR, 'icon.png');
  
  await sharp(Buffer.from(svg))
    .resize(SIZE, SIZE)
    .png()
    .toFile(outputPath);
  
  console.log(`✓ Created: ${outputPath}`);
  
  // Also save the SVG
  const svgPath = join(OUTPUT_DIR, 'icon.svg');
  const fs = await import('fs/promises');
  await fs.writeFile(svgPath, svg);
  console.log(`✓ Created: ${svgPath}`);
}

generateBaseIcon().catch(console.error);

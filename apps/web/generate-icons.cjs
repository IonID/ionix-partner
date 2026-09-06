/**
 * Ionix — Icon generator
 * Run once: node generate-icons.cjs
 * Installs sharp automatically if missing, generates all PNG sizes + favicon.ico
 */

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const publicDir = path.join(__dirname, 'public');
const svgPath   = path.join(publicDir, 'icon.svg');

// ── Auto-install sharp if missing ────────────────────────────────────
let sharp;
const sharpPath = path.join(__dirname, 'node_modules', 'sharp');
try {
  sharp = require(sharpPath);
} catch {
  console.log('📦 Installing sharp...');
  execSync('npm install --no-save sharp', { stdio: 'inherit', cwd: __dirname });
  sharp = require(sharpPath);
}

// ── PNG sizes to generate ────────────────────────────────────────────
const PNG_SIZES = [
  { name: 'favicon-16.png',  size: 16  },
  { name: 'favicon-32.png',  size: 32  },
  { name: 'favicon-48.png',  size: 48  },
  { name: 'favicon-192.png', size: 192 },
  { name: 'favicon-512.png', size: 512 },
  { name: 'apple-icon.png',  size: 180 },
  { name: 'icon-192.png',    size: 192 },
  { name: 'icon-512.png',    size: 512 },
  { name: 'icon-1024.png',   size: 1024 },
  { name: 'icon-1024-alt.png', size: 1024 },
];

// ── ICO builder (pure Node.js, no extra deps) ────────────────────────
// Embeds PNG blobs directly — supported by all modern browsers + Windows
function buildIco(pngBuffers) {
  const count     = pngBuffers.length;
  const dirSize   = 6 + count * 16;
  let   dataOffset = dirSize;

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: 1 = ICO
  header.writeUInt16LE(count, 4);

  const entryBufs = pngBuffers.map((png) => {
    // PNG IHDR: width @ offset 16, height @ offset 20 (big-endian uint32)
    const w = png.readUInt32BE(16);
    const h = png.readUInt32BE(20);
    const entry = Buffer.alloc(16);
    entry.writeUInt8(w >= 256 ? 0 : w, 0);   // 0 means 256
    entry.writeUInt8(h >= 256 ? 0 : h, 1);
    entry.writeUInt8(0, 2);   // color count (0 = no palette)
    entry.writeUInt8(0, 3);   // reserved
    entry.writeUInt16LE(1,  4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(dataOffset, 12);
    dataOffset += png.length;
    return entry;
  });

  return Buffer.concat([header, ...entryBufs, ...pngBuffers]);
}

// ── Main ─────────────────────────────────────────────────────────────
async function run() {
  const svg = fs.readFileSync(svgPath);
  console.log('\n🎨 Generating icons from icon.svg…\n');

  // Generate all PNGs
  for (const { name, size } of PNG_SIZES) {
    const out = path.join(publicDir, name);
    await sharp(svg).resize(size, size).png().toFile(out);
    console.log(`  ✓ ${name.padEnd(22)} ${size}×${size}`);
  }

  // Generate favicon.ico (16 + 32 + 48 embedded)
  const icoSizes  = [16, 32, 48];
  const icoBuffers = await Promise.all(
    icoSizes.map((s) => sharp(svg).resize(s, s).png().toBuffer())
  );
  const icoPath = path.join(publicDir, 'favicon.ico');
  fs.writeFileSync(icoPath, buildIco(icoBuffers));
  console.log(`  ✓ favicon.ico             (16+32+48 embedded)`);

  console.log('\n✅ Done! All icons updated in public/\n');
}

run().catch((err) => { console.error(err); process.exit(1); });

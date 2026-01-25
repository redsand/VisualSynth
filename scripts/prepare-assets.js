const fs = require('fs');
const path = require('path');

const buildDir = path.resolve(__dirname, '..', 'build');
const iconPath = path.join(buildDir, 'icon.ico');

const createIcoBuffer = () => {
  const width = 16;
  const height = 16;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type
  header.writeUInt16LE(1, 4); // count

  const entry = Buffer.alloc(16);
  entry.writeUInt8(width, 0);
  entry.writeUInt8(height, 1);
  entry.writeUInt8(0, 2); // color count
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // planes
  entry.writeUInt16LE(32, 6); // bit count

  const bmpHeader = Buffer.alloc(40);
  bmpHeader.writeUInt32LE(40, 0); // header size
  bmpHeader.writeInt32LE(width, 4);
  bmpHeader.writeInt32LE(height * 2, 8); // color + mask
  bmpHeader.writeUInt16LE(1, 12); // planes
  bmpHeader.writeUInt16LE(32, 14); // bit count
  bmpHeader.writeUInt32LE(0, 16); // compression
  bmpHeader.writeUInt32LE(width * height * 4, 20); // image size

  const pixels = Buffer.alloc(width * height * 4);
  const color = { r: 30, g: 200, b: 255, a: 255 };
  for (let i = 0; i < width * height; i += 1) {
    const offset = i * 4;
    pixels[offset] = color.b;
    pixels[offset + 1] = color.g;
    pixels[offset + 2] = color.r;
    pixels[offset + 3] = color.a;
  }

  const maskRowBytes = Math.ceil(width / 32) * 4;
  const mask = Buffer.alloc(maskRowBytes * height);

  const imageData = Buffer.concat([bmpHeader, pixels, mask]);
  entry.writeUInt32LE(imageData.length, 8);
  entry.writeUInt32LE(header.length + entry.length, 12);

  return Buffer.concat([header, entry, imageData]);
};

const ensureIcon = () => {
  fs.mkdirSync(buildDir, { recursive: true });
  if (!fs.existsSync(iconPath)) {
    const buffer = createIcoBuffer();
    fs.writeFileSync(iconPath, buffer);
  }
};

ensureIcon();

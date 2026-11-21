// Extract the cover art embedded in an audio file (dependency-free).
//
// DJ edits and remixes aren't in iTunes, so a web artwork search misses
// them — but DJ-pool files almost always carry their cover embedded. When
// the DJ software (Serato) tells us the exact file playing, this pulls that
// image straight out of the file into the artwork cache.
//
// Supported: MP3 ID3v2.3/2.4 APIC frames (front cover preferred), and
// MP4/M4A/AAC `covr` atoms. Anything else returns null.

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export interface EmbeddedImage {
  mime: string;
  data: Buffer;
}

const MAX_TAG_BYTES = 16 * 1024 * 1024;

const synchsafe = (b: Buffer, o: number) =>
  ((b[o] & 0x7f) << 21) | ((b[o + 1] & 0x7f) << 14) | ((b[o + 2] & 0x7f) << 7) | (b[o + 3] & 0x7f);

/** Parse ID3v2 APIC frames from the tag at the start of an MP3 buffer. */
export const extractId3Picture = (buf: Buffer): EmbeddedImage | null => {
  if (buf.length < 10 || buf.toString('latin1', 0, 3) !== 'ID3') return null;
  const major = buf[3];
  if (major !== 3 && major !== 4) return null;
  const flags = buf[5];
  const tagSize = synchsafe(buf, 6);
  const end = Math.min(buf.length, 10 + tagSize);
  let offset = 10;
  if (flags & 0x40) {
    // extended header: v2.4 size is synchsafe and includes itself; v2.3 excludes its 4 size bytes
    const extSize = major === 4 ? synchsafe(buf, offset) : buf.readUInt32BE(offset) + 4;
    offset += extSize;
  }
  let fallback: EmbeddedImage | null = null;
  while (offset + 10 <= end) {
    const id = buf.toString('latin1', offset, offset + 4);
    if (!/^[A-Z0-9]{4}$/.test(id)) break; // padding
    const size = major === 4 ? synchsafe(buf, offset + 4) : buf.readUInt32BE(offset + 4);
    const bodyStart = offset + 10;
    const bodyEnd = bodyStart + size;
    if (size <= 0 || bodyEnd > end) break;
    if (id === 'APIC') {
      const body = buf.subarray(bodyStart, bodyEnd);
      const encoding = body[0];
      let p = 1;
      const mimeEnd = body.indexOf(0, p);
      if (mimeEnd < 0) break;
      let mime = body.toString('latin1', p, mimeEnd).toLowerCase() || 'image/jpeg';
      if (!mime.includes('/')) mime = `image/${mime === 'jpg' ? 'jpeg' : mime}`;
      p = mimeEnd + 1;
      const pictureType = body[p];
      p += 1;
      // description: null-terminated; UTF-16 encodings (1, 2) end with 0x00 0x00
      if (encoding === 1 || encoding === 2) {
        while (p + 1 < body.length && !(body[p] === 0 && body[p + 1] === 0)) p += 2;
        p += 2;
      } else {
        const descEnd = body.indexOf(0, p);
        p = descEnd < 0 ? body.length : descEnd + 1;
      }
      const image = { mime, data: Buffer.from(body.subarray(p)) };
      if (image.data.length > 0) {
        if (pictureType === 3) return image; // front cover
        fallback = fallback ?? image;
      }
    }
    offset = bodyEnd;
  }
  return fallback;
};

/** Find the first `covr` → `data` image in an MP4/M4A buffer. */
export const extractMp4Cover = (buf: Buffer): EmbeddedImage | null => {
  const idx = buf.indexOf('covr', 0, 'latin1');
  if (idx < 4) return null;
  const covrSize = buf.readUInt32BE(idx - 4);
  const dataAt = idx + 4;
  if (buf.toString('latin1', dataAt + 4, dataAt + 8) !== 'data') return null;
  const dataSize = buf.readUInt32BE(dataAt);
  const type = buf.readUInt32BE(dataAt + 8); // 13 = JPEG, 14 = PNG
  const start = dataAt + 16; // size + 'data' + type + locale
  const stop = Math.min(dataAt + dataSize, idx - 4 + covrSize, buf.length);
  if (stop <= start) return null;
  return { mime: type === 14 ? 'image/png' : 'image/jpeg', data: Buffer.from(buf.subarray(start, stop)) };
};

/** Read just enough of an audio file and pull its embedded cover. */
export const readEmbeddedPicture = (audioPath: string): EmbeddedImage | null => {
  const ext = path.extname(audioPath).toLowerCase();
  let fd: number | null = null;
  try {
    fd = fs.openSync(audioPath, 'r');
    if (ext === '.mp3') {
      const head = Buffer.alloc(10);
      fs.readSync(fd, head, 0, 10, 0);
      if (head.toString('latin1', 0, 3) !== 'ID3') return null;
      const tagBytes = Math.min(10 + synchsafe(head, 6), MAX_TAG_BYTES);
      const tag = Buffer.alloc(tagBytes);
      fs.readSync(fd, tag, 0, tagBytes, 0);
      return extractId3Picture(tag);
    }
    if (ext === '.m4a' || ext === '.mp4' || ext === '.aac' || ext === '.alac') {
      const size = Math.min(fs.fstatSync(fd).size, 64 * 1024 * 1024);
      const all = Buffer.alloc(size);
      fs.readSync(fd, all, 0, size, 0);
      return extractMp4Cover(all);
    }
    return null;
  } catch {
    return null;
  } finally {
    if (fd !== null) try { fs.closeSync(fd); } catch { /* ignore */ }
  }
};

/** Extract embedded art into the artwork cache; returns the cached file path. */
export const cacheEmbeddedArtwork = (audioPath: string, assetStorage: string): string | null => {
  const image = readEmbeddedPicture(audioPath);
  if (!image || image.data.length < 64) return null;
  const ext = image.mime === 'image/png' ? '.png' : image.mime === 'image/webp' ? '.webp' : '.jpg';
  const hash = crypto.createHash('sha256').update(image.data).digest('hex');
  try {
    fs.mkdirSync(assetStorage, { recursive: true });
    const filePath = path.join(assetStorage, `${hash}${ext}`);
    if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, image.data);
    return filePath;
  } catch {
    return null;
  }
};

// ── DJ-pool logo rejection ──────────────────────────────────────────────────
// Measured on a live Serato set: 4 of 5 embedded "covers" were DJ-pool
// logos (DJcity, BPM Supreme, Wedding DJ Pool), not album art. A real cover
// belongs to one artist; a logo is stamped on tracks by MANY artists. So an
// image hash seen across >= 2 distinct artists is treated as a logo and never
// shown. The map is seeded from recent DJ history before first use, so a
// logo is recognized before it would ever reach the screen.
const artistsByImageHash = new Map<string, Set<string>>();
const normArtist = (a?: string) => (a ?? '').toLowerCase().split(/\s+(?:ft\.?|feat\.?|&|x|vs\.?)\s+/)[0].replace(/[^a-z0-9]/g, '');

const imageHash = (data: Buffer) => crypto.createHash('sha256').update(data).digest('hex');

/** Record a (file, artist) pair so shared logos can be detected. */
export const observeTrackArtwork = (audioPath: string, artist?: string): void => {
  const image = readEmbeddedPicture(audioPath);
  if (!image) return;
  const key = imageHash(image.data);
  const set = artistsByImageHash.get(key) ?? new Set<string>();
  const who = normArtist(artist);
  if (who) set.add(who);
  artistsByImageHash.set(key, set);
};

export const isLikelyPoolLogo = (data: Buffer): boolean =>
  (artistsByImageHash.get(imageHash(data))?.size ?? 0) >= 2;

/**
 * Embedded cover for the now-playing track, rejecting DJ-pool logos.
 * Returns the cached file path, or a reason it was not used.
 */
export const embeddedCoverForTrack = (
  audioPath: string,
  artist: string | undefined,
  assetStorage: string
): { filePath?: string; rejected?: 'no-art' | 'pool-logo' } => {
  observeTrackArtwork(audioPath, artist);
  const image = readEmbeddedPicture(audioPath);
  if (!image || image.data.length < 64) return { rejected: 'no-art' };
  if (isLikelyPoolLogo(image.data)) return { rejected: 'pool-logo' };
  const filePath = cacheEmbeddedArtwork(audioPath, assetStorage);
  return filePath ? { filePath } : { rejected: 'no-art' };
};

/** Test hook. */
export const resetPoolLogoMemory = () => artistsByImageHash.clear();

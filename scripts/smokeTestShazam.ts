import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { identifyNowPlaying } from '../src/main/nowPlayingLookup';

/**
 * Shazam smoke test: feeds a REAL local music file through the exact
 * main-process Shazam path (PCM → local fingerprint → amp.shazam.com tag
 * request) so we can verify end-to-end whether the unofficial Shazam
 * integration actually works, independent of the Electron renderer.
 *
 * Usage:
 *   npx ts-node scripts/smokeTestShazam.ts <audio-file> [seekSec=30] [durationSec=12]
 *
 * The clip is decoded to 16 kHz mono s16le PCM (the format the renderer's
 * rolling capture exports) before fingerprinting, mirroring the live path.
 */

const SHAZAM_SAMPLE_RATE = 16000;

const main = async (): Promise<void> => {
  const file = process.argv[2];
  if (!file || !fs.existsSync(file)) {
    console.error('Usage: npx ts-node scripts/smokeTestShazam.ts <audio-file> [seekSec=30] [durationSec=12]');
    process.exit(1);
  }

  const seekSec = Number(process.argv[3] ?? 30);
  const durationSec = Number(process.argv[4] ?? 12);

  // Decode to the same format the renderer exports for Shazam.
  const tmp = path.join(os.tmpdir(), `shazam-smoke-${process.pid}.pcm`);
  try {
    execFileSync('ffmpeg', [
      '-hide_banner', '-loglevel', 'error',
      '-ss', String(seekSec),
      '-t', String(durationSec),
      '-i', file,
      '-ac', '1',
      '-ar', String(SHAZAM_SAMPLE_RATE),
      '-f', 's16le',
      tmp
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
  } catch (err) {
    console.error(`ffmpeg failed to decode "${file}":`, err instanceof Error ? err.message : err);
    process.exit(1);
  }

  const pcm = fs.readFileSync(tmp);
  fs.unlinkSync(tmp);
  const numSamples = Math.floor(pcm.byteLength / 2);
  if (numSamples < 48000) {
    console.error(`Clip too short: ${numSamples} samples (${(numSamples / SHAZAM_SAMPLE_RATE).toFixed(1)}s). Need at least 3s.`);
    process.exit(1);
  }

  console.log(`[smoke] file:      ${file}`);
  console.log(`[smoke] clip:      ${durationSec}s from ${seekSec}s → ${numSamples} PCM samples @ ${SHAZAM_SAMPLE_RATE}Hz mono`);

  const startedAt = Date.now();
  const result = await identifyNowPlaying({
    provider: 'shazam',
    audioBase64: pcm.toString('base64'),
    mimeType: 'audio/pcm-s16le',
    numSamples,
    durationMs: Math.round((numSamples / SHAZAM_SAMPLE_RATE) * 1000),
    detectedAt: startedAt,
    market: 'US'
  });

  console.log(`[smoke] elapsed:   ${Date.now() - startedAt}ms`);
  console.log('[smoke] result:', JSON.stringify({ ...result, raw: undefined }, null, 2));
  if (!result.matched && result.raw) {
    // Empty-match payloads are the main diagnostic dead end — dump what
    // Shazam actually returned (match count, any tag/timestamp fields).
    console.log('[smoke] raw payload:', JSON.stringify(result.raw).slice(0, 2000));
  }

  if (result.matched) {
    console.log(`\n✅ SHAZAM MATCH: ${result.title ?? '?'} — ${result.artist ?? '?'}`);
  } else {
    console.log(`\n❌ no match: ${result.error ?? 'Shazam returned an empty match payload'}`);
    process.exitCode = 2;
  }
};

void main();
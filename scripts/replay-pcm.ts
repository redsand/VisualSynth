// Replay a dumped raw-PCM clip through the REAL main-process Shazam path
// (dumped by scripts/e2e-song-smoke.ts --keep-pcm). Lets us test mic-captured
// bytes offline without booting the renderer.
// Usage: ts-node --transpile-only scripts/replay-pcm.ts <file.s16>
import fs from 'fs';
import { identifyNowPlaying } from '../src/main/nowPlayingLookup';

const main = async (): Promise<void> => {
  const file = process.argv[2];
  if (!file || !fs.existsSync(file)) {
    console.error('Usage: ts-node --transpile-only scripts/replay-pcm.ts <file.s16>');
    process.exit(1);
  }
  const pcm = fs.readFileSync(file);
  const numSamples = Math.floor(pcm.byteLength / 2);
  const result = await identifyNowPlaying({
    provider: 'shazam',
    audioBase64: pcm.toString('base64'),
    mimeType: 'audio/pcm-s16le',
    numSamples,
    durationMs: Math.round((numSamples / 16000) * 1000),
    detectedAt: Date.now(),
    market: 'US'
  });
  console.log('result:', JSON.stringify({ matched: result.matched, title: result.title, artist: result.artist, error: result.error }));
  if (!result.matched && (result as any).raw) console.log('raw:', JSON.stringify((result as any).raw).slice(0, 500));
};

main();
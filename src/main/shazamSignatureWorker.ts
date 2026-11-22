// Builds the Shazam audio fingerprint off the main process. Fingerprinting
// ~12s of audio is CPU-heavy; on the main process it froze the app's windows
// (main.stall 560ms right after a microphone lookup, 2026-11-22).
import { parentPort } from 'worker_threads';
import { ShazamSignatureGenerator, SIGNATURE_LIMITS } from '../shared/shazamSignature';

parentPort?.on('message', (msg: { id: number; pcm: ArrayBuffer }) => {
  try {
    const gen = new ShazamSignatureGenerator(SIGNATURE_LIMITS.full);
    gen.feed(new Int16Array(msg.pcm));
    const bytes = gen.encode();
    parentPort!.postMessage({ id: msg.id, ok: true, sigBase64: Buffer.from(bytes).toString('base64'), numSamples: gen.numSamples, totalPeaks: gen.totalPeaks });
  } catch (error) {
    parentPort!.postMessage({ id: msg.id, ok: false, error: String(error) });
  }
});

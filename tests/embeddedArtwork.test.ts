import fs from 'fs';
import os from 'os';
import path from 'path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  embeddedCoverForTrack,
  extractId3Picture,
  resetPoolLogoMemory
} from '../src/main/embeddedArtwork';
import { cleanTrackForSearch } from '../src/main/nowPlayingLookup';

// Minimal ID3v2.3 tag with one APIC frame (front cover).
const synchsafe = (n: number) => Buffer.from([(n >> 21) & 0x7f, (n >> 14) & 0x7f, (n >> 7) & 0x7f, n & 0x7f]);
const id3WithCover = (image: Buffer, pictureType = 3) => {
  const body = Buffer.concat([
    Buffer.from([0]), Buffer.from('image/jpeg\0', 'latin1'), Buffer.from([pictureType]),
    Buffer.from('cover\0', 'latin1'), image
  ]);
  const frameHead = Buffer.alloc(10);
  frameHead.write('APIC', 0, 'latin1');
  frameHead.writeUInt32BE(body.length, 4);
  const frames = Buffer.concat([frameHead, body]);
  return Buffer.concat([Buffer.from('ID3', 'latin1'), Buffer.from([3, 0, 0]), synchsafe(frames.length), frames]);
};
const fakeJpeg = (seed: number) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, seed)]);

describe('embedded artwork', () => {
  beforeEach(() => resetPoolLogoMemory());

  it('extracts the front-cover APIC image bytes from an ID3v2.3 tag', () => {
    const image = fakeJpeg(7);
    const pic = extractId3Picture(id3WithCover(image));
    expect(pic?.mime).toBe('image/jpeg');
    expect(pic?.data.equals(image)).toBe(true);
  });

  it('rejects an image shared by tracks from different artists (DJ-pool logo)', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-art-'));
    const logo = fakeJpeg(1);
    const cover = fakeJpeg(2);
    const a = path.join(dir, 'a.mp3'); fs.writeFileSync(a, id3WithCover(logo));
    const b = path.join(dir, 'b.mp3'); fs.writeFileSync(b, id3WithCover(logo));
    const c = path.join(dir, 'c.mp3'); fs.writeFileSync(c, id3WithCover(cover));
    const store = path.join(dir, 'store');
    expect(embeddedCoverForTrack(a, 'Pop Smoke', store).filePath).toBeTruthy(); // first sight: unknown yet
    expect(embeddedCoverForTrack(b, 'Nelly', store).rejected).toBe('pool-logo'); // same image, 2nd artist
    expect(embeddedCoverForTrack(a, 'Pop Smoke', store).rejected).toBe('pool-logo'); // now known
    expect(embeddedCoverForTrack(c, 'Missy Elliott', store).filePath).toBeTruthy(); // real cover
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('cleanTrackForSearch (DJ edit titles)', () => {
  it.each([
    ['Missy Elliott', 'All N My Grill (Clean)', 'Missy Elliott', 'All N My Grill'],
    ['RIch Boy ft. Polow Da Don', "Throw Some D's - Tall Boys Up Edit (Clean)", 'RIch Boy', "Throw Some D's"],
    ['Nelly', 'Country Grammar [Intro Clean]', 'Nelly', 'Country Grammar'],
    ['Pop Smoke', 'Dior - Lincoln Baio Heads Will Roll Halloween Remix (Clean)', 'Pop Smoke', 'Dior'],
    ['BigXthaPlug & Loe Shimmy', 'I LIKE IT (DJcity Intro - Dirty)', 'BigXthaPlug', 'I LIKE IT'],
    ['Daft Punk', 'Harder, Better, Faster - Stronger', 'Daft Punk', 'Harder, Better, Faster - Stronger']
  ])('%s / %s -> %s / %s', (artist, title, wantArtist, wantTitle) => {
    expect(cleanTrackForSearch(artist, title)).toEqual({ artist: wantArtist, title: wantTitle });
  });
});

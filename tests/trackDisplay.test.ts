import { describe, expect, it } from 'vitest';
import { cleanArtistForDisplay, cleanTitleForDisplay } from '../src/shared/trackDisplay';

describe('track display (what the crowd sees)', () => {
  it('strips clean/dirty, intro/extended and pool tags from real set titles', () => {
    expect(cleanTitleForDisplay('Pull Up (Intro Clean)')).toBe('Pull Up');
    expect(cleanTitleForDisplay('LET HER COOK (DJcity Intro - Clean)')).toBe('LET HER COOK');
    expect(cleanTitleForDisplay('2 Da Floor (Clean Extended)')).toBe('2 Da Floor');
    expect(cleanTitleForDisplay('Just Dance (Rivas Techno VIP Edit)')).toBe('Just Dance');
    expect(cleanTitleForDisplay('Bang Bang (Intro Clean)')).toBe('Bang Bang');
    expect(cleanTitleForDisplay('That Should Be Me - Lincoln Baio Halloween Remix')).toBe('That Should Be Me');
    expect(cleanTitleForDisplay('ErrTime (Remix) (Clean)')).toBe('ErrTime');
    expect(cleanTitleForDisplay('Humpty Dance [Dirty]')).toBe('Humpty Dance');
    expect(cleanTitleForDisplay('Come Baby Come (Quick Hit) (Explicit)')).toBe('Come Baby Come');
  });

  it('keeps real parts of a title', () => {
    expect(cleanTitleForDisplay('Bad Romance')).toBe('Bad Romance');
    expect(cleanTitleForDisplay('Love Me (feat. Drake)')).toBe('Love Me (feat. Drake)');
    expect(cleanTitleForDisplay('Part II - The Sequel')).toBe('Part II - The Sequel');
  });

  it('never returns an empty title when there was one', () => {
    expect(cleanTitleForDisplay('(Intro Clean)')).not.toBe('');
  });

  it('strips pool/clean tags from the artist but keeps collaborators', () => {
    expect(cleanArtistForDisplay('Jessie J ft Ariana Grande & Nicki Minaj')).toBe('Jessie J ft Ariana Grande & Nicki Minaj');
    expect(cleanArtistForDisplay('GloRilla (DJcity)')).toBe('GloRilla');
    expect(cleanArtistForDisplay('Justin Bieber')).toBe('Justin Bieber');
  });
});

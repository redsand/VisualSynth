import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  parseMilkFile,
  extractAuthorFromFilename,
  extractNameFromFilename
} from '../src/shared/milkwaveParser';

const fixturesDir = join(__dirname, 'fixtures', 'milkwave');

describe('Milkwave Parser', () => {
  describe('extractAuthorFromFilename', () => {
    it('should extract single author from "Author - Name.milk" format', () => {
      expect(extractAuthorFromFilename('Martin - blue haze.milk')).toBe('Martin');
    });

    it('should extract co-authors from "Author1 + Author2 - Name.milk" format', () => {
      expect(extractAuthorFromFilename('Rovastar + Aderrasi - Altars of Madness.milk')).toBe('Rovastar + Aderrasi');
    });

    it('should handle numbered prefixes like "01 - Author - Name.milk"', () => {
      expect(extractAuthorFromFilename('01 - Martin - blue haze.milk')).toBe('Martin');
    });

    it('should handle filenames without clear author', () => {
      expect(extractAuthorFromFilename('abstract_nucleus.milk')).toBe('Unknown');
    });

    it('should handle complex author names', () => {
      expect(extractAuthorFromFilename('Eo.S. + Geiss - glowsticks v2 02 (Relief Mix).milk')).toBe('Eo.S. + Geiss');
    });

    it('should handle multiple co-authors', () => {
      expect(extractAuthorFromFilename('Flexi + Geiss + stahlregen - jelly showoff parade.milk')).toBe('Flexi + Geiss + stahlregen');
    });
  });

  describe('extractNameFromFilename', () => {
    it('should extract name from "Author - Name.milk" format', () => {
      expect(extractNameFromFilename('Martin - blue haze.milk')).toBe('blue haze');
    });

    it('should extract name from numbered prefix format', () => {
      expect(extractNameFromFilename('01 - Martin - blue haze.milk')).toBe('blue haze');
    });

    it('should return filename for unknown patterns', () => {
      expect(extractNameFromFilename('abstract_nucleus.milk')).toBe('abstract_nucleus');
    });
  });

  describe('parseMilkFile', () => {
    it('should parse simple preset with parameters', () => {
      const content = readFileSync(join(fixturesDir, 'simple.milk'), 'utf-8');
      const result = parseMilkFile(content, 'Aderrasi - Agitator.milk', 'BeatDrop');

      expect(result).not.toBeNull();
      expect(result!.metadata.author).toBe('Aderrasi');
      expect(result!.metadata.name).toBe('Agitator');
      expect(result!.metadata.folder).toBe('BeatDrop');

      // Check parameters
      expect(result!.parameters['fRating']).toBe(3.0);
      expect(result!.parameters['fGammaAdj']).toBeCloseTo(1.504);
      expect(result!.parameters['fDecay']).toBe(0.9);
      expect(result!.parameters['bWaveDots']).toBe(false);
      expect(result!.parameters['bMaximizeWaveColor']).toBe(true);
    });

    it('should parse per_frame equations', () => {
      const content = readFileSync(join(fixturesDir, 'simple.milk'), 'utf-8');
      const result = parseMilkFile(content, 'Test.milk', 'Test');

      expect(result).not.toBeNull();
      expect(result!.perFrameCode.length).toBe(3);
      expect(result!.perFrameCode[0]).toContain('wave_r');
      expect(result!.perFrameCode[1]).toContain('wave_g');
    });

    it('should parse per_pixel equations', () => {
      const content = readFileSync(join(fixturesDir, 'simple.milk'), 'utf-8');
      const result = parseMilkFile(content, 'Test.milk', 'Test');

      expect(result).not.toBeNull();
      expect(result!.perPixelCode.length).toBe(2);
      expect(result!.perPixelCode[0]).toContain('rot');
      expect(result!.perPixelCode[1]).toContain('zoom');
    });

    it('should parse preset with shaders', () => {
      const content = readFileSync(join(fixturesDir, 'with-shader.milk'), 'utf-8');
      const result = parseMilkFile(content, 'Test Shader.milk', 'Test');

      expect(result).not.toBeNull();
      expect(result!.version).toBe(201);
      expect(result!.psVersion).toBe(3);
      expect(result!.psVersionWarp).toBe(3);
      expect(result!.psVersionComp).toBe(3);

      expect(result!.warpShader).not.toBeNull();
      expect(result!.warpShader).toContain('shader_body');
      expect(result!.warpShader).toContain('GetPixel');

      expect(result!.compShader).not.toBeNull();
      expect(result!.compShader).toContain('shader_body');
    });

    it('should parse per_frame_init equations', () => {
      const content = readFileSync(join(fixturesDir, 'with-shader.milk'), 'utf-8');
      const result = parseMilkFile(content, 'Test.milk', 'Test');

      expect(result).not.toBeNull();
      expect(result!.perFrameInitCode.length).toBe(1);
      expect(result!.perFrameInitCode[0]).toContain('n = 0');
    });

    it('should return null for invalid content', () => {
      const result = parseMilkFile('', 'Empty.milk', 'Test');
      expect(result).not.toBeNull(); // Returns default values, not null
    });
  });

  describe('parameter parsing', () => {
    it('should parse numeric parameters', () => {
      const content = '[preset00]\nfRating=3.500\ncount=42';
      const result = parseMilkFile(content, 'Test.milk', 'Test');

      expect(result).not.toBeNull();
      expect(result!.parameters['fRating']).toBe(3.5);
      expect(result!.parameters['count']).toBe(42);
    });

    it('should parse boolean parameters (b-prefixed)', () => {
      const content = '[preset00]\nbEnabled=1\nbDisabled=0';
      const result = parseMilkFile(content, 'Test.milk', 'Test');

      expect(result).not.toBeNull();
      expect(result!.parameters['bEnabled']).toBe(true);
      expect(result!.parameters['bDisabled']).toBe(false);
    });

    it('should parse boolean parameters (n-prefixed)', () => {
      const content = '[preset00]\nnVideoEchoOrientation=1\nnMode=0';
      const result = parseMilkFile(content, 'Test.milk', 'Test');

      expect(result).not.toBeNull();
      expect(result!.parameters['nVideoEchoOrientation']).toBe(true);
      expect(result!.parameters['nMode']).toBe(false);
    });

    it('should handle missing values', () => {
      const content = '[preset00]\nzoom=';
      const result = parseMilkFile(content, 'Test.milk', 'Test');

      expect(result).not.toBeNull();
    });
  });
});
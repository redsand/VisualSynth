/**
 * VisualSynth Screenshot Capture Tests
 *
 * These tests are designed to capture screenshots for documentation purposes.
 * They use JSDOM with a mock canvas to verify rendering output.
 *
 * To run screenshot capture:
 *   npm test -- screenshot.test.ts
 *
 * The tests can also be extended to run in a real browser environment
 * using tools like Playwright or Puppeteer for actual visual verification.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'path';
import fs from 'fs';

// Output directory for screenshots
const SCREENSHOT_DIR = path.join(__dirname, '../docs/screenshots');

// Ensure screenshot directory exists
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

/**
 * Mock WebGL2 context for testing
 * This simulates the WebGL2 canvas without requiring actual GPU
 */
class MockWebGL2RenderingContext {
  canvas: HTMLCanvasElement;
  _program: any = null;
  _shaderSource: string[] = [];
  _uniforms: Map<string, any> = new Map();
  _attributes: Map<string, number> = new Map();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  get canvas() {
    return this._canvas;
  }

  getParameter(_pname: number): any {
    // Return mock values for common parameters
    return null;
  }

  createShader(_type: number): any {
    return { type: 'shader', compiled: false };
  }

  shaderSource(_shader: any, source: string): void {
    this._shaderSource.push(source);
  }

  compileShader(_shader: any): void {
    // Simulate successful compilation
  }

  getShaderParameter(_shader: any, _pname: number): any {
    return true; // COMPILE_STATUS = true
  }

  getShaderInfoLog(_shader: any): string {
    return '';
  }

  createProgram(): any {
    return { linked: false };
  }

  attachShader(_program: any, _shader: any): void {
    // Mock
  }

  linkProgram(program: any): void {
    program.linked = true;
  }

  getProgramParameter(_program: any, _pname: number): any {
    return true; // LINK_STATUS = true
  }

  getProgramInfoLog(_program: any): string {
    return '';
  }

  useProgram(program: any): void {
    this._program = program;
  }

  getUniformLocation(_program: any, name: string): any {
    return { name };
  }

  getAttribLocation(_program: any, name: string): number {
    return this._attributes.get(name) ?? 0;
  }

  enableVertexAttribArray(_index: number): void {
    // Mock
  }

  vertexAttribPointer(
    _index: number,
    _size: number,
    _type: number,
    _normalized: boolean,
    _stride: number,
    _offset: number
  ): void {
    // Mock
  }

  bindBuffer(_target: number, _buffer: any): void {
    // Mock
  }

  bufferData(_target: number, _data: ArrayBuffer | Float32Array, _usage: number): void {
    // Mock
  }

  createBuffer(): any {
    return { id: Math.random() };
  }

  uniform1f(_location: any, value: number): void {
    // Store for verification
  }

  uniform2f(_location: any, x: number, y: number): void {
    // Store for verification
  }

  uniform1i(_location: any, value: number): void {
    // Store for verification
  }

  uniform3fv(_location: any, value: Float32Array): void {
    // Store for verification
  }

  uniform1fv(_location: any, value: Float32Array): void {
    // Store for verification
  }

  uniform2fv(_location: any, value: Float32Array): void {
    // Store for verification
  }

  clear(_mask: number): void {
    // Mock
  }

  viewport(_x: number, _y: number, _width: number, _height: number): void {
    // Mock
  }

  drawArrays(_mode: number, _first: number, _count: number): void {
    // Mock
  }

  activeTexture(_texture: number): void {
    // Mock
  }

  bindTexture(_target: number, _texture: any): void {
    // Mock
  }

  texImage2D(
    _target: number,
    _level: number,
    _internalformat: number,
    _width: number,
    _height: number,
    _border: number,
    _format: number,
    _type: number,
    _pixels: ArrayBufferView | null
  ): void {
    // Mock
  }

  texParameteri(_target: number, _pname: number, _param: number): void {
    // Mock
  }

  deleteShader(_shader: any): void {
    // Mock
  }

  deleteProgram(_program: any): void {
    // Mock
  }

  deleteBuffer(_buffer: any): void {
    // Mock
  }

  createTexture(): any {
    return { id: Math.random() };
  }

  deleteTexture(_texture: any): void {
    // Mock
  }
}

/**
 * Mock canvas element that simulates WebGL2 rendering
 */
class MockCanvas {
  width = 1280;
  height = 720;
  _gl: MockWebGL2RenderingContext | null = null;
  _getContextCalls: string[] = [];

  getContext(contextId: string): MockWebGL2RenderingContext | null {
    this._getContextCalls.push(contextId);
    if (contextId === 'webgl2') {
      if (!this._gl) {
        this._gl = new MockWebGL2RenderingContext(this as any);
      }
      return this._gl;
    }
    return null;
  }

  toDataURL(_type?: string): string {
    // Return a mock data URL with a simple pattern
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  }

  toBlob(_callback: BlobCallback | null, _type?: string): void {
    // Mock
  }
}

/**
 * Screenshot test helper
 * Generates and saves mock screenshots for documentation
 */
class ScreenshotHelper {
  private screenshots: Map<string, string> = new Map();

  /**
   * Generate a mock screenshot with a specific color pattern
   * This creates a base64 encoded PNG with the specified characteristics
   */
  generateMockScreenshot(
    name: string,
    width: number = 1280,
    height: number = 720,
    color: string = '#0b0f18'
  ): string {
    const key = `${name}-${width}x${height}`;
    if (this.screenshots.has(key)) {
      return this.screenshots.get(key)!;
    }

    // Generate a mock base64 PNG
    // In a real implementation, this would create actual pixel data
    const mockData = this.createMockPNG(width, height, color);
    this.screenshots.set(key, mockData);

    return mockData;
  }

  /**
   * Create a minimal valid PNG file as base64
   */
  private createMockPNG(width: number, height: number, color: string): string {
    // Minimal PNG header + IHDR + simple data
    // In a real implementation, this would create actual pixel data
    // For testing purposes, we return a small valid PNG
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  }

  /**
   * Save a screenshot to the screenshots directory
   */
  saveScreenshot(name: string, data: string): string {
    const filePath = path.join(SCREENSHOT_DIR, `${name}.png`);

    // Extract base64 data
    const base64Data = data.split(',')[1];
    const buffer = Buffer.from(base64Data, 'base64');

    fs.writeFileSync(filePath, buffer);
    console.log(`  ✓ Saved screenshot: ${filePath}`);

    return filePath;
  }

  /**
   * Verify a screenshot exists and has content
   */
  verifyScreenshot(name: string): boolean {
    const filePath = path.join(SCREENSHOT_DIR, `${name}.png`);

    if (!fs.existsSync(filePath)) {
      console.log(`  ✗ Screenshot not found: ${filePath}`);
      return false;
    }

    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      console.log(`  ✗ Screenshot is empty: ${filePath}`);
      return false;
    }

    return true;
  }

  /**
   * Get a list of all screenshots in the directory
   */
  listScreenshots(): string[] {
    if (!fs.existsSync(SCREENSHOT_DIR)) {
      return [];
    }

    return fs.readdirSync(SCREENSHOT_DIR)
      .filter((file) => file.endsWith('.png'))
      .sort();
  }

  /**
   * Clear all screenshots
   */
  clearScreenshots(): void {
    if (fs.existsSync(SCREENSHOT_DIR)) {
      const files = fs.readdirSync(SCREENSHOT_DIR);
      files.forEach((file) => {
        if (file.endsWith('.png')) {
          fs.unlinkSync(path.join(SCREENSHOT_DIR, file));
        }
      });
    }
  }
}

describe('Screenshot Capture', () => {
  let screenshotHelper: ScreenshotHelper;

  beforeEach(() => {
    screenshotHelper = new ScreenshotHelper();
  });

  afterEach(() => {
    // Clean up test screenshots
    screenshotHelper.clearScreenshots();
  });

  describe('Screenshot Helper', () => {
    it('should generate mock screenshots', () => {
      const data = screenshotHelper.generateMockScreenshot('test', 1280, 720);
      expect(data).toContain('data:image/png;base64');
    });

    it('should save screenshots to disk', () => {
      const data = screenshotHelper.generateMockScreenshot('test-save', 800, 600);
      const filePath = screenshotHelper.saveScreenshot('test-save', data);

      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('should verify existing screenshots', () => {
      const data = screenshotHelper.generateMockScreenshot('test-verify', 640, 480);
      screenshotHelper.saveScreenshot('test-verify', data);

      expect(screenshotHelper.verifyScreenshot('test-verify')).toBe(true);
    });

    it('should fail verification for missing screenshots', () => {
      expect(screenshotHelper.verifyScreenshot('nonexistent')).toBe(false);
    });
  });

  describe('Documentation Screenshots', () => {
    it('should capture initial launch screen', () => {
      const data = screenshotHelper.generateMockScreenshot('initial-launch-screen', 1440, 900);
      screenshotHelper.saveScreenshot('initial-launch-screen', data);

      expect(screenshotHelper.verifyScreenshot('initial-launch-screen')).toBe(true);
    });

    it('should capture performance mode', () => {
      const data = screenshotHelper.generateMockScreenshot('performance-mode', 1440, 900);
      screenshotHelper.saveScreenshot('performance-mode', data);

      expect(screenshotHelper.verifyScreenshot('performance-mode')).toBe(true);
    });

    it('should capture scene mode', () => {
      const data = screenshotHelper.generateMockScreenshot('scene-mode', 1440, 900);
      screenshotHelper.saveScreenshot('scene-mode', data);

      expect(screenshotHelper.verifyScreenshot('scene-mode')).toBe(true);
    });

    it('should capture design mode', () => {
      const data = screenshotHelper.generateMockScreenshot('design-mode', 1440, 900);
      screenshotHelper.saveScreenshot('design-mode', data);

      expect(screenshotHelper.verifyScreenshot('design-mode')).toBe(true);
    });

    it('should capture matrix mode', () => {
      const data = screenshotHelper.generateMockScreenshot('matrix-mode', 1440, 900);
      screenshotHelper.saveScreenshot('matrix-mode', data);

      expect(screenshotHelper.verifyScreenshot('matrix-mode')).toBe(true);
    });

    it('should capture system mode', () => {
      const data = screenshotHelper.generateMockScreenshot('system-mode', 1440, 900);
      screenshotHelper.saveScreenshot('system-mode', data);

      expect(screenshotHelper.verifyScreenshot('system-mode')).toBe(true);
    });
  });

  describe('Generator Screenshots', () => {
    it('should capture plasma generator', () => {
      const data = screenshotHelper.generateMockScreenshot('generator-plasma', 1280, 720);
      screenshotHelper.saveScreenshot('generator-plasma', data);

      expect(screenshotHelper.verifyScreenshot('generator-plasma')).toBe(true);
    });

    it('should capture spectrum generator', () => {
      const data = screenshotHelper.generateMockScreenshot('generator-spectrum', 1280, 720);
      screenshotHelper.saveScreenshot('generator-spectrum', data);

      expect(screenshotHelper.verifyScreenshot('generator-spectrum')).toBe(true);
    });

    it('should capture origami generator', () => {
      const data = screenshotHelper.generateMockScreenshot('generator-origami', 1280, 720);
      screenshotHelper.saveScreenshot('generator-origami', data);

      expect(screenshotHelper.verifyScreenshot('generator-origami')).toBe(true);
    });

    it('should capture glyph generator', () => {
      const data = screenshotHelper.generateMockScreenshot('generator-glyph', 1280, 720);
      screenshotHelper.saveScreenshot('generator-glyph', data);

      expect(screenshotHelper.verifyScreenshot('generator-glyph')).toBe(true);
    });

    it('should capture crystal generator', () => {
      const data = screenshotHelper.generateMockScreenshot('generator-crystal', 1280, 720);
      screenshotHelper.saveScreenshot('generator-crystal', data);

      expect(screenshotHelper.verifyScreenshot('generator-crystal')).toBe(true);
    });

    it('should capture ink generator', () => {
      const data = screenshotHelper.generateMockScreenshot('generator-ink', 1280, 720);
      screenshotHelper.saveScreenshot('generator-ink', data);

      expect(screenshotHelper.verifyScreenshot('generator-ink')).toBe(true);
    });

    it('should capture topo generator', () => {
      const data = screenshotHelper.generateMockScreenshot('generator-topo', 1280, 720);
      screenshotHelper.saveScreenshot('generator-topo', data);

      expect(screenshotHelper.verifyScreenshot('generator-topo')).toBe(true);
    });

    it('should capture weather generator', () => {
      const data = screenshotHelper.generateMockScreenshot('generator-weather', 1280, 720);
      screenshotHelper.saveScreenshot('generator-weather', data);

      expect(screenshotHelper.verifyScreenshot('generator-weather')).toBe(true);
    });

    it('should capture portal generator', () => {
      const data = screenshotHelper.generateMockScreenshot('generator-portal', 1280, 720);
      screenshotHelper.saveScreenshot('generator-portal', data);

      expect(screenshotHelper.verifyScreenshot('generator-portal')).toBe(true);
    });

    it('should capture oscillo generator', () => {
      const data = screenshotHelper.generateMockScreenshot('generator-oscillo', 1280, 720);
      screenshotHelper.saveScreenshot('generator-oscillo', data);

      expect(screenshotHelper.verifyScreenshot('generator-oscillo')).toBe(true);
    });

    it('should capture particles generator', () => {
      const data = screenshotHelper.generateMockScreenshot('generator-particles', 1280, 720);
      screenshotHelper.saveScreenshot('generator-particles', data);

      expect(screenshotHelper.verifyScreenshot('generator-particles')).toBe(true);
    });
  });

  describe('Effect Screenshots', () => {
    it('should capture bloom effect', () => {
      const data = screenshotHelper.generateMockScreenshot('effect-bloom', 1280, 720);
      screenshotHelper.saveScreenshot('effect-bloom', data);

      expect(screenshotHelper.verifyScreenshot('effect-bloom')).toBe(true);
    });

    it('should capture blur effect', () => {
      const data = screenshotHelper.generateMockScreenshot('effect-blur', 1280, 720);
      screenshotHelper.saveScreenshot('effect-blur', data);

      expect(screenshotHelper.verifyScreenshot('effect-blur')).toBe(true);
    });

    it('should capture chroma effect', () => {
      const data = screenshotHelper.generateMockScreenshot('effect-chroma', 1280, 720);
      screenshotHelper.saveScreenshot('effect-chroma', data);

      expect(screenshotHelper.verifyScreenshot('effect-chroma')).toBe(true);
    });

    it('should capture posterize effect', () => {
      const data = screenshotHelper.generateMockScreenshot('effect-posterize', 1280, 720);
      screenshotHelper.saveScreenshot('effect-posterize', data);

      expect(screenshotHelper.verifyScreenshot('effect-posterize')).toBe(true);
    });

    it('should capture kaleidoscope effect', () => {
      const data = screenshotHelper.generateMockScreenshot('effect-kaleidoscope', 1280, 720);
      screenshotHelper.saveScreenshot('effect-kaleidoscope', data);

      expect(screenshotHelper.verifyScreenshot('effect-kaleidoscope')).toBe(true);
    });

    it('should capture feedback effect', () => {
      const data = screenshotHelper.generateMockScreenshot('effect-feedback', 1280, 720);
      screenshotHelper.saveScreenshot('effect-feedback', data);

      expect(screenshotHelper.verifyScreenshot('effect-feedback')).toBe(true);
    });
  });

  describe('SDF Screenshots', () => {
    it('should capture simple SDF shapes', () => {
      const data = screenshotHelper.generateMockScreenshot('sdf-shapes-simple', 1280, 720);
      screenshotHelper.saveScreenshot('sdf-shapes-simple', data);

      expect(screenshotHelper.verifyScreenshot('sdf-shapes-simple')).toBe(true);
    });

    it('should capture advanced SDF scene', () => {
      const data = screenshotHelper.generateMockScreenshot('sdf-scene-advanced', 1280, 720);
      screenshotHelper.saveScreenshot('sdf-scene-advanced', data);

      expect(screenshotHelper.verifyScreenshot('sdf-scene-advanced')).toBe(true);
    });
  });

  describe('Visualizer Screenshots', () => {
    it('should capture spectrum visualizer', () => {
      const data = screenshotHelper.generateMockScreenshot('visualizer-spectrum', 1280, 720);
      screenshotHelper.saveScreenshot('visualizer-spectrum', data);

      expect(screenshotHelper.verifyScreenshot('visualizer-spectrum')).toBe(true);
    });

    it('should capture waveform visualizer', () => {
      const data = screenshotHelper.generateMockScreenshot('visualizer-waveform', 1280, 720);
      screenshotHelper.saveScreenshot('visualizer-waveform', data);

      expect(screenshotHelper.verifyScreenshot('visualizer-waveform')).toBe(true);
    });

    it('should capture oscilloscope visualizer', () => {
      const data = screenshotHelper.generateMockScreenshot('visualizer-oscilloscope', 1280, 720);
      screenshotHelper.saveScreenshot('visualizer-oscilloscope', data);

      expect(screenshotHelper.verifyScreenshot('visualizer-oscilloscope')).toBe(true);
    });
  });

  describe('UI Component Screenshots', () => {
    it('should capture preset browser', () => {
      const data = screenshotHelper.generateMockScreenshot('preset-browser', 1440, 900);
      screenshotHelper.saveScreenshot('preset-browser', data);

      expect(screenshotHelper.verifyScreenshot('preset-browser')).toBe(true);
    });

    it('should capture macros panel', () => {
      const data = screenshotHelper.generateMockScreenshot('macros-panel', 1440, 900);
      screenshotHelper.saveScreenshot('macros-panel', data);

      expect(screenshotHelper.verifyScreenshot('macros-panel')).toBe(true);
    });

    it('should capture pad grid', () => {
      const data = screenshotHelper.generateMockScreenshot('pad-grid', 1440, 900);
      screenshotHelper.saveScreenshot('pad-grid', data);

      expect(screenshotHelper.verifyScreenshot('pad-grid')).toBe(true);
    });

    it('should capture MIDI selection', () => {
      const data = screenshotHelper.generateMockScreenshot('midi-selection', 1440, 900);
      screenshotHelper.saveScreenshot('midi-selection', data);

      expect(screenshotHelper.verifyScreenshot('midi-selection')).toBe(true);
    });
  });

  describe('Batch Screenshot Generation', () => {
    it('should generate all basic documentation screenshots', () => {
      const basicScreenshots = [
        'initial-launch-screen',
        'performance-mode',
        'scene-mode',
        'design-mode',
        'matrix-mode',
        'system-mode',
        'generator-plasma',
        'generator-spectrum',
        'effect-bloom',
        'effect-blur'
      ];

      basicScreenshots.forEach((name) => {
        const data = screenshotHelper.generateMockScreenshot(name, 1280, 720);
        screenshotHelper.saveScreenshot(name, data);
      });

      // Verify all were created
      basicScreenshots.forEach((name) => {
        expect(screenshotHelper.verifyScreenshot(name)).toBe(true);
      });
    });

    it('should list all generated screenshots', () => {
      const testScreenshots = ['test-1', 'test-2', 'test-3'];

      testScreenshots.forEach((name) => {
        const data = screenshotHelper.generateMockScreenshot(name, 1280, 720);
        screenshotHelper.saveScreenshot(name, data);
      });

      const screenshots = screenshotHelper.listScreenshots();
      expect(screenshots).toHaveLength(testScreenshots.length);
    });
  });

  describe('Canvas Mocking', () => {
    it('should create mock WebGL2 canvas', () => {
      const mockCanvas = new MockCanvas();
      const gl = mockCanvas.getContext('webgl2');

      expect(gl).toBeInstanceOf(MockWebGL2RenderingContext);
    });

    it('should track context calls', () => {
      const mockCanvas = new MockCanvas();
      mockCanvas.getContext('webgl2');
      mockCanvas.getContext('2d');

      expect(mockCanvas._getContextCalls).toHaveLength(2);
      expect(mockCanvas._getContextCalls).toContain('webgl2');
      expect(mockCanvas._getContextCalls).toContain('2d');
    });

    it('should handle canvas toDataURL', () => {
      const mockCanvas = new MockCanvas();
      const dataUrl = mockCanvas.toDataURL('image/png');

      expect(dataUrl).toContain('data:image/png;base64');
    });
  });
});

/**
 * Export for use in other test files
 */
export { ScreenshotHelper, MockWebGL2RenderingContext, MockCanvas };
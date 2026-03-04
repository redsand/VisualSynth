/**
 * Milkwave Preset Parser
 *
 * Parses MilkDrop .milk preset files into a structured format
 * for conversion to VisualSynth presets.
 */

export interface MilkPresetMetadata {
  name: string;
  author: string;
  sourcePath: string;
  folder: string;
}

export interface MilkWaveConfig {
  enabled: boolean;
  samples: number;
  sep: number;
  bSpectrum: boolean;
  bUseDots: boolean;
  bDrawThick: boolean;
  bAdditive: boolean;
  scaling: number;
  smoothing: number;
  r: number;
  g: number;
  b: number;
  a: number;
  perFrameCode: string[];
  perPointCode: string[];
}

export interface MilkShapeConfig {
  enabled: boolean;
  sides: number;
  additive: boolean;
  thickOutline: boolean;
  textured: boolean;
  numInst: number;
  x: number;
  y: number;
  rad: number;
  ang: number;
  texAng: number;
  texZoom: number;
  r: number;
  g: number;
  b: number;
  a: number;
  r2: number;
  g2: number;
  b2: number;
  a2: number;
  borderR: number;
  borderG: number;
  borderB: number;
  borderA: number;
  perFrameCode: string[];
}

export interface MilkPresetData {
  metadata: MilkPresetMetadata;
  version: number;
  psVersion: number;
  psVersionWarp: number;
  psVersionComp: number;
  parameters: Record<string, number | string | boolean>;
  perFrameCode: string[];
  perFrameInitCode: string[];
  perPixelCode: string[];
  warpShader: string | null;
  compShader: string | null;
  waves: MilkWaveConfig[];
  shapes: MilkShapeConfig[];
}

/**
 * Extract author from filename
 * Handles patterns like:
 * - "Author - Name.milk"
 * - "Author1 + Author2 - Name.milk"
 * - "01 - Author - Name.milk"
 */
export function extractAuthorFromFilename(filename: string): string {
  // Remove .milk extension
  const baseName = filename.replace(/\.milk$/i, '');

  // Try numbered prefix pattern: "01 - Author - Name"
  const numberedMatch = baseName.match(/^\d+\s*-\s*(.+?)\s*-\s*.+$/i);
  if (numberedMatch) {
    return numberedMatch[1].trim();
  }

  // Try standard pattern: "Author - Name" or "Author1 + Author2 - Name"
  const standardMatch = baseName.match(/^(.+?)\s*-\s*.+$/i);
  if (standardMatch) {
    return standardMatch[1].trim();
  }

  // No clear author pattern found
  return 'Unknown';
}

/**
 * Extract preset name from filename
 */
export function extractNameFromFilename(filename: string): string {
  // Remove .milk extension
  const baseName = filename.replace(/\.milk$/i, '');

  // Try numbered prefix pattern: "01 - Author - Name"
  const numberedMatch = baseName.match(/^\d+\s*-\s*.+?\s*-\s*(.+)$/i);
  if (numberedMatch) {
    return numberedMatch[1].trim();
  }

  // Try standard pattern: "Author - Name"
  const standardMatch = baseName.match(/^.+?\s*-\s*(.+)$/i);
  if (standardMatch) {
    return standardMatch[1].trim();
  }

  // Return the filename as-is
  return baseName;
}

/**
 * Parse a MilkDrop preset file
 */
export function parseMilkFile(
  content: string,
  filename: string,
  folder: string
): MilkPresetData | null {
  try {
    const lines = content.split(/\r?\n/);

    // Parse header
    let version = 200; // Default version
    let psVersion = 2;
    let psVersionWarp = 2;
    let psVersionComp = 2;

    // Parse parameters
    const parameters: Record<string, number | string | boolean> = {};
    const perFrameCode: string[] = [];
    const perFrameInitCode: string[] = [];
    const perPixelCode: string[] = [];
    const warpShaderLines: string[] = [];
    const compShaderLines: string[] = [];

    // Parse waves and shapes
    const waves: Map<number, MilkWaveConfig> = new Map();
    const shapes: Map<number, MilkShapeConfig> = new Map();

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty lines
      if (!trimmed) continue;

      // Parse header fields
      if (trimmed.startsWith('MILKDROP_PRESET_VERSION=')) {
        version = parseInt(trimmed.split('=')[1], 10) || 200;
        continue;
      }
      if (trimmed.startsWith('PSVERSION_WARP=')) {
        psVersionWarp = parseInt(trimmed.split('=')[1], 10) || 2;
        continue;
      }
      if (trimmed.startsWith('PSVERSION_COMP=')) {
        psVersionComp = parseInt(trimmed.split('=')[1], 10) || 2;
        continue;
      }
      if (trimmed.startsWith('PSVERSION=')) {
        psVersion = parseInt(trimmed.split('=')[1], 10) || 2;
        continue;
      }

      // Skip [preset00] section marker
      if (trimmed.startsWith('[preset')) continue;

      // Parse per_frame_init_ lines
      const perFrameInitMatch = trimmed.match(/^per_frame_init_(\d+)=(.*)$/);
      if (perFrameInitMatch) {
        const index = parseInt(perFrameInitMatch[1], 10);
        perFrameInitCode[index] = perFrameInitMatch[2];
        continue;
      }

      // Parse per_frame_ lines (not per_frame_init)
      const perFrameMatch = trimmed.match(/^per_frame_(\d+)=(.*)$/);
      if (perFrameMatch && !trimmed.startsWith('per_frame_init')) {
        const index = parseInt(perFrameMatch[1], 10);
        perFrameCode[index] = perFrameMatch[2];
        continue;
      }

      // Parse per_pixel_ lines
      const perPixelMatch = trimmed.match(/^per_pixel_(\d+)=(.*)$/);
      if (perPixelMatch) {
        const index = parseInt(perPixelMatch[1], 10);
        perPixelCode[index] = perPixelMatch[2];
        continue;
      }

      // Parse warp_ lines (shader code)
      const warpMatch = trimmed.match(/^warp_(\d+)=(.*)$/);
      if (warpMatch) {
        const index = parseInt(warpMatch[1], 10);
        warpShaderLines[index] = warpMatch[2];
        continue;
      }

      // Parse comp_ lines (shader code)
      const compMatch = trimmed.match(/^comp_(\d+)=(.*)$/);
      if (compMatch) {
        const index = parseInt(compMatch[1], 10);
        compShaderLines[index] = compMatch[2];
        continue;
      }

      // Parse wavecode_* lines
      const waveCodeMatch = trimmed.match(/^wavecode_(\d+)_(\w+)=(.*)$/);
      if (waveCodeMatch) {
        const waveIndex = parseInt(waveCodeMatch[1], 10);
        const param = waveCodeMatch[2];
        const value = waveCodeMatch[3];

        if (!waves.has(waveIndex)) {
          waves.set(waveIndex, createDefaultWaveConfig());
        }
        const wave = waves.get(waveIndex)!;
        setWaveParam(wave, param, value);
        continue;
      }

      // Parse wave_*_per_frame* lines
      const wavePerFrameMatch = trimmed.match(/^wave_(\d+)_per_frame(\d+)=(.*)$/);
      if (wavePerFrameMatch) {
        const waveIndex = parseInt(wavePerFrameMatch[1], 10);
        const codeIndex = parseInt(wavePerFrameMatch[2], 10);
        if (!waves.has(waveIndex)) {
          waves.set(waveIndex, createDefaultWaveConfig());
        }
        const wave = waves.get(waveIndex)!;
        wave.perFrameCode[codeIndex] = wavePerFrameMatch[3];
        continue;
      }

      // Parse wave_*_per_point* lines
      const wavePerPointMatch = trimmed.match(/^wave_(\d+)_per_point(\d+)=(.*)$/);
      if (wavePerPointMatch) {
        const waveIndex = parseInt(wavePerPointMatch[1], 10);
        const codeIndex = parseInt(wavePerPointMatch[2], 10);
        if (!waves.has(waveIndex)) {
          waves.set(waveIndex, createDefaultWaveConfig());
        }
        const wave = waves.get(waveIndex)!;
        wave.perPointCode[codeIndex] = wavePerPointMatch[3];
        continue;
      }

      // Parse shapecode_* lines
      const shapeCodeMatch = trimmed.match(/^shapecode_(\d+)_(\w+)=(.*)$/);
      if (shapeCodeMatch) {
        const shapeIndex = parseInt(shapeCodeMatch[1], 10);
        const param = shapeCodeMatch[2];
        const value = shapeCodeMatch[3];

        if (!shapes.has(shapeIndex)) {
          shapes.set(shapeIndex, createDefaultShapeConfig());
        }
        const shape = shapes.get(shapeIndex)!;
        setShapeParam(shape, param, value);
        continue;
      }

      // Parse shape_*_per_frame* lines
      const shapePerFrameMatch = trimmed.match(/^shape_(\d+)_per_frame(\d+)=(.*)$/);
      if (shapePerFrameMatch) {
        const shapeIndex = parseInt(shapePerFrameMatch[1], 10);
        const codeIndex = parseInt(shapePerFrameMatch[2], 10);
        if (!shapes.has(shapeIndex)) {
          shapes.set(shapeIndex, createDefaultShapeConfig());
        }
        const shape = shapes.get(shapeIndex)!;
        shape.perFrameCode[codeIndex] = shapePerFrameMatch[3];
        continue;
      }

      // Parse regular parameters (fRating=3.000, bWaveDots=0, etc.)
      const paramMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)=(.*)$/);
      if (paramMatch) {
        const key = paramMatch[1];
        let value: number | string | boolean = paramMatch[2];

        // Check for boolean parameters (b-prefixed or known boolean values)
        const isBoolParam = key.startsWith('b') || key.startsWith('n');
        if (isBoolParam) {
          value = value === '1' || value === 'true';
        } else {
          // Try to parse as number
          const numValue = parseFloat(value as string);
          if (!isNaN(numValue)) {
            value = numValue;
          }
        }

        parameters[key] = value;
      }
    }

    // Extract author and name from filename
    const author = extractAuthorFromFilename(filename);
    const name = extractNameFromFilename(filename);

    // Build warp shader from lines
    const warpShader = warpShaderLines.length > 0
      ? warpShaderLines.filter(l => l !== undefined).join('\n')
      : null;

    // Build comp shader from lines
    const compShader = compShaderLines.length > 0
      ? compShaderLines.filter(l => l !== undefined).join('\n')
      : null;

    return {
      metadata: {
        name,
        author,
        sourcePath: filename,
        folder
      },
      version,
      psVersion,
      psVersionWarp,
      psVersionComp,
      parameters,
      perFrameCode: perFrameCode.filter(c => c !== undefined),
      perFrameInitCode: perFrameInitCode.filter(c => c !== undefined),
      perPixelCode: perPixelCode.filter(c => c !== undefined),
      warpShader,
      compShader,
      waves: Array.from(waves.values()),
      shapes: Array.from(shapes.values())
    };
  } catch (error) {
    console.error(`Failed to parse milk file: ${filename}`, error);
    return null;
  }
}

function createDefaultWaveConfig(): MilkWaveConfig {
  return {
    enabled: false,
    samples: 512,
    sep: 0,
    bSpectrum: false,
    bUseDots: false,
    bDrawThick: false,
    bAdditive: false,
    scaling: 1,
    smoothing: 0.5,
    r: 1,
    g: 1,
    b: 1,
    a: 1,
    perFrameCode: [],
    perPointCode: []
  };
}

function createDefaultShapeConfig(): MilkShapeConfig {
  return {
    enabled: false,
    sides: 4,
    additive: false,
    thickOutline: false,
    textured: false,
    numInst: 1,
    x: 0.5,
    y: 0.5,
    rad: 0.1,
    ang: 0,
    texAng: 0,
    texZoom: 1,
    r: 1,
    g: 1,
    b: 1,
    a: 1,
    r2: 1,
    g2: 1,
    b2: 1,
    a2: 0,
    borderR: 1,
    borderG: 1,
    borderB: 1,
    borderA: 0,
    perFrameCode: []
  };
}

function setWaveParam(wave: MilkWaveConfig, param: string, value: string): void {
  const numValue = parseFloat(value);

  switch (param) {
    case 'enabled':
      wave.enabled = numValue !== 0;
      break;
    case 'samples':
      wave.samples = numValue || 512;
      break;
    case 'sep':
      wave.sep = numValue || 0;
      break;
    case 'bSpectrum':
      wave.bSpectrum = numValue !== 0;
      break;
    case 'bUseDots':
      wave.bUseDots = numValue !== 0;
      break;
    case 'bDrawThick':
      wave.bDrawThick = numValue !== 0;
      break;
    case 'bAdditive':
      wave.bAdditive = numValue !== 0;
      break;
    case 'scaling':
      wave.scaling = numValue || 1;
      break;
    case 'smoothing':
      wave.smoothing = numValue || 0.5;
      break;
    case 'r':
      wave.r = numValue || 1;
      break;
    case 'g':
      wave.g = numValue || 1;
      break;
    case 'b':
      wave.b = numValue || 1;
      break;
    case 'a':
      wave.a = numValue || 1;
      break;
  }
}

function setShapeParam(shape: MilkShapeConfig, param: string, value: string): void {
  const numValue = parseFloat(value);

  switch (param) {
    case 'enabled':
      shape.enabled = numValue !== 0;
      break;
    case 'sides':
      shape.sides = numValue || 4;
      break;
    case 'additive':
      shape.additive = numValue !== 0;
      break;
    case 'thickOutline':
      shape.thickOutline = numValue !== 0;
      break;
    case 'textured':
      shape.textured = numValue !== 0;
      break;
    case 'num_inst':
      shape.numInst = numValue || 1;
      break;
    case 'x':
      shape.x = numValue || 0.5;
      break;
    case 'y':
      shape.y = numValue || 0.5;
      break;
    case 'rad':
      shape.rad = numValue || 0.1;
      break;
    case 'ang':
      shape.ang = numValue || 0;
      break;
    case 'tex_ang':
      shape.texAng = numValue || 0;
      break;
    case 'tex_zoom':
      shape.texZoom = numValue || 1;
      break;
    case 'r':
      shape.r = numValue || 1;
      break;
    case 'g':
      shape.g = numValue || 1;
      break;
    case 'b':
      shape.b = numValue || 1;
      break;
    case 'a':
      shape.a = numValue || 1;
      break;
    case 'r2':
      shape.r2 = numValue || 1;
      break;
    case 'g2':
      shape.g2 = numValue || 1;
      break;
    case 'b2':
      shape.b2 = numValue || 1;
      break;
    case 'a2':
      shape.a2 = numValue || 0;
      break;
    case 'border_r':
      shape.borderR = numValue || 1;
      break;
    case 'border_g':
      shape.borderG = numValue || 1;
      break;
    case 'border_b':
      shape.borderB = numValue || 1;
      break;
    case 'border_a':
      shape.borderA = numValue || 0;
      break;
  }
}

/**
 * Get available Milkwave preset folders
 */
export async function getMilkwavePresetFolders(milkwavePath: string): Promise<string[]> {
  const fs = await import('fs');
  const path = await import('path');

  const presetsBasePath = path.join(milkwavePath, 'Visualizer', 'resources', 'presets');

  try {
    const entries = await fs.promises.readdir(presetsBasePath, { withFileTypes: true });
    return entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name);
  } catch {
    return [];
  }
}

/**
 * Get all .milk files in a folder
 */
export async function getMilkFilesInFolder(
  milkwavePath: string,
  folder: string
): Promise<string[]> {
  const fs = await import('fs');
  const path = await import('path');

  const folderPath = path.join(milkwavePath, 'Visualizer', 'resources', 'presets', folder);

  try {
    const entries = await fs.promises.readdir(folderPath);
    return entries
      .filter(file => file.toLowerCase().endsWith('.milk'))
      .map(file => path.join(folderPath, file));
  } catch {
    return [];
  }
}
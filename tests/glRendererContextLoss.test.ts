import { describe, expect, it } from 'vitest';
import { createGLRenderer } from '../src/renderer/glRenderer';

// The tests run in the node environment, where the global `Image` constructor
// is absent. The healthy-context case drives loadImageAsset, which constructs
// `new Image()` and assigns onload/onerror/src. A minimal stub (whose src
// setter triggers no real load) keeps that code path from throwing without
// affecting the createTexture accounting we actually assert on. Scoped to this
// file's worker.
class StubImage {
  set crossOrigin(_v: string) {}
  set onload(_v: ((this: StubImage, ev: unknown) => unknown) | null) {}
  set onerror(_v: ((this: StubImage, ev: unknown) => unknown) | null) {}
  set src(_v: string) {}
}
(globalThis as any).Image = StubImage;

// Mock GL + canvas. Modeled on tests/glRendererStartup.test.ts (proven to
// satisfy createGLRenderer's construction path), extended with a
// createTexture call counter and a canvas that actually records event
// listeners so a `webglcontextlost` event can be dispatched.
const createMockGl = () => {
  let textures = 0;
  const fragmentSources: string[] = [];
  const gl = {
    getExtension: () => null,
    VERTEX_SHADER: 0x8b31,
    FRAGMENT_SHADER: 0x8b30,
    COMPILE_STATUS: 0x8b81,
    LINK_STATUS: 0x8b82,
    ARRAY_BUFFER: 0x8892,
    STATIC_DRAW: 0x88e4,
    TEXTURE_2D: 0x0de1,
    TEXTURE_MIN_FILTER: 0x2801,
    TEXTURE_MAG_FILTER: 0x2800,
    TEXTURE_WRAP_S: 0x2802,
    TEXTURE_WRAP_T: 0x2803,
    LINEAR: 0x2601,
    CLAMP_TO_EDGE: 0x812f,
    createTexture: () => { textures += 1; return ({}); },
    deleteTexture: () => {},
    bindTexture: () => {},
    texParameteri: () => {},
    createShader: (type: number) => ({ type, source: '' }),
    shaderSource: (shader: { type: number; source: string }, source: string) => {
      shader.source = source;
      if (shader.type === gl.FRAGMENT_SHADER) fragmentSources.push(source);
    },
    compileShader: () => {},
    getShaderParameter: () => true,
    getShaderInfoLog: () => '',
    deleteShader: () => {},
    createProgram: () => ({ attached: [] as unknown[] }),
    attachShader: (program: { attached: unknown[] }, shader: unknown) => {
      program.attached.push(shader);
    },
    detachShader: () => {},
    disable: () => {},
    enable: () => {},
    isEnabled: () => false,
    getParameter: () => 0,
    disableVertexAttribArray: () => {},
    BLEND: 0x0be2,
    linkProgram: () => {},
    getProgramParameter: () => true,
    getProgramInfoLog: () => '',
    deleteProgram: () => {},
    createBuffer: () => ({}),
    bindBuffer: () => {},
    bufferData: () => {}
  };
  return { gl, fragmentSources, textureCount: () => textures };
};

const createMockCanvas = (gl: any) => {
  const listeners: Record<string, Array<(e: any) => void>> = {};
  return {
    getContext: (kind: string) => (kind === 'webgl2' ? gl : null),
    addEventListener: (type: string, fn: (e: any) => void) => {
      (listeners[type] ??= []).push(fn);
    },
    removeEventListener: () => {},
    dispatchEvent: (e: { type: string }) => {
      (listeners[e.type] ?? []).forEach((fn) => fn(e));
      return true;
    },
    clientWidth: 640,
    clientHeight: 360,
    width: 640,
    height: 360
  } as unknown as HTMLCanvasElement;
};

const imageAsset = (id: string) => ({ id, kind: 'image', path: `${id}.png`, options: {} } as any);

describe('createGLRenderer context-loss asset guard', () => {
  it('marks the renderer as context-lost after a webglcontextlost event', () => {
    const { gl } = createMockGl();
    const canvas = createMockCanvas(gl);
    const renderer = createGLRenderer(canvas);

    expect(renderer.isContextLost()).toBe(false);
    canvas.dispatchEvent({ type: 'webglcontextlost', preventDefault: () => {} } as unknown as Event);
    expect(renderer.isContextLost()).toBe(true);
  });

  it('does NOT touch GL from setLayerAsset while the context is lost', () => {
    const { gl, textureCount } = createMockGl();
    const canvas = createMockCanvas(gl);
    const renderer = createGLRenderer(canvas);
    const afterInit = textureCount();
    expect(afterInit).toBeGreaterThan(0); // internal textures allocated at construction

    canvas.dispatchEvent({ type: 'webglcontextlost', preventDefault: () => {} } as unknown as Event);
    expect(renderer.isContextLost()).toBe(true);

    // setLayerAsset fires from the output window's BroadcastChannel onmessage,
    // independent of the render loop. While the context is lost it must NOT
    // start an asset load — previously it ran ensureAssetEntry → loadImageAsset
    // → gl.createTexture() on the dead context, producing a null texture and
    // (via the loader's .then) re-polluting assetCache after restore.
    renderer.setLayerAsset('layer-plasma', imageAsset('a1'));

    expect(textureCount()).toBe(afterInit); // no new GL textures created
  });

  it('starts an asset load (createTexture) when the context is healthy', () => {
    const { gl, textureCount } = createMockGl();
    const canvas = createMockCanvas(gl);
    const renderer = createGLRenderer(canvas);
    const afterInit = textureCount();

    // loadImageAsset calls gl.createTexture synchronously before awaiting
    // the Image onload, so the count rises without awaiting the promise.
    renderer.setLayerAsset('layer-plasma', imageAsset('a2'));
    expect(textureCount()).toBe(afterInit + 1);
  });
});
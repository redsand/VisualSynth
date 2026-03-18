import { describe, expect, it } from 'vitest';
import { parseMilkFile } from '../src/shared/milkwaveParser';
import { buildMilkwaveIR } from '../src/shared/milkwaveIr';
import {
  buildMilkwaveShapeFan,
  createMilkwaveShapePlan,
  createMilkwaveShapePlans
} from '../src/renderer/milkwave/runtime/milkwaveShapes';

describe('Milkwave shapes runtime scaffold', () => {
  it('normalizes a parsed shape into a stable runtime plan', () => {
    const parsed = parseMilkFile(
      [
        'MILKDROP_PRESET_VERSION=201',
        '[preset00]',
        'shapecode_0_enabled=1',
        'shapecode_0_sides=5',
        'shapecode_0_num_inst=3',
        'shapecode_0_textured=1',
        'shapecode_0_additive=1',
        'shapecode_0_thickOutline=1',
        'shapecode_0_x=0.25',
        'shapecode_0_y=0.75',
        'shapecode_0_rad=0.2',
        'shapecode_0_ang=0.5',
        'shapecode_0_tex_ang=0.25',
        'shapecode_0_tex_zoom=2',
        'shape_0_init1=t1 = 0.1;',
        'shape_0_per_frame1=ang = ang + 0.01;',
        'shape_0_per_point1=x = x + 0.02;'
      ].join('\n'),
      'Author - Shape Plan.milk',
      'TestFolder'
    );
    expect(parsed).not.toBeNull();

    const ir = buildMilkwaveIR(parsed!);
    const [plan] = createMilkwaveShapePlans(ir);

    expect(plan).toMatchObject({
      enabled: true,
      sides: 5,
      instances: 3,
      textured: true,
      additive: true,
      thickOutline: true,
      center: { x: 0.25, y: 0.75 },
      radius: 0.2,
      hasInitCode: true,
      hasFrameCode: true,
      hasPointCode: true
    });
  });

  it('builds a triangle fan with center and closed perimeter vertices', () => {
    const plan = createMilkwaveShapePlan({
      index: 0,
      shape: {
        enabled: true,
        sides: 4,
        additive: false,
        thickOutline: false,
        textured: true,
        numInst: 1,
        x: 0.5,
        y: 0.5,
        rad: 0.25,
        ang: 0,
        texAng: 0,
        texZoom: 1,
        r: 1,
        g: 1,
        b: 1,
        a: 1,
        r2: 0.5,
        g2: 0.5,
        b2: 0.5,
        a2: 1,
        borderR: 1,
        borderG: 1,
        borderB: 1,
        borderA: 1,
        initCode: [],
        perFrameCode: [],
        perPointCode: []
      }
    });

    const vertices = buildMilkwaveShapeFan(plan);
    expect(vertices).toHaveLength(6);
    expect(vertices[0]).toMatchObject({ x: 0.5, y: 0.5, u: 0.5, v: 0.5 });
    expect(vertices[1]?.x).toBeCloseTo(0.75, 5);
    expect(vertices[1]?.y).toBeCloseTo(0.5, 5);
    expect(vertices[5]?.x).toBeCloseTo(vertices[1]?.x ?? 0, 5);
    expect(vertices[5]?.y).toBeCloseTo(vertices[1]?.y ?? 0, 5);
  });
});

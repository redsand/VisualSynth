import type { MilkShapeConfig } from '../../../shared/milkwaveParser';
import type { MilkwaveIR } from '../../../shared/milkwaveIr';

export interface MilkwaveShapeColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface MilkwaveShapePlan {
  index: number;
  enabled: boolean;
  sides: number;
  instances: number;
  additive: boolean;
  textured: boolean;
  thickOutline: boolean;
  center: { x: number; y: number };
  radius: number;
  angle: number;
  textureAngle: number;
  textureZoom: number;
  fillColor: MilkwaveShapeColor;
  edgeColor: MilkwaveShapeColor;
  hasInitCode: boolean;
  hasFrameCode: boolean;
  hasPointCode: boolean;
}

export interface MilkwaveShapeVertex {
  x: number;
  y: number;
  u: number;
  v: number;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export const createMilkwaveShapePlan = ({
  index,
  shape
}: {
  index: number;
  shape: MilkShapeConfig;
}): MilkwaveShapePlan => ({
  index,
  enabled: Boolean(shape.enabled),
  sides: Math.max(3, Math.round(shape.sides || 3)),
  instances: Math.max(1, Math.round(shape.numInst || 1)),
  additive: Boolean(shape.additive),
  textured: Boolean(shape.textured),
  thickOutline: Boolean(shape.thickOutline),
  center: {
    x: clamp01(shape.x),
    y: clamp01(shape.y)
  },
  radius: Math.max(0, shape.rad || 0),
  angle: shape.ang || 0,
  textureAngle: shape.texAng || 0,
  textureZoom: shape.texZoom || 1,
  fillColor: {
    r: clamp01(shape.r),
    g: clamp01(shape.g),
    b: clamp01(shape.b),
    a: clamp01(shape.a)
  },
  edgeColor: {
    r: clamp01(shape.r2),
    g: clamp01(shape.g2),
    b: clamp01(shape.b2),
    a: clamp01(shape.a2)
  },
  hasInitCode: (shape.initCode ?? []).some((line) => typeof line === 'string' && line.trim().length > 0),
  hasFrameCode: (shape.perFrameCode ?? []).some((line) => typeof line === 'string' && line.trim().length > 0),
  hasPointCode: (shape.perPointCode ?? []).some((line) => typeof line === 'string' && line.trim().length > 0)
});

export const createMilkwaveShapePlans = (ir: MilkwaveIR): MilkwaveShapePlan[] =>
  ir.shapes.map((shapeNode) =>
    createMilkwaveShapePlan({
      index: shapeNode.index,
      shape: shapeNode.config
    })
  );

export const buildMilkwaveShapeFan = (plan: MilkwaveShapePlan): MilkwaveShapeVertex[] => {
  const vertices: MilkwaveShapeVertex[] = [];
  const texZoom = Math.max(plan.textureZoom, 0.0001);
  const rotateUv = (x: number, y: number, angle: number) => ({
    x: x * Math.cos(angle) - y * Math.sin(angle),
    y: x * Math.sin(angle) + y * Math.cos(angle)
  });

  vertices.push({
    x: plan.center.x,
    y: plan.center.y,
    u: 0.5,
    v: 0.5
  });

  for (let i = 0; i <= plan.sides; i++) {
    const t = (i / plan.sides) * Math.PI * 2 + plan.angle;
    const px = plan.center.x + Math.cos(t) * plan.radius;
    const py = plan.center.y + Math.sin(t) * plan.radius;
    const local = rotateUv(Math.cos(t) / texZoom, Math.sin(t) / texZoom, plan.textureAngle);
    vertices.push({
      x: px,
      y: py,
      u: 0.5 + local.x * 0.5,
      v: 0.5 - local.y * 0.5
    });
  }

  return vertices;
};

export const buildMilkwaveShapeBorderLoop = (plan: MilkwaveShapePlan): MilkwaveShapeVertex[] =>
  buildMilkwaveShapeFan(plan).slice(1);

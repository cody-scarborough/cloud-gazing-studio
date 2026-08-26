import { css, type SkyPalette } from "./palette";

export type Flock = {
  kind: "geese";
  x: number;
  y: number;
  vx: number;
  vy: number;
  count: number;
  scale: number;
  phase: number;
  honkAt: number;
};

export type Balloon = {
  kind: "balloon";
  x: number;
  y: number;
  vx: number;
  vy: number;
  scale: number;
  hueShift: number;
  burnerAt: number;
};

export type Plane = {
  kind: "plane";
  x: number;
  y: number;
  vx: number;
  scale: number;
  trail: { x: number; y: number; age: number }[];
};

export type Entity = Flock | Balloon | Plane;

export function drawGeese(ctx: CanvasRenderingContext2D, f: Flock, p: SkyPalette, t: number) {
  const dir = Math.sign(f.vx) || 1;
  ctx.save();
  ctx.strokeStyle = css(p.cloudShadow, 0.85);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (let i = 0; i < f.count; i++) {
    const row = Math.floor(i / 2);
    const side = i % 2 === 0 ? 1 : -1;
    const gx = f.x - dir * row * f.scale * 2.1;
    const gy = f.y + side * row * f.scale * 1.15;
    const flap = Math.sin(t * 6 + f.phase + i * 0.5);
    const s = f.scale;
    ctx.lineWidth = Math.max(1, s * 0.22);
    ctx.beginPath();
    ctx.moveTo(gx - dir * s, gy + flap * s * 0.55);
    ctx.quadraticCurveTo(gx - dir * s * 0.3, gy - s * 0.15, gx, gy);
    ctx.quadraticCurveTo(gx + dir * s * 0.3, gy - s * 0.15, gx + dir * s, gy + flap * s * 0.55);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawBalloon(ctx: CanvasRenderingContext2D, b: Balloon, p: SkyPalette) {
  const s = b.scale;
  ctx.save();
  ctx.translate(b.x, b.y);

  const grad = ctx.createLinearGradient(-s, -s * 1.6, s, s * 0.4);
  grad.addColorStop(0, `hsl(${(18 + b.hueShift) % 360} 78% 62%)`);
  grad.addColorStop(0.5, `hsl(${(342 + b.hueShift) % 360} 62% 52%)`);
  grad.addColorStop(1, `hsl(${(210 + b.hueShift) % 360} 48% 40%)`);

  ctx.beginPath();
  ctx.moveTo(0, s * 0.5);
  ctx.bezierCurveTo(-s * 1.25, -s * 0.35, -s * 0.95, -s * 1.75, 0, -s * 1.75);
  ctx.bezierCurveTo(s * 0.95, -s * 1.75, s * 1.25, -s * 0.35, 0, s * 0.5);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.strokeStyle = css(p.cloudShadow, 0.28);
  ctx.lineWidth = Math.max(0.6, s * 0.05);
  for (const off of [-0.45, 0, 0.45]) {
    ctx.beginPath();
    ctx.moveTo(0, s * 0.5);
    ctx.bezierCurveTo(off * s * 1.9, -s * 0.4, off * s * 1.4, -s * 1.6, 0, -s * 1.75);
    ctx.stroke();
  }

  ctx.strokeStyle = css(p.cloudShadow, 0.6);
  ctx.beginPath();
  ctx.moveTo(-s * 0.24, s * 0.52);
  ctx.lineTo(-s * 0.2, s * 0.95);
  ctx.moveTo(s * 0.24, s * 0.52);
  ctx.lineTo(s * 0.2, s * 0.95);
  ctx.stroke();

  ctx.fillStyle = "hsl(28 42% 32%)";
  ctx.fillRect(-s * 0.26, s * 0.95, s * 0.52, s * 0.38);
  ctx.restore();
}

export function drawPlane(ctx: CanvasRenderingContext2D, pl: Plane, p: SkyPalette) {
  ctx.save();
  ctx.lineCap = "round";
  for (const seg of pl.trail) {
    const a = Math.max(0, 1 - seg.age / 26) * 0.5;
    if (a <= 0) continue;
    ctx.fillStyle = css(p.cloudLight, a);
    ctx.beginPath();
    ctx.arc(seg.x, seg.y, pl.scale * (0.35 + seg.age * 0.06), 0, Math.PI * 2);
    ctx.fill();
  }
  const dir = Math.sign(pl.vx) || 1;
  const s = pl.scale;
  ctx.fillStyle = css(p.cloudShadow, 0.9);
  ctx.beginPath();
  ctx.ellipse(pl.x, pl.y, s * 1.6, s * 0.34, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(pl.x + dir * s * 0.2, pl.y);
  ctx.lineTo(pl.x - dir * s * 0.5, pl.y - s * 0.9);
  ctx.lineTo(pl.x - dir * s * 0.1, pl.y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

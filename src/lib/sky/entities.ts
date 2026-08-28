import { css, type SkyPalette } from "./palette";
import { valueNoise } from "./noise";

import gooseUpSrc from "@/assets/goose-up.png";
import gooseDownSrc from "@/assets/goose-down.png";
import balloonSrc from "@/assets/balloon.png";
import planeSrc from "@/assets/plane.png";

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

const cache = new Map<string, HTMLImageElement>();

function sprite(src: string): HTMLImageElement | null {
  if (typeof window === "undefined") return null;
  let img = cache.get(src);
  if (!img) {
    img = new Image();
    img.decoding = "async";
    img.src = src;
    cache.set(src, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

export function preloadSkySprites() {
  [gooseUpSrc, gooseDownSrc, balloonSrc, planeSrc].forEach((s) => sprite(s));
}

/** draws a sprite centred at x,y, optionally mirrored, tinted to the sky */
function blit(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  flip: boolean,
  alpha = 1,
  rotate = 0,
) {
  const h = (img.naturalHeight / img.naturalWidth) * w;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  if (rotate) ctx.rotate(rotate);
  if (flip) ctx.scale(-1, 1);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
}

export function drawGeese(ctx: CanvasRenderingContext2D, f: Flock, p: SkyPalette, t: number) {
  const dir = Math.sign(f.vx) || 1;
  const up = sprite(gooseUpSrc);
  const down = sprite(gooseDownSrc);
  if (!up || !down) return;

  const bodyW = f.scale * 8;
  for (let i = 0; i < f.count; i++) {
    const row = Math.floor(i / 2);
    const side = i % 2 === 0 ? 1 : -1;
    // ragged, imperfect V — each bird wanders around its slot
    const jx = valueNoise(i * 3.1, t * 0.35, 11) - 0.5;
    const jy = valueNoise(i * 2.7 + 40, t * 0.3, 23) - 0.5;
    const gx = f.x - dir * (row * bodyW * 0.95 + jx * bodyW * 0.5);
    const gy = f.y + side * row * bodyW * 0.42 + jy * bodyW * 0.35;
    const flap = Math.sin(t * 5.2 + f.phase + i * 0.7);
    const img = flap > 0 ? up : down;
    // the down-stroke reference faces the other way
    const flip = img === down ? dir > 0 : dir < 0;
    const w = bodyW * (0.9 + (row === 0 ? 0.12 : 0));
    blit(ctx, img, gx, gy, w, flip, 0.92, dir * flap * 0.05);
  }

  // faint atmospheric wash so they sit in the sky rather than on top of it
  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  ctx.fillStyle = css(p.mid, 0.06);
  ctx.restore();
}

export function drawBalloon(ctx: CanvasRenderingContext2D, b: Balloon, p: SkyPalette) {
  const img = sprite(balloonSrc);
  if (!img) return;
  const w = b.scale * 2.1;
  const sway = Math.sin(b.x * 0.006 + b.hueShift) * 0.045;
  blit(ctx, img, b.x, b.y, w, false, 0.97, sway);

  // time-of-day tint so it belongs to the current sky
  const h = (img.naturalHeight / img.naturalWidth) * w;
  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  ctx.globalAlpha = 0.16;
  const grad = ctx.createLinearGradient(0, b.y - h / 2, 0, b.y + h / 2);
  grad.addColorStop(0, css(p.sun, 1));
  grad.addColorStop(1, css(p.cloudShadow, 1));
  ctx.fillStyle = grad;
  ctx.fillRect(b.x - w / 2, b.y - h / 2, w, h);
  ctx.restore();
}

export function drawPlane(ctx: CanvasRenderingContext2D, pl: Plane, p: SkyPalette) {
  // contrail: a noise-broken vapour line that spreads and fades with age
  ctx.save();
  for (let i = 0; i < pl.trail.length; i++) {
    const seg = pl.trail[i]!;
    const life = 1 - seg.age / 26;
    if (life <= 0) continue;
    const breakUp = valueNoise(seg.x * 0.05, seg.y * 0.05 + seg.age * 0.4, 3);
    const a = life * life * 0.55 * (0.35 + breakUp * 0.9);
    if (a <= 0.01) continue;
    const r = pl.scale * (0.5 + seg.age * 0.55) * (0.7 + breakUp * 0.6);
    const g = ctx.createRadialGradient(seg.x, seg.y, 0, seg.x, seg.y, r);
    g.addColorStop(0, css(p.cloudLight, a));
    g.addColorStop(1, css(p.cloudLight, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(seg.x, seg.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  const img = sprite(planeSrc);
  if (!img) return;
  const dir = Math.sign(pl.vx) || 1;
  blit(ctx, img, pl.x, pl.y, pl.scale * 26, dir < 0, 0.95);
}

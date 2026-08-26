import { mulberry32, randomSeed } from "./rng";
import { css, type SkyPalette } from "./palette";

export type Puff = { x: number; y: number; r: number };

export type CloudSeed = {
  seed: number;
  /** normalized: x,y in 0..1 of the cloud box, r relative to box width */
  puffs: Puff[];
  aspect: number;
};

export function makeCloudSeed(seed: number = randomSeed()): CloudSeed {
  const rnd = mulberry32(seed);
  const raw: Puff[] = [];
  const lobes = 3 + Math.floor(rnd() * 4);
  let x = 0;

  for (let i = 0; i < lobes; i++) {
    const edge = i === 0 || i === lobes - 1;
    const r = (edge ? 0.1 + rnd() * 0.08 : 0.15 + rnd() * 0.15) * 1.1;
    x += r * (0.75 + rnd() * 0.6);
    const y = -r * (0.28 + rnd() * 0.45);
    raw.push({ x, y, r });
    const extra = 1 + Math.floor(rnd() * 2.4);
    for (let j = 0; j < extra; j++) {
      const rr = r * (0.42 + rnd() * 0.42);
      raw.push({
        x: x + (rnd() - 0.5) * r * 1.1,
        y: y - r * (0.42 + rnd() * 0.6),
        r: rr,
      });
    }
  }

  // filler puffs along the flat underside so the base reads solid
  const span = x;
  const fill = 3 + Math.floor(rnd() * 3);
  for (let i = 0; i < fill; i++) {
    const fx = (span * (i + 0.5)) / fill + (rnd() - 0.5) * 0.06;
    raw.push({ x: fx, y: -0.03 - rnd() * 0.04, r: 0.08 + rnd() * 0.07 });
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of raw) {
    minX = Math.min(minX, p.x - p.r);
    maxX = Math.max(maxX, p.x + p.r);
    minY = Math.min(minY, p.y - p.r);
    maxY = Math.max(maxY, p.y + p.r);
  }
  const w = maxX - minX;
  const h = maxY - minY;

  return {
    seed,
    aspect: h / w,
    puffs: raw.map((p) => ({
      x: (p.x - minX) / w,
      y: (p.y - minY) / h,
      r: p.r / w,
    })),
  };
}

export function isCloudSeed(value: unknown): value is CloudSeed {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<CloudSeed>;
  return Array.isArray(v.puffs) && typeof v.aspect === "number" && v.puffs.length > 0;
}

/** puff positions in pixels within a sprite box of the given width */
export function puffPixels(seed: CloudSeed, widthPx: number, morph = 0) {
  const heightPx = widthPx * seed.aspect;
  return seed.puffs.map((p, i) => {
    const wob = Math.sin(morph * 0.5 + i * 1.7);
    const wob2 = Math.cos(morph * 0.37 + i * 2.3);
    return {
      x: (p.x + wob * 0.006) * widthPx,
      y: (p.y + wob2 * 0.008) * heightPx,
      r: p.r * widthPx * (1 + wob2 * 0.035),
    };
  });
}

export function cloudHeight(seed: CloudSeed, widthPx: number) {
  return widthPx * seed.aspect;
}

type RenderOptions = {
  /** horizontal sun direction, -1 (left) .. 1 (right) */
  sunDir?: number;
  /** stretch applied by wind */
  stretch?: number;
  opacity?: number;
};

/**
 * Renders a soft, volumetric cloud into its own canvas so it can be blitted
 * cheaply every frame and reused for thumbnails.
 */
export function renderCloudSprite(
  seed: CloudSeed,
  widthPx: number,
  palette: SkyPalette,
  morph = 0,
  options: RenderOptions = {},
): HTMLCanvasElement {
  const sunDir = options.sunDir ?? 0;
  const stretch = options.stretch ?? 1;
  const w = Math.max(24, Math.round(widthPx * stretch));
  const heightPx = cloudHeight(seed, widthPx);
  const pad = Math.round(widthPx * 0.14);
  const cw = w + pad * 2;
  const ch = Math.round(heightPx) + pad * 2;

  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const puffs = puffPixels(seed, widthPx, morph).map((p) => ({
    x: pad + p.x * stretch,
    y: pad + p.y,
    r: p.r,
  }));

  const soft = Math.max(1.5, widthPx * 0.025);

  // 1. blurred silhouette
  ctx.save();
  ctx.filter = `blur(${soft}px)`;
  ctx.fillStyle = css(palette.cloudMid, 1);
  for (const p of puffs) {
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, p.r * stretch, p.r, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 2. vertical light -> shadow shading, clipped to the silhouette
  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  const grad = ctx.createLinearGradient(0, pad * 0.4, 0, ch);
  grad.addColorStop(0, css(palette.cloudLight, 1));
  grad.addColorStop(0.45, css(palette.cloudLight, 0.55));
  grad.addColorStop(0.78, css(palette.cloudMid, 0.55));
  grad.addColorStop(1, css(palette.cloudShadow, 0.85));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, cw, ch);

  // 3. internal volume: darker pockets low in the cloud, bright crowns on top
  ctx.filter = `blur(${soft * 2}px)`;
  for (let i = 0; i < puffs.length; i++) {
    const p = puffs[i]!;
    const depth = p.y / ch;
    if (depth > 0.5) {
      ctx.fillStyle = css(palette.cloudShadow, 0.16 + depth * 0.14);
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + p.r * 0.32, p.r * 0.82, p.r * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = css(palette.cloudLight, 0.5 - depth * 0.5);
      ctx.beginPath();
      ctx.ellipse(
        p.x - sunDir * p.r * 0.25,
        p.y - p.r * 0.34,
        p.r * 0.72,
        p.r * 0.55,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }

  // 4. sun-side rim light
  const rim = ctx.createLinearGradient(sunDir < 0 ? cw : 0, 0, sunDir < 0 ? 0 : cw, ch * 0.4);
  rim.addColorStop(0, css(palette.sun, 0.42));
  rim.addColorStop(0.5, css(palette.sun, 0.06));
  rim.addColorStop(1, "rgba(0,0,0,0)");
  ctx.filter = "none";
  ctx.fillStyle = rim;
  ctx.fillRect(0, 0, cw, ch);
  ctx.restore();

  if (options.opacity !== undefined && options.opacity < 1) {
    ctx.save();
    ctx.globalCompositeOperation = "destination-in";
    ctx.fillStyle = `rgba(0,0,0,${Math.max(0, options.opacity)})`;
    ctx.fillRect(0, 0, cw, ch);
    ctx.restore();
  }

  return canvas;
}

export const SPRITE_PAD_RATIO = 0.14;

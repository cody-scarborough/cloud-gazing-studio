import { mulberry32, randomSeed } from "./rng";
import { fbm, valueNoise } from "./noise";
import { type SkyPalette } from "./palette";

export type Puff = { x: number; y: number; r: number };

export type CloudKind = "cumulus" | "towering" | "fractus";

export type CloudSeed = {
  seed: number;
  /** normalized: x,y in 0..1 of the cloud box, r relative to box width */
  puffs: Puff[];
  aspect: number;
  kind?: CloudKind;
  /** noise offsets so two clouds never share the same fractal detail */
  nx?: number;
  ny?: number;
};

/**
 * Builds a deliberately lopsided cloud skeleton. Real cumulus grow off a
 * tilted axis with one heavy shoulder, torn edges and stray wisps — that
 * asymmetry is what makes shapes readable as animals and faces.
 */
export function makeCloudSeed(seed: number = randomSeed()): CloudSeed {
  const rnd = mulberry32(seed);
  const kindRoll = rnd();
  const kind: CloudKind = kindRoll < 0.16 ? "fractus" : kindRoll < 0.36 ? "towering" : "cumulus";

  const raw: Puff[] = [];
  const lobes = kind === "fractus" ? 4 + Math.floor(rnd() * 5) : 3 + Math.floor(rnd() * 5);
  // where along the cloud the mass piles up (0 = left heavy, 1 = right heavy)
  const massAt = 0.18 + rnd() * 0.64;
  const tilt = (rnd() - 0.5) * (kind === "towering" ? 0.5 : 0.3);
  const baseScale = kind === "fractus" ? 0.09 : 0.16;
  const heightGain = kind === "towering" ? 1.9 : 1;

  let x = 0;
  for (let i = 0; i < lobes; i++) {
    const u = lobes === 1 ? 0.5 : i / (lobes - 1);
    // asymmetric bell: fat near massAt, thin and torn towards the far edge
    const dist = Math.abs(u - massAt) / Math.max(massAt, 1 - massAt);
    const weight = Math.pow(Math.max(0.12, 1 - dist * dist), 0.8);
    const r = baseScale * (0.55 + weight * 1.15) * (0.7 + rnd() * 0.7);
    x += r * (0.55 + rnd() * 0.75);
    const y = -r * (0.2 + rnd() * 0.5) * heightGain + tilt * x;
    raw.push({ x, y, r });

    // cauliflower crowns stacked on the heavy side of each lobe
    const crowns = kind === "fractus" ? 1 : 1 + Math.floor(rnd() * (2 + weight * 3));
    for (let j = 0; j < crowns; j++) {
      const rr = r * (0.3 + rnd() * 0.55);
      raw.push({
        x: x + (rnd() - 0.35) * r * 1.25,
        y: y - r * (0.3 + rnd() * 0.85) * heightGain,
        r: rr,
      });
      if (rnd() < 0.45) {
        raw.push({
          x: x + (rnd() - 0.5) * r * 1.8,
          y: y - r * (0.9 + rnd() * 1.1) * heightGain,
          r: rr * (0.4 + rnd() * 0.4),
        });
      }
    }
  }

  const span = Math.max(0.001, x);

  // flat-ish base, but ragged: some segments hang lower than others
  if (kind !== "fractus") {
    const fill = 3 + Math.floor(rnd() * 4);
    for (let i = 0; i < fill; i++) {
      const fx = (span * (i + 0.35 + rnd() * 0.4)) / fill;
      raw.push({
        x: fx,
        y: -0.01 - rnd() * 0.05 + tilt * fx,
        r: 0.05 + rnd() * 0.09,
      });
    }
  }

  // detached wisps trailing off one side
  const wisps = Math.floor(rnd() * 3);
  for (let i = 0; i < wisps; i++) {
    const side = rnd() < 0.5 ? -1 : 1;
    raw.push({
      x: side < 0 ? -0.06 - rnd() * 0.14 : span + 0.04 + rnd() * 0.16,
      y: -rnd() * 0.16 + tilt * span * (side < 0 ? 0 : 1),
      r: 0.035 + rnd() * 0.06,
    });
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
    kind,
    nx: rnd() * 500,
    ny: rnd() * 500,
    aspect: Math.max(0.24, h / w),
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
  /** 0..1, lower = coarser field for distant clouds */
  detail?: number;
  /** 0..1 aerial perspective: how much the cloud washes into the sky */
  haze?: number;
  /** colour the haze fades toward (defaults to palette mid) */
  hazeColor?: [number, number, number];
};


const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Renders a cloud by evaluating a noise-warped density field and shading it
 * with a cheap single-scattering approximation (light marches through the
 * field, thick parts go grey-blue, thin edges glow). The result is blitted
 * every frame and reused for thumbnails.
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
  const detail = options.detail ?? 1;

  const boxW = Math.max(24, widthPx * stretch);
  const boxH = Math.max(16, cloudHeight(seed, widthPx));
  const pad = Math.round(widthPx * SPRITE_PAD_RATIO);
  const cw = Math.round(boxW) + pad * 2;
  const ch = Math.round(boxH) + pad * 2;

  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  // work at a reduced resolution, then upscale — the upscale doubles as the
  // final softening pass
  const maxField = Math.round(460 * (0.5 + detail * 0.5));
  const scale = Math.min(1, maxField / cw);
  const gw = Math.max(8, Math.round(cw * scale));
  const gh = Math.max(8, Math.round(ch * scale));

  const puffs = puffPixels(seed, widthPx, morph).map((p) => ({
    x: (pad + p.x * stretch) * scale,
    y: (pad + p.y) * scale,
    r: Math.max(1.2, p.r * scale),
  }));

  const density = new Float32Array(gw * gh);
  const nOffX = seed.nx ?? (seed.seed % 311);
  const nOffY = seed.ny ?? (seed.seed % 197);
  // noise frequency relative to cloud size so detail scale stays constant
  const freq = 7.5 / Math.max(24, boxW * scale);
  const warpAmp = Math.max(3, boxW * scale * 0.055);
  const drift = morph * 0.08;

  const flatBase = seed.kind !== "fractus";

  for (let y = 0; y < gh; y++) {
    const vy = y / gh;
    for (let x = 0; x < gw; x++) {
      // two-level domain warp: broad lobes displaced, then curled again finer
      const nxa = fbm((x + nOffX) * freq * 1.15, (y + nOffY) * freq * 1.15 + drift, 4, seed.seed);
      const nya = fbm(
        (x + nOffX + 133) * freq * 1.15,
        (y + nOffY + 71) * freq * 1.15 - drift,
        4,
        seed.seed + 17,
      );
      const cx = fbm((x + nOffX + 41) * freq * 3.6, (y + nOffY + 19) * freq * 3.6, 3, seed.seed + 31);
      const cy = fbm((x + nOffX + 87) * freq * 3.6, (y + nOffY + 53) * freq * 3.6, 3, seed.seed + 43);
      const wx = x + (nxa - 0.5) * warpAmp * 2.1 + (cx - 0.5) * warpAmp * 0.7;
      const wy = y + (nya - 0.5) * warpAmp * 1.45 + (cy - 0.5) * warpAmp * 0.55;

      let f = 0;
      for (let i = 0; i < puffs.length; i++) {
        const p = puffs[i]!;
        const dx = (wx - p.x) / p.r;
        const dy = (wy - p.y) / p.r;
        const d2 = dx * dx + dy * dy;
        if (d2 < 1) {
          const k = 1 - d2;
          f += k * k;
        }
      }
      if (f <= 0.001) continue;

      // fractal erosion: cauliflower billows on the crowns, shredded fringes,
      // and a firmer, flatter cut along the condensation base
      const det = fbm((x + nOffX) * freq * 4.4, (y + nOffY) * freq * 4.4 + drift * 2, 5, seed.seed + 5);
      const micro = fbm((x + nOffX) * freq * 10.5, (y + nOffY) * freq * 10.5, 3, seed.seed + 61);
      const fine = valueNoise((x + nOffX) * freq * 22, (y + nOffY) * freq * 22, seed.seed + 9);
      const crown = 1 - vy; // erode top edges harder than the body
      const erode = 0.11 + crown * 0.05 + (flatBase ? Math.max(0, vy - 0.8) * 0.45 : 0);
      let d =
        f * (0.74 + det * 0.5 + (micro - 0.5) * 0.16) - erode + (fine - 0.5) * 0.045;
      if (d > 0) density[y * gw + x] = d;
    }
  }


  const image = ctx.createImageData(gw, gh);
  const data = image.data;

  // light direction: sun side, from above
  const lx = sunDir === 0 ? 0.25 : sunDir * 0.75;
  const ly = -1;
  const llen = Math.hypot(lx, ly);
  const stepX = (lx / llen) * Math.max(1.6, gw * 0.03);
  const stepY = (ly / llen) * Math.max(1.6, gw * 0.03);

  const [lr, lg, lb] = palette.cloudLight;
  const [mr, mg, mb] = palette.cloudMid;
  const [sr, sg, sb] = palette.cloudShadow;
  const [sunR, sunG, sunB] = palette.sun;
  const [ambR, ambG, ambB] = palette.mid;

  const STEPS = 7;
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      const idx = y * gw + x;
      const d = density[idx]!;
      if (d <= 0) continue;

      // march toward the light accumulating optical depth
      let occ = 0;
      for (let s = 1; s <= STEPS; s++) {
        const sx = Math.round(x + stepX * s);
        const sy = Math.round(y + stepY * s);
        if (sx < 0 || sy < 0 || sx >= gw || sy >= gh) break;
        occ += density[sy * gw + sx]! * (1 - (s - 1) / (STEPS * 1.6));
      }
      const trans = Math.exp(-occ * 1.9);

      const alpha = clamp01(d * 2.7);
      const thin = 1 - alpha; // translucent fringes

      // deep body -> shadow, lit crowns -> bright, fringes pick up sun colour
      const litMix = clamp01(Math.pow(trans, 0.75) * 1.05);
      let r = sr + (lr - sr) * litMix;
      let g = sg + (lg - sg) * litMix;
      let b = sb + (lb - sb) * litMix;

      // mid tone keeps the body from blowing out
      const mid = clamp01((1 - litMix) * 0.55);
      r = r + (mr - r) * mid * 0.5;
      g = g + (mg - g) * mid * 0.5;
      b = b + (mb - b) * mid * 0.5;

      // ambient sky bounce on the underside
      const under = clamp01((y / gh - 0.55) * 1.6) * 0.28;
      r += (ambR - r) * under;
      g += (ambG - g) * under;
      b += (ambB - b) * under;

      // forward-scattered sunlight through thin edges
      const glow = thin * trans * 0.45;
      r += (sunR - r) * glow;
      g += (sunG - g) * glow;
      b += (sunB - b) * glow;

      const o = idx * 4;
      data[o] = r;
      data[o + 1] = g;
      data[o + 2] = b;
      data[o + 3] = Math.round(alpha * 255);
    }
  }

  const field = document.createElement("canvas");
  field.width = gw;
  field.height = gh;
  const fctx = field.getContext("2d");
  if (!fctx) return canvas;
  fctx.putImageData(image, 0, 0);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.globalAlpha = options.opacity ?? 1;
  ctx.drawImage(field, 0, 0, cw, ch);
  ctx.globalAlpha = 1;

  return canvas;
}

export const SPRITE_PAD_RATIO = 0.14;

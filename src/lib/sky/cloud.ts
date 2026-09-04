import { mulberry32, randomSeed } from "./rng";
import { fbm, valueNoise } from "./noise";
import { type SkyPalette } from "./palette";

export type Puff = { x: number; y: number; r: number };

export type CloudKind =
  | "cumulus"
  | "towering"
  | "fractus"
  | "congestus"
  | "stratocumulus"
  | "cirrus";

/** per-cloud rendering character, so no two clouds share the same texture recipe */
export type CloudStyle = {
  /** detail frequency multiplier */
  freq: number;
  /** domain warp strength */
  warp: number;
  /** how hard the silhouette is eaten away */
  erode: number;
  /** density gain, controls puffy vs wispy */
  gain: number;
  /** high-frequency roughness of the fringes */
  rough: number;
  /** light extinction: low = airy, high = dense and dark-bellied */
  dense: number;
  /** flatness of the condensation base, 0 = ragged, 1 = ruler-flat */
  flat: number;
};

export type CloudSeed = {
  seed: number;
  /** normalized: x,y in 0..1 of the cloud box, r relative to box width */
  puffs: Puff[];
  aspect: number;
  kind?: CloudKind;
  style?: CloudStyle;
  /** noise offsets so two clouds never share the same fractal detail */
  nx?: number;
  ny?: number;
};

const pick = <T,>(rnd: () => number, items: readonly T[]): T =>
  items[Math.floor(rnd() * items.length)]!;

/**
 * Builds a deliberately lopsided cloud skeleton. Real cumulus grow off a
 * tilted axis with one heavy shoulder, torn edges and stray wisps — that
 * asymmetry is what makes shapes readable as animals and faces. Each seed
 * also picks a species and its own texture recipe, so the sky never repeats
 * the same construction twice.
 */
export function makeCloudSeed(seed: number = randomSeed()): CloudSeed {
  const rnd = mulberry32(seed);
  const kind = pick<CloudKind>(rnd, [
    "cumulus",
    "cumulus",
    "cumulus",
    "towering",
    "congestus",
    "stratocumulus",
    "fractus",
    "cirrus",
  ]);

  const raw: Puff[] = [];
  const wispy = kind === "fractus" || kind === "cirrus";

  // ---- growth parameters vary wildly per seed -----------------------------
  const lobes =
    kind === "cirrus"
      ? 7 + Math.floor(rnd() * 9)
      : kind === "stratocumulus"
        ? 5 + Math.floor(rnd() * 6)
        : 2 + Math.floor(rnd() * 6);
  const massAt = 0.1 + rnd() * 0.8;
  const tilt = (rnd() - 0.5) * (kind === "towering" || kind === "congestus" ? 0.6 : 0.34);
  const baseScale =
    kind === "cirrus" ? 0.05 : kind === "fractus" ? 0.085 : kind === "stratocumulus" ? 0.11 : 0.16;
  const heightGain =
    kind === "towering" ? 2.1 : kind === "congestus" ? 1.5 : kind === "stratocumulus" ? 0.5 : 1;
  const spacing = 0.4 + rnd() * 0.9;
  const jitter = 0.3 + rnd() * 1.1;
  // some clouds are one dominant mass, others a broken chain of cells
  const clumpiness = rnd();

  let x = 0;
  for (let i = 0; i < lobes; i++) {
    const u = lobes === 1 ? 0.5 : i / (lobes - 1);
    const dist = Math.abs(u - massAt) / Math.max(massAt, 1 - massAt);
    const falloff = Math.pow(Math.max(0.08, 1 - dist * dist), 0.6 + clumpiness * 1.2);
    const weight = falloff * (0.5 + rnd() * (1 + clumpiness));
    const r = baseScale * (0.5 + weight * 1.3) * (0.6 + rnd() * 0.9);
    x += r * spacing * (0.5 + rnd() * 1.1) + (rnd() < 0.18 ? baseScale * rnd() * 1.4 : 0);
    const y =
      -r * (0.15 + rnd() * 0.6) * heightGain +
      tilt * x +
      (rnd() - 0.5) * baseScale * jitter * 0.6;
    raw.push({ x, y, r });

    // cauliflower crowns stacked on the heavy side of each lobe
    const crowns = wispy ? Math.floor(rnd() * 2) : Math.floor(rnd() * (2 + weight * 4));
    const lean = rnd() - 0.5;
    for (let j = 0; j < crowns; j++) {
      const rr = r * (0.22 + rnd() * 0.6);
      const cxp = x + lean * r * 1.6 + (rnd() - 0.5) * r * 1.3;
      const cyp = y - r * (0.25 + rnd() * 0.95) * heightGain;
      raw.push({ x: cxp, y: cyp, r: rr });
      // second and third generation billows on bigger towers
      if (rnd() < 0.35 + heightGain * 0.12) {
        raw.push({
          x: cxp + (rnd() - 0.5) * rr * 2.2,
          y: cyp - rr * (0.6 + rnd() * 1.3) * heightGain,
          r: rr * (0.35 + rnd() * 0.5),
        });
      }
    }
  }

  const span = Math.max(0.001, x);

  // flat-ish base, but ragged: some segments hang lower than others
  if (!wispy) {
    const fill = 2 + Math.floor(rnd() * 6);
    const sag = rnd() * 0.06;
    for (let i = 0; i < fill; i++) {
      const fx = (span * (i + 0.2 + rnd() * 0.7)) / fill;
      raw.push({
        x: fx,
        y: -0.005 - rnd() * sag + tilt * fx,
        r: 0.04 + rnd() * 0.1,
      });
    }
  }

  // cirrus streak off the downwind end
  if (kind === "cirrus" || rnd() < 0.22) {
    const dir = rnd() < 0.5 ? -1 : 1;
    const streak = 2 + Math.floor(rnd() * 5);
    for (let i = 0; i < streak; i++) {
      const t = (i + 1) / streak;
      raw.push({
        x: (dir < 0 ? 0 : span) + dir * t * span * (0.2 + rnd() * 0.5),
        y: -t * (0.04 + rnd() * 0.14) + tilt * span,
        r: (0.05 + rnd() * 0.05) * (1 - t * 0.6),
      });
    }
  }

  // detached wisps trailing off one side
  const wisps = Math.floor(rnd() * 4);
  for (let i = 0; i < wisps; i++) {
    const side = rnd() < 0.5 ? -1 : 1;
    raw.push({
      x: side < 0 ? -0.04 - rnd() * 0.2 : span + 0.02 + rnd() * 0.22,
      y: -rnd() * 0.2 + tilt * span * (side < 0 ? 0 : 1),
      r: 0.025 + rnd() * 0.07,
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

  const style: CloudStyle = {
    freq: (kind === "cirrus" ? 1.5 : 0.75) + rnd() * 0.9,
    warp: (wispy ? 0.045 : 0.035) + rnd() * 0.055,
    erode: 0.07 + rnd() * 0.1 + (wispy ? 0.03 : 0),
    gain: 0.66 + rnd() * 0.3,
    rough: 0.5 + rnd() * 1.3,
    dense: wispy ? 0.8 + rnd() * 0.5 : 1.3 + rnd() * 1.1,
    flat: wispy ? 0 : kind === "stratocumulus" ? 0.2 + rnd() * 0.4 : rnd(),
  };

  return {
    seed,
    kind,
    style,
    nx: rnd() * 900,
    ny: rnd() * 900,
    aspect: Math.max(0.16, Math.min(1.6, h / w)),
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

/** legacy seeds saved before styles existed get a deterministic recipe */
function styleOf(seed: CloudSeed): CloudStyle {
  if (seed.style) return seed.style;
  const rnd = mulberry32((seed.seed ?? 1) + 7919);
  return {
    freq: 0.85 + rnd() * 0.7,
    warp: 0.04 + rnd() * 0.04,
    erode: 0.09 + rnd() * 0.07,
    gain: 0.7 + rnd() * 0.25,
    rough: 0.6 + rnd() * 1,
    dense: 1.4 + rnd() * 0.8,
    flat: rnd(),
  };
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

  const st = styleOf(seed);
  const density = new Float32Array(gw * gh);
  const nOffX = seed.nx ?? (seed.seed % 311);
  const nOffY = seed.ny ?? (seed.seed % 197);
  // noise frequency relative to cloud size so detail scale stays constant
  const freq = (7.5 * st.freq) / Math.max(24, boxW * scale);
  const warpAmp = Math.max(3, boxW * scale * st.warp);
  const drift = morph * 0.08;

  const flatBase = st.flat > 0.05;

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
      const erode =
        st.erode + crown * 0.05 + (flatBase ? Math.max(0, vy - (0.88 - st.flat * 0.12)) * 0.5 * (0.4 + st.flat) : 0);
      let d =
        f * (st.gain + det * 0.5 + (micro - 0.5) * 0.16 * st.rough) -
        erode +
        (fine - 0.5) * 0.045 * st.rough;

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

  const haze = options.haze ?? 0;
  const [hzR, hzG, hzB] = options.hazeColor ?? palette.mid;

  const STEPS = 12;
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      const idx = y * gw + x;
      const d = density[idx]!;
      if (d <= 0) continue;

      // march toward the light accumulating optical depth (cone-widening steps)
      let occ = 0;
      for (let s = 1; s <= STEPS; s++) {
        const g = s * (1 + s * 0.14);
        const sx = Math.round(x + stepX * g);
        const sy = Math.round(y + stepY * g);
        if (sx < 0 || sy < 0 || sx >= gw || sy >= gh) break;
        occ += density[sy * gw + sx]! * (1 - (s - 1) / (STEPS * 1.5));
      }
      // Beer–Powder: exponential extinction plus the dark-edge powder term that
      // gives real cumulus their crisp, slightly sooty crevices
      const beer = Math.exp(-occ * st.dense);
      const powder = 1 - Math.exp(-occ * st.dense * 1.85);
      const trans = beer * (0.55 + 0.45 * powder * 1.35);

      const alpha = clamp01(Math.pow(clamp01(d * (1.9 + st.dense * 0.35)), 0.82));

      const thin = 1 - alpha; // translucent fringes

      // deep body -> shadow, lit crowns -> bright, fringes pick up sun colour
      const litMix = clamp01(Math.pow(clamp01(trans), 0.72) * 1.08);
      let r = sr + (lr - sr) * litMix;
      let g = sg + (lg - sg) * litMix;
      let b = sb + (lb - sb) * litMix;

      // mid tone keeps the body from blowing out
      const mid = clamp01((1 - litMix) * 0.55);
      r = r + (mr - r) * mid * 0.5;
      g = g + (mg - g) * mid * 0.5;
      b = b + (mb - b) * mid * 0.5;

      // ambient sky bounce on the underside, cool and blue like real shade
      const under = clamp01((y / gh - 0.5) * 1.7) * 0.34;
      r += (ambR - r) * under;
      g += (ambG - g) * under;
      b += (ambB - b) * under;

      // multiple scattering: dense interiors stay luminous rather than muddy
      const ms = clamp01(d * 0.5) * 0.16;
      r += (mr - r) * ms;
      g += (mg - g) * ms;
      b += (mb - b) * ms;

      // forward-scattered sunlight and silver lining through thin edges
      const glow = thin * beer * 0.55 + Math.pow(thin, 3) * beer * 0.35;
      r += (sunR - r) * glow;
      g += (sunG - g) * glow;
      b += (sunB - b) * glow;

      // aerial perspective: distant clouds wash into the sky's haze
      if (haze > 0) {
        r += (hzR - r) * haze;
        g += (hzG - g) * haze;
        b += (hzB - b) * haze;
      }

      const o = idx * 4;
      data[o] = r;
      data[o + 1] = g;
      data[o + 2] = b;
      data[o + 3] = Math.round(alpha * (1 - haze * 0.35) * 255);
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

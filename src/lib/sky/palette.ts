export type SkyPalette = {
  name: string;
  zenith: [number, number, number];
  mid: [number, number, number];
  horizon: [number, number, number];
  sun: [number, number, number];
  sunGlow: [number, number, number];
  cloudLight: [number, number, number];
  cloudMid: [number, number, number];
  cloudShadow: [number, number, number];
  /** 0 = sun at horizon left, 1 = horizon right, 0.5 = overhead */
  sunX: number;
  sunY: number;
  starAlpha: number;
};

const rgb = (r: number, g: number, b: number): [number, number, number] => [r, g, b];

const KEYFRAMES: SkyPalette[] = [
  {
    name: "First light",
    zenith: rgb(74, 108, 158),
    mid: rgb(146, 168, 196),
    horizon: rgb(242, 206, 184),
    sun: rgb(255, 236, 206),
    sunGlow: rgb(255, 197, 150),
    cloudLight: rgb(252, 231, 220),
    cloudMid: rgb(214, 195, 199),
    cloudShadow: rgb(128, 122, 146),
    sunX: 0.12,
    sunY: 0.82,
    starAlpha: 0.18,
  },
  {
    name: "Morning",
    zenith: rgb(72, 133, 196),
    mid: rgb(139, 187, 227),
    horizon: rgb(216, 233, 242),
    sun: rgb(255, 252, 238),
    sunGlow: rgb(255, 238, 200),
    cloudLight: rgb(255, 253, 250),
    cloudMid: rgb(226, 231, 240),
    cloudShadow: rgb(142, 152, 175),
    sunX: 0.24,
    sunY: 0.42,
    starAlpha: 0,
  },
  {
    name: "High noon",
    zenith: rgb(46, 118, 196),
    mid: rgb(118, 176, 226),
    horizon: rgb(207, 229, 244),
    sun: rgb(255, 255, 248),
    sunGlow: rgb(255, 250, 224),
    cloudLight: rgb(255, 255, 255),
    cloudMid: rgb(226, 233, 243),
    cloudShadow: rgb(138, 151, 174),
    sunX: 0.5,
    sunY: 0.12,
    starAlpha: 0,
  },
  {
    name: "Afternoon",
    zenith: rgb(58, 122, 190),
    mid: rgb(136, 181, 222),
    horizon: rgb(226, 228, 226),
    sun: rgb(255, 250, 230),
    sunGlow: rgb(255, 234, 190),
    cloudLight: rgb(255, 252, 246),
    cloudMid: rgb(228, 228, 232),
    cloudShadow: rgb(144, 148, 166),
    sunX: 0.72,
    sunY: 0.3,
    starAlpha: 0,
  },
  {
    name: "Golden hour",
    zenith: rgb(64, 110, 168),
    mid: rgb(180, 168, 186),
    horizon: rgb(250, 196, 132),
    sun: rgb(255, 226, 160),
    sunGlow: rgb(255, 176, 106),
    cloudLight: rgb(255, 226, 190),
    cloudMid: rgb(226, 174, 158),
    cloudShadow: rgb(124, 100, 122),
    sunX: 0.86,
    sunY: 0.72,
    starAlpha: 0,
  },
  {
    name: "Dusk",
    zenith: rgb(38, 54, 104),
    mid: rgb(108, 96, 152),
    horizon: rgb(226, 137, 122),
    sun: rgb(255, 190, 150),
    sunGlow: rgb(226, 122, 108),
    cloudLight: rgb(238, 178, 168),
    cloudMid: rgb(168, 128, 148),
    cloudShadow: rgb(72, 62, 100),
    sunX: 0.94,
    sunY: 0.94,
    starAlpha: 0.35,
  },
  {
    name: "Blue hour",
    zenith: rgb(20, 30, 68),
    mid: rgb(48, 62, 112),
    horizon: rgb(126, 108, 148),
    sun: rgb(180, 156, 190),
    sunGlow: rgb(120, 104, 152),
    cloudLight: rgb(150, 142, 178),
    cloudMid: rgb(96, 94, 132),
    cloudShadow: rgb(42, 44, 78),
    sunX: 1.02,
    sunY: 1.05,
    starAlpha: 0.8,
  },
];

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function lerpColor(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  return [
    Math.round(lerp(a[0], b[0], t)),
    Math.round(lerp(a[1], b[1], t)),
    Math.round(lerp(a[2], b[2], t)),
  ];
}

/** t goes 0 -> 1 across a full day, wrapping back to first light. */
export function paletteAt(t: number): SkyPalette {
  const n = KEYFRAMES.length;
  const wrapped = ((t % 1) + 1) % 1;
  const pos = wrapped * n;
  const i = Math.floor(pos) % n;
  const j = (i + 1) % n;
  const f = pos - Math.floor(pos);
  const a = KEYFRAMES[i]!;
  const b = KEYFRAMES[j]!;
  return {
    name: f < 0.5 ? a.name : b.name,
    zenith: lerpColor(a.zenith, b.zenith, f),
    mid: lerpColor(a.mid, b.mid, f),
    horizon: lerpColor(a.horizon, b.horizon, f),
    sun: lerpColor(a.sun, b.sun, f),
    sunGlow: lerpColor(a.sunGlow, b.sunGlow, f),
    cloudLight: lerpColor(a.cloudLight, b.cloudLight, f),
    cloudMid: lerpColor(a.cloudMid, b.cloudMid, f),
    cloudShadow: lerpColor(a.cloudShadow, b.cloudShadow, f),
    sunX: lerp(a.sunX, b.sunX, f),
    sunY: lerp(a.sunY, b.sunY, f),
    starAlpha: lerp(a.starAlpha, b.starAlpha, f),
  };
}

export function css(c: [number, number, number], alpha = 1) {
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})`;
}

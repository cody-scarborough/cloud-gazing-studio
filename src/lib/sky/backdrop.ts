import { css, type SkyPalette } from "./palette";

/**
 * The shared sky backdrop used by both the live scene and the gallery
 * thumbnails, so a saved cloud is shown against exactly the sky it was
 * spotted in.
 */
export function drawSkyBackdrop(
  ctx: CanvasRenderingContext2D,
  p: SkyPalette,
  w: number,
  h: number,
  t = 0,
  options: { sun?: boolean } = {},
) {
  // atmospheric scattering falls off non-linearly towards the horizon
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  const mixTo = (a: [number, number, number], b: [number, number, number], k: number) =>
    css([
      Math.round(a[0] + (b[0] - a[0]) * k),
      Math.round(a[1] + (b[1] - a[1]) * k),
      Math.round(a[2] + (b[2] - a[2]) * k),
    ]);
  for (let i = 0; i <= 16; i++) {
    const s = i / 16;
    const k = Math.pow(s, 1.8);
    const color = k < 0.5 ? mixTo(p.zenith, p.mid, k * 2) : mixTo(p.mid, p.horizon, (k - 0.5) * 2);
    grad.addColorStop(s, color);
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  if (p.starAlpha > 0.01) {
    for (let i = 0; i < 90; i++) {
      const stx = ((i * 9301 + 49297) % 233280) / 233280;
      const sty = ((i * 4523 + 1231) % 99991) / 99991;
      const tw = 0.5 + 0.5 * Math.sin(t * 1.4 + i);
      ctx.fillStyle = `rgba(255,255,255,${p.starAlpha * (0.35 + tw * 0.65) * (1 - sty * 0.7)})`;
      ctx.fillRect(stx * w, sty * h * 0.75, 1.6, 1.6);
    }
  }

  if (options.sun !== false) {
    const sx = p.sunX * w;
    const sy = p.sunY * h;
    const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, Math.max(w, h) * 0.8);
    glow.addColorStop(0, css(p.sunGlow, 0.5));
    glow.addColorStop(0.08, css(p.sunGlow, 0.28));
    glow.addColorStop(0.3, css(p.sunGlow, 0.12));
    glow.addColorStop(0.7, css(p.sunGlow, 0.03));
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    for (const [radius, alpha] of [[w * 0.22, 0.14], [w * 0.09, 0.3]] as const) {
      const bloom = ctx.createRadialGradient(sx, sy, 0, sx, sy, radius);
      bloom.addColorStop(0, css(p.sun, alpha));
      bloom.addColorStop(0.45, css(p.sunGlow, alpha * 0.45));
      bloom.addColorStop(1, css(p.sunGlow, 0));
      ctx.fillStyle = bloom;
      ctx.fillRect(sx - radius, sy - radius, radius * 2, radius * 2);
    }

    const discR = w * 0.022;
    const disc = ctx.createRadialGradient(sx, sy, 0, sx, sy, discR);
    disc.addColorStop(0, css(p.sun, 0.95));
    disc.addColorStop(0.55, css(p.sun, 0.7));
    disc.addColorStop(1, css(p.sun, 0));
    ctx.fillStyle = disc;
    ctx.fillRect(sx - discR, sy - discR, discR * 2, discR * 2);
  }

  const haze = ctx.createLinearGradient(0, h * 0.5, 0, h);
  haze.addColorStop(0, css(p.horizon, 0));
  haze.addColorStop(0.55, css(p.horizon, 0.28));
  haze.addColorStop(1, css(p.horizon, 0.82));
  ctx.fillStyle = haze;
  ctx.fillRect(0, h * 0.5, w, h * 0.5);
}

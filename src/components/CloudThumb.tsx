import { useEffect, useRef } from "react";

import { renderCloudSprite, type CloudSeed } from "@/lib/sky/cloud";
import { css, paletteAt } from "@/lib/sky/palette";

export function CloudThumb({
  seed,
  skyTime,
  width = 220,
  className,
}: {
  seed: CloudSeed;
  skyTime: number;
  width?: number;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const palette = paletteAt(skyTime);
    const sprite = renderCloudSprite(seed, width, palette, seed.seed % 17, {
      sunDir: palette.sunX < 0.5 ? -1 : 1,
    });
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const h = Math.round(width * 0.62);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, css(palette.zenith));
    grad.addColorStop(0.6, css(palette.mid));
    grad.addColorStop(1, css(palette.horizon));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, h);

    const scale = Math.min((width * 0.86) / sprite.width, (h * 0.86) / sprite.height);
    const dw = sprite.width * scale;
    const dh = sprite.height * scale;
    ctx.drawImage(sprite, (width - dw) / 2, (h - dh) / 2, dw, dh);
  }, [seed, skyTime, width]);

  return <canvas ref={ref} className={className} style={{ width: "100%" }} />;
}

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

    const draw = () => {
      // render at the canvas' real laid-out size so nothing gets stretched
      const w = Math.max(80, Math.round(canvas.clientWidth || width));
      const h = Math.round(w * 0.62);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const palette = paletteAt(skyTime);
      drawSkyBackdrop(ctx, palette, w, h);

      const sprite = renderCloudSprite(seed, w * 0.7, palette, 0, {
        sunDir: palette.sunX < 0.5 ? -1 : 1,
        detail: 1,
      });
      const scale = Math.min((w * 0.86) / sprite.width, (h * 0.86) / sprite.height);
      const dw = sprite.width * scale;
      const dh = sprite.height * scale;
      ctx.drawImage(sprite, (w - dw) / 2, (h - dh) / 2, dw, dh);
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [seed, skyTime, width]);

  return <canvas ref={ref} className={className} style={{ width: "100%", display: "block" }} />;
}

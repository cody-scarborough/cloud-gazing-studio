import { useCallback, useEffect, useRef, useState } from "react";
import { Volume2, VolumeX, Wind, Sun } from "lucide-react";

import { makeCloudSeed, puffPixels, renderCloudSprite, SPRITE_PAD_RATIO, type CloudSeed } from "@/lib/sky/cloud";
import { css, paletteAt, type SkyPalette } from "@/lib/sky/palette";
import { SkyAudio } from "@/lib/sky/audio";
import { drawSkyBackdrop } from "@/lib/sky/backdrop";
import { randomSeed } from "@/lib/sky/rng";

type SkyCloud = {
  id: number;
  seed: CloudSeed;
  x: number;
  y: number;
  width: number;
  depth: number;
  morph: number;
  morphOffset: number;
  sprite: HTMLCanvasElement | null;
  spriteKey: string;
  named: boolean;
  fade: number;
};

type Floater = { text: string; x: number; y: number; vx: number; life: number };

export type SkySceneProps = {
  onSave: (payload: { text: string; seed: CloudSeed; skyTime: number }) => Promise<void>;
  signedIn: boolean;
  saving?: boolean;
};

const DAY_LENGTH_SECONDS = 720;

export function SkyScene({ onSave, signedIn, saving }: SkySceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cloudsRef = useRef<SkyCloud[]>([]);
  const floatersRef = useRef<Floater[]>([]);
  const windRef = useRef(0);
  const gustEnergyRef = useRef(0);
  const timeRef = useRef(0.28);
  const selectedRef = useRef<number | null>(null);
  const hoverRef = useRef<number | null>(null);
  const pointerRef = useRef<{ x: number; y: number; down: boolean; lastX: number }>({
    x: -1,
    y: -1,
    down: false,
    lastX: 0,
  });
  const sizeRef = useRef({ w: 1200, h: 800 });
  const audioRef = useRef<SkyAudio | null>(null);
  const nextIdRef = useRef(1);
  const spawnTimersRef = useRef({ chirp: 12 });

  const [selected, setSelected] = useState<{ id: number; seed: CloudSeed } | null>(null);
  const [caption, setCaption] = useState("");
  const [soundOn, setSoundOn] = useState(false);
  const [phase, setPhase] = useState("Morning");
  const [windLevel, setWindLevel] = useState(0);

  const spawnCloud = useCallback((offscreen: boolean) => {
    const { w, h } = sizeRef.current;
    const depth = 0.35 + Math.random() * 0.65;
    // occasional giants and small scraps break up the uniform sizing
    const roll = Math.random();
    const sizeMul = roll < 0.16 ? 1.5 + Math.random() * 0.8 : roll > 0.82 ? 0.45 + Math.random() * 0.25 : 0.8 + Math.random() * 0.5;
    const width = (w * 0.13 + Math.random() * w * 0.2) * (0.55 + depth * 0.7) * sizeMul;

    const seed = makeCloudSeed(randomSeed());
    const cloud: SkyCloud = {
      id: nextIdRef.current++,
      seed,
      x: offscreen ? -width * 1.4 : Math.random() * (w + width) - width * 0.5,
      y: h * (0.05 + Math.random() * 0.68) * (1.05 - depth * 0.18),
      width,
      depth,
      morph: Math.random() * 40,
      morphOffset: Math.random(),
      sprite: null,
      spriteKey: "",
      named: false,
      fade: offscreen ? 0 : 1,
    };
    cloudsRef.current.push(cloud);
  }, []);




  const cloudAt = useCallback((px: number, py: number) => {
    const list = cloudsRef.current;
    for (let i = list.length - 1; i >= 0; i--) {
      const c = list[i]!;
      if (c.fade < 0.4) continue;
      const puffs = puffPixels(c.seed, c.width, c.morph);
      for (const p of puffs) {
        const dx = px - (c.x + p.x);
        const dy = py - (c.y + p.y);
        if (dx * dx + dy * dy < p.r * p.r * 1.05) return c;
      }
    }
    return null;
  }, []);

  const release = useCallback((text: string | null) => {
    const id = selectedRef.current;
    selectedRef.current = null;
    setSelected(null);
    setCaption("");
    if (id == null) return;
    const cloud = cloudsRef.current.find((c) => c.id === id);
    if (cloud && text) {
      cloud.named = true;
      floatersRef.current.push({
        text,
        x: cloud.x + cloud.width / 2,
        y: cloud.y + cloud.width * cloud.seed.aspect + 26,
        vx: 18,
        life: 5,
      });
    }
  }, []);

  // main animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let last = performance.now();
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      sizeRef.current = { w, h };
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    };
    resize();
    window.addEventListener("resize", resize);


    if (cloudsRef.current.length === 0) {
      for (let i = 0; i < 7; i++) spawnCloud(false);
    }

    // fine film grain, built once and tiled — keeps the sky from banding
    let grainPattern: CanvasPattern | null = null;
    const makeGrain = () => {
      const g = document.createElement("canvas");
      g.width = 128;
      g.height = 128;
      const gc = g.getContext("2d");
      if (!gc) return null;
      const img = gc.createImageData(128, 128);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = 128 + (Math.random() - 0.5) * 255;
        img.data[i] = v;
        img.data[i + 1] = v;
        img.data[i + 2] = v;
        img.data[i + 3] = 16;
      }
      gc.putImageData(img, 0, 0);
      return ctx.createPattern(g, "repeat");
    };

    const drawBackdrop = (p: SkyPalette, w: number, h: number, t: number) =>
      drawSkyBackdrop(ctx, p, w, h, t);

    const drawFilmGrade = (w: number, h: number) => {
      if (!grainPattern) grainPattern = makeGrain();
      if (grainPattern) {
        ctx.save();
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = grainPattern;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
      }
      const vig = ctx.createRadialGradient(
        w * 0.5,
        h * 0.45,
        Math.min(w, h) * 0.25,
        w * 0.5,
        h * 0.45,
        Math.max(w, h) * 0.78,
      );
      vig.addColorStop(0, "rgba(0,0,0,0)");
      vig.addColorStop(1, "rgba(12,18,32,0.22)");
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, w, h);
    };


    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const { w, h } = sizeRef.current;
      const t = now / 1000;

      timeRef.current = (timeRef.current + dt / DAY_LENGTH_SECONDS) % 1;
      const palette = paletteAt(timeRef.current);

      windRef.current = Math.max(0, windRef.current - dt * 0.55);
      const wind = windRef.current;
      audioRef.current?.setWind(Math.min(1, wind));

      gustEnergyRef.current += wind * dt;
      if (gustEnergyRef.current > 1.1 && cloudsRef.current.length < 16) {
        gustEnergyRef.current = 0;
        spawnCloud(true);
      }

      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawBackdrop(palette, w, h, t);

      // clouds
      let renderBudget = 2;
      const sunDir = palette.sunX < 0.5 ? -1 : 1;
      const paletteBucket = Math.floor(timeRef.current * 240);
      const list = cloudsRef.current;

      for (const c of list) {
        const selectedThis = selectedRef.current === c.id;
        c.morph += dt * 0.16;
        c.fade = Math.min(1, c.fade + dt * 0.5);

        const speed = (7 + c.depth * 16 + wind * 190 * c.depth) * (selectedThis ? 0.06 : 1);
        c.x += speed * dt;

        if (selectedThis) {
          c.x += (w * 0.5 - c.width / 2 - c.x) * Math.min(1, dt * 1.4);
          c.y += (h * 0.3 - c.y) * Math.min(1, dt * 1.4);
        }

        if (c.x > w + c.width * 0.6) {
          c.seed = makeCloudSeed(randomSeed());
          c.named = false;
          c.width = (w * 0.13 + Math.random() * w * 0.2) * (0.55 + c.depth * 0.7);
          c.x = -c.width * 1.3;
          c.y = h * (0.05 + Math.random() * 0.68) * (1.05 - c.depth * 0.18);
          c.fade = 0;
        }

        const stretch = 1;
        // a selected cloud is rendered exactly the way the gallery/journal
        // thumbnail will render it, so the saved card matches what you saw
        const key = `${Math.round(c.width)}|${paletteBucket}|${selectedThis ? "sel" : "amb"}`;
        if (key !== c.spriteKey && renderBudget > 0) {
          c.sprite = renderCloudSprite(c.seed, c.width, palette, 0, {
            sunDir,
            stretch,
            detail: selectedThis ? 1 : 0.45 + c.depth * 0.55,
            haze: selectedThis ? 0 : (1 - c.depth) * 0.4,
            hazeColor: palette.mid,
          });
          c.spriteKey = key;
          renderBudget--;
        }
        if (!c.sprite) continue;

        const pad = Math.round(c.width * SPRITE_PAD_RATIO);
        const alpha = selectedThis ? c.fade : c.fade * (0.72 + c.depth * 0.28);
        ctx.globalAlpha = alpha;
        ctx.drawImage(c.sprite, c.x - pad, c.y - pad);

        if (hoverRef.current === c.id || selectedThis) {
          ctx.globalAlpha = alpha * (selectedThis ? 0.16 : 0.1);
          ctx.globalCompositeOperation = "lighter";
          ctx.drawImage(c.sprite, c.x - pad, c.y - pad);
          ctx.globalCompositeOperation = "source-over";
        }
        ctx.globalAlpha = 1;
      }




      // caption floaters
      const floaters = floatersRef.current;
      for (let i = floaters.length - 1; i >= 0; i--) {
        const f = floaters[i]!;
        f.life -= dt;
        f.x += (f.vx + wind * 60) * dt;
        f.y -= dt * 5;
        if (f.life <= 0) {
          floaters.splice(i, 1);
          continue;
        }
        const a = Math.min(1, f.life / 1.4);
        ctx.save();
        ctx.globalAlpha = a;
        ctx.font = `500 ${Math.max(16, w * 0.014)}px "Instrument Serif", Georgia, serif`;
        ctx.textAlign = "center";
        ctx.fillStyle = css(palette.cloudLight, 0.95);
        ctx.shadowColor = css(palette.cloudShadow, 0.6);
        ctx.shadowBlur = 12;
        ctx.fillText(`“${f.text}”`, f.x, f.y);
        ctx.restore();
      }

      drawFilmGrade(w, h);
      ctx.restore();

      // spawn timers
      const timers = spawnTimersRef.current;
      timers.chirp -= dt;
      if (timers.chirp <= 0) {
        timers.chirp = 9 + Math.random() * 20;
        audioRef.current?.chirp();
      }
    };

    raf = requestAnimationFrame(frame);

    const label = window.setInterval(() => {
      setPhase(paletteAt(timeRef.current).name);
      setWindLevel(Math.min(1, windRef.current));
    }, 500);

    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(label);
      window.removeEventListener("resize", resize);
    };
  }, [spawnCloud]);

  useEffect(() => {
    audioRef.current = new SkyAudio();
    return () => {
      audioRef.current?.dispose();
      audioRef.current = null;
    };
  }, []);

  const blow = useCallback((amount: number) => {
    windRef.current = Math.min(1.6, windRef.current + amount);
    setWindLevel(Math.min(1, windRef.current));
    audioRef.current?.setWind(Math.min(1, windRef.current));
  }, []);

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const p = pointerRef.current;
    if (p.down) {
      const dx = x - p.lastX;
      if (dx > 0) blow(Math.min(0.06, dx / 900));
    }
    p.x = x;
    p.y = y;
    p.lastX = x;
    const hit = cloudAt(x, y);
    hoverRef.current = hit ? hit.id : null;
    event.currentTarget.style.cursor = hit ? "pointer" : "default";
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    pointerRef.current.down = true;
    pointerRef.current.lastX = event.clientX - rect.left;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    pointerRef.current.down = false;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const hit = cloudAt(x, y);
    if (hit && selectedRef.current !== hit.id) {
      selectedRef.current = hit.id;
      setSelected({ id: hit.id, seed: hit.seed });
      setCaption("");
    } else if (!hit && selectedRef.current !== null) {
      release(null);
    }
  };

  const toggleSound = async () => {
    const next = !soundOn;
    setSoundOn(next);
    await audioRef.current?.setEnabled(next);
  };

  const skipTime = () => {
    timeRef.current = (timeRef.current + 0.12) % 1;
    setPhase(paletteAt(timeRef.current).name);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected || !caption.trim()) return;
    const text = caption.trim();
    await onSave({ text, seed: selected.seed, skyTime: timeRef.current });
    release(text);
  };

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full touch-none"
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => {
          pointerRef.current.down = false;
          hoverRef.current = null;
        }}
      />

      {selected && (
        <div className="pointer-events-none absolute inset-x-0 bottom-28 flex justify-center px-4 sm:bottom-32">
          <form
            onSubmit={submit}
            className="pointer-events-auto w-full max-w-md rounded-3xl border border-border/60 bg-card/70 p-5 shadow-[0_20px_60px_-24px_rgba(30,41,79,0.6)] backdrop-blur-xl"
          >
            <p className="font-serif text-2xl leading-tight text-foreground">What do you see?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {signedIn
                ? "Say the first thing that comes to mind."
                : "Sign in to keep this sighting in your journal."}
            </p>
            <input
              autoFocus
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              maxLength={120}
              placeholder="a dragon carrying a teapot…"
              className="mt-4 w-full rounded-2xl border border-border/70 bg-background/70 px-4 py-3 text-base text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-ring"
            />
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => release(null)}
                className="rounded-full px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Let it drift
              </button>
              <button
                type="submit"
                disabled={!caption.trim() || saving}
                className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {saving ? "Saving…" : "Keep it"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-center gap-3 p-6">
        <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-border/50 bg-card/60 p-2 pl-3 shadow-lg backdrop-blur-xl">
          <button
            type="button"
            onPointerDown={() => {
              const id = window.setInterval(() => blow(0.09), 60);
              audioRef.current?.gust();
              const stop = () => {
                window.clearInterval(id);
                window.removeEventListener("pointerup", stop);
              };
              window.addEventListener("pointerup", stop);
            }}
            className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-transform active:scale-95"
          >
            <Wind className="size-4" />
            Blow wind
          </button>
          <div className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-muted sm:block">
            <div
              className="h-full rounded-full bg-accent-foreground/70 transition-[width] duration-150"
              style={{ width: `${Math.round(windLevel * 100)}%` }}
            />
          </div>
          <button
            type="button"
            onClick={skipTime}
            title="Move the sun along"
            className="flex items-center gap-2 rounded-full px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <Sun className="size-4" />
            <span className="hidden sm:inline">{phase}</span>
          </button>
          <button
            type="button"
            onClick={toggleSound}
            title={soundOn ? "Mute" : "Turn on sound"}
            className="rounded-full p-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            {soundOn ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

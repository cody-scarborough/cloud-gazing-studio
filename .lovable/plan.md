# Photorealistic sky pass

The current clouds are stacks of blurred ellipses, which reads as cartoonish and — worse for the game — too symmetrical and repetitive. The geese, balloon and plane are hand-drawn vector shapes. This pass replaces both with much more convincing imagery while keeping seed-based reproducibility (so a saved sighting still redraws the exact same cloud in the journal and gallery).

## Clouds: from blobs to noise-sculpted volumes

Keep the seed, throw out the "blurred ellipses" look.

- Each cloud seed grows a random, deliberately lopsided skeleton: a variable number of lobes with uneven weights, a tilted growth axis, occasional detached wisps and a torn edge on one side. No mirrored or evenly spaced shapes.
- The silhouette is then eroded and grown by fractal value noise (several octaves) so edges are cauliflower-like and irregular rather than round — this is what creates the "I can see a dog in that one" complexity.
- Shading uses the noise field as a density map: light scatters from the sun side, the base gets a soft dirty shadow with ambient bounce, and the crowns get bright rim highlights. Thin edges go translucent so sky shows through.
- Cloud types vary by seed: puffy cumulus, flat-bottomed towering cumulus, and thin torn fractus wisps, plus a distant low-detail haze band near the horizon for depth.
- Sprites render once per cloud on an offscreen canvas at device resolution and re-render only occasionally as they morph, so frame rate is unaffected.

## Sky backdrop

- Multi-stop, non-linear gradient with atmospheric scattering falloff, a warmer denser haze near the horizon, and a physically softer sun with layered bloom.
- Very light film grain plus subtle vignette so it reads photographic rather than flat-vector.

## Geese, balloon, plane

These become photoreal art instead of drawn shapes:

- Generate transparent PNG sprite sheets: a goose in several wing positions (silhouetted against bright sky, as they actually appear), a hot air balloon photographed from below/side, and a small airliner.
- Animate the goose flap by cycling frames with per-bird offsets, in a ragged, non-perfect V that drifts and re-forms.
- The balloon drifts with slight pendulum sway and gets tinted by the current time-of-day palette so it belongs in the scene.
- The plane keeps its contrail, but the trail becomes a noise-broken, slowly spreading vapour line rather than dots.

## Technical notes

- New `src/lib/sky/noise.ts` (seeded value/fBm noise) and a rewritten `src/lib/sky/cloud.ts` that renders via pixel-level density compositing on an offscreen canvas.
- `CloudSeed` gains fields (lobe skeleton, noise offsets, cloud type); saved rows keep working through a fallback that treats legacy seeds as the old puff format, so existing journal entries still render.
- Sprite assets live in `src/assets/` and are imported as ES modules; entities draw via `drawImage` in `src/lib/sky/entities.ts`.
- Cost control: cloud sprite regeneration throttled and resolution scaled by cloud size; distant clouds render at lower detail.

## Build order

1. Noise module + new cloud silhouette/shading pipeline, with legacy seed fallback.
2. Sky backdrop upgrade (scattering gradient, sun bloom, haze, grain).
3. Generate goose / balloon / plane sprite assets.
4. Rewire entities to sprite-based drawing and animation, including the new contrail.
5. Verify performance and visual result in the preview at desktop and mobile sizes.

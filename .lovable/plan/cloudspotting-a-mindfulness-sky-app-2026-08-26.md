# Cloudspotting — a mindfulness sky app

A single beautiful sky you can sit under, watch procedurally drifting clouds, and name what you see in them. Sightings are saved to your account and flow into a shared community gallery.

## The experience

**The sky (home page)**
- Full-screen animated sky rendered on canvas: layered gradient backdrop, soft sun glow, subtle haze near the horizon.
- Clouds are generated procedurally (clusters of soft blurred blobs with per-cloud seeds), so no two are alike. They drift slowly left-to-right, slowly morphing and dissolving at the edges.
- Time of day drifts on a slow cycle — noon, afternoon, golden hour, dusk — changing sky colors, cloud tint, and sun position. A small control lets you jump the time if you're impatient.

**Naming a cloud**
- Hover a cloud and it gets a faint outline; click it and it gently centers/pauses.
- A soft prompt appears: "What do you see?" with a text field, and the app records the cloud's shape seed alongside your words.
- On submit, the cloud floats away with your caption trailing under it for a moment, then it's added to your journal.

**Wind**
- A "blow wind" control at the bottom: press and hold (or drag across the sky) to push clouds faster, pull new ones in from the horizon, and reshape existing ones.
- Longer gusts bring denser cloud banks; the sky visibly reacts with speed and stretch.

**Surprises** (rare, randomly timed so they feel like luck)
- A V of geese crossing the sky with faint honking.
- A hot air balloon drifting low and slow.
- A distant plane with a slow-drawing contrail.
- Sound: soft wind bed, occasional birds, balloon burner. Off by default with a clear toggle; wind gusts and surprises are mixed in.

**Journal & gallery**
- Journal: your own sightings, each re-rendered as a small cloud thumbnail from its saved seed, with your words and date.
- Gallery: recent public sightings from everyone, same cloud-from-seed rendering. You can mark a sighting private when you save it.
- Sign in / sign up page with email + password.

## Design direction

Calm and painterly rather than clinical: wide open negative space, no dashboard chrome, controls that fade out while you're watching. Warm off-white and sky-blue palette that shifts with time of day, generous serif display type for prompts paired with a quiet sans for UI, very soft rounded surfaces and blurred glass panels.

## Technical notes

- Enable Lovable Cloud for auth (email/password), the `sightings` table, and the shared gallery.
- `sightings`: id, user_id, text, cloud_seed (jsonb: blob positions/sizes/rotation), sky_time, is_public, created_at. RLS: owners read/write their own rows; anon+authenticated read only `is_public = true`. Explicit grants included in the migration.
- Sky rendering: single `<canvas>` with a requestAnimationFrame loop; clouds are metaball-ish stacks of radial-gradient blobs drawn with blur, parameterized by a seeded RNG so a seed can be replayed as a thumbnail anywhere.
- Wind is a scalar force applied to per-cloud velocity with easing decay; spawning is tied to accumulated gust energy.
- Surprises are sprite-layer entities on independent timers, drawn on the same canvas.
- Audio via Web Audio API, lazily created on first user gesture, muted by default.
- Routes: `/` (sky), `/journal` (auth-gated), `/gallery`, `/auth`. Per-route head metadata.

## Build order

1. Enable Cloud, migration for `sightings`, auth page and session handling.
2. Canvas sky engine: gradients, seeded cloud generation, drift, time-of-day cycle.
3. Cloud selection + "what do you see?" capture, saving to the account.
4. Wind interaction and spawning.
5. Geese, balloon, plane, and the audio layer.
6. Journal and gallery pages with seed-rendered thumbnails.

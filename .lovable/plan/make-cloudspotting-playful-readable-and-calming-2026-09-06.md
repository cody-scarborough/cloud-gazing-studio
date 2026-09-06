# Make Cloudspotting playful, readable, and calming

## Goal
Prioritize the mindfulness game: clouds should look convincingly natural while giving the eye clear, varied shapes to interpret without effort or frustration.

## Cloud design approach
- Replace purely random cloud skeletons with a library of hidden compositional archetypes inspired by animals, faces, objects, and gestures.
- Keep archetypes ambiguous rather than literal: vary orientation, proportions, missing pieces, overlap, and asymmetry so players can discover their own interpretation.
- Build each readable silhouette from a few strong primary masses, then add smaller secondary lobes and wisps that enrich the image without destroying it.
- Apply realistic cloud texture, erosion, lighting, and soft edge detail after the readable silhouette is established. Fine detail will make the form photographic rather than determine the form itself.
- Add stronger variation between successive clouds by avoiding recently used archetype families and cloud profiles, preventing the sky from feeling repetitive.
- Exclude excessively thin streaks, tiny fragments, and visually incoherent shapes from the clouds intended for play.

## Scene readability
- Rebalance placement so most clouds occupy the readable middle and near portions of the sky.
- Raise the minimum apparent size and reserve only a few smaller clouds for atmospheric depth.
- Reduce haze, opacity loss, and flattening enough that distant clouds remain visible while still appearing softer than nearby clouds.
- Preserve natural spacing and depth without letting realism make the game targets faint or difficult to click.

## Gallery and journal
- Keep the saved cloud’s silhouette, detail, lighting, and time-of-day colors consistent with what the player selected.
- Use a quieter thumbnail sky without the prominent sun disc and bloom, so the cloud remains the focal point.

## Interaction boundaries
- Keep wind as movement and cloud arrival only; it will not stretch, reshape, or accelerate the cloud’s morphing.
- Do not show labels or hints about the hidden archetype—the interpretation remains personal.
- Keep saving, selection, authentication, journal, and gallery behavior unchanged.

## Validation
- Review multiple generated skies and confirm each main cloud offers at least one easy visual interpretation while remaining naturally ambiguous.
- Check that consecutive clouds differ meaningfully in silhouette and structure rather than only scale or texture.
- Verify desktop and mobile layouts, clickability, wind behavior, thumbnail matching, cloud contrast across the day cycle, and the reduced prominence of the thumbnail sun.

## Technical details
- Introduce deterministic archetype-guided mass layouts in the existing seeded generator, then pass them through the existing noise-warped density and scattering renderer.
- Track recent archetype families during scene spawning to reduce repetition without changing saved seed compatibility.
- Retain deterministic fallback rendering for previously saved clouds.

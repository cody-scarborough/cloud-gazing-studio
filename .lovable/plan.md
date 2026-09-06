# Improve cloud visibility without losing realism

## Goal
Keep the sky’s depth and natural perspective, but make every cloud large and distinct enough to support the cloud-spotting game.

## Changes
- Rebalance cloud placement away from the horizon so most clouds appear in the readable middle and near portions of the sky.
- Raise the minimum apparent cloud size and narrow the size variation, preventing tiny scraps that cannot suggest recognizable shapes.
- Reserve only a small number of clouds for the far distance, where they provide depth rather than serve as primary game targets.
- Reduce distance haze and opacity loss so far clouds remain visibly separated from the sky while still looking softer than nearby clouds.
- Ease the strongest vertical flattening on distant clouds, retaining perspective without making them look like faint horizontal marks.
- Keep wind behavior, cloud shape generation, selection, saving, and gallery rendering unchanged.

## Validation
- Review the live sky at desktop and the current preview size after several cloud cycles.
- Confirm the scene retains near/mid/far depth, the smallest clouds remain easy to see and click, and distant clouds maintain readable contrast throughout the time-of-day cycle.

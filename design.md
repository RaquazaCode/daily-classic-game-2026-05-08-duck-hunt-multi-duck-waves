# Design

## Concept

- Base game: Duck Hunt
- Twist: multi-duck spawn waves
- Goal: build a deterministic keyboard-only light-gun remix that stays small enough for unattended verification but still feels tense under three-shell pressure.

## System Shape

- The simulation advances in fixed 50 ms steps so gameplay, tests, autoplay, and browser hooks share the same timing rules.
- Each wave spawns one to three ducks with seeded row selection, alternating entry directions, and short bob patterns.
- The player crosshair moves on a discrete grid, which keeps hit tests, replay output, and autoplay logic straightforward.

## Rules And Scoring

- Each wave has three shells and no mid-wave reload.
- If shells hit zero before the wave is cleared, surviving ducks enter flee mode and accelerate toward the edge.
- Six escaped ducks ends the run.
- Clean sweeps award a wave-size bonus plus leftover-shell value, so accurate fast clears matter more than simple survival.

## Proof Strategy

- `window.advanceTime(ms)` drives manual-clock verification.
- `window.render_game_to_text()` exposes wave size, score, accuracy, shells, active ducks, and recent event history.
- Autoplay only uses public game methods, so test and Playwright proofs exercise the same interface a user sees.

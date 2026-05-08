# Implementation Plan

1. Build a deterministic Duck Hunt loop with discrete duck motion, three-shell ammo pressure, escape tracking, scoring, and pause/reset support.
2. Make the twist visible by spawning predictable multi-duck flocks early instead of saving the complexity for deep rounds.
3. Expose browser hooks so autoplay, tests, and Playwright capture all prove the same state transitions.
4. Ship generated GIFs plus JSON proof files for clean-sweep scoring and reset behavior.

# Tasks — Global XP rate knob

## 1. Implementation

- [x] 1.1 Add exported `XP_RATE` constant (value 2) to `progression.ts` with a pacing-knob doc comment
- [x] 1.2 Replace the ad-hoc `EXPERIENCE_MULTIPLIER` edit in `run.ts` with `Math.floor(target.stats.exp * XP_RATE)` and update the adjacent comment
- [x] 1.3 Test: kill XP equals `floor(dataset EXP × XP_RATE)` (e.g. Booma Normal awards 10 with rate 2)
- [x] 1.4 Full `vitest run` green

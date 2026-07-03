---
name: verify
description: Drive the Phantasy Star Idle browser app end-to-end in headless Chromium and capture screenshots as evidence.
---

# Verifying Phantasy Star Idle

Browser app (Vite + Solid UI over a pure engine). Verification = drive the
real app, not the jsdom suites (`tests/ui-smoke.test.ts` is a stand-in, not
the surface).

## Launch

```bash
npx vite --port 5199 --strictPort   # run in background
```

## Drive (no project playwright dep — use the cached headless shell)

A Playwright headless Chromium lives at
`~/.cache/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell`.
Install `playwright-core` in the scratchpad (NOT the repo) and launch with
`chromium.launch({ executablePath })`. Screenshot at each step.

## Flows worth driving

- Boot → select → create (`#new-name`, `#create-sid` derives live) → hub.
- Buy: weapon-shop pane → click a `[data-action="detail"]` row → Buy.
  Pick an affordable offer (rows show `<price>m`; new chars have 300m —
  the first offer often costs more, and the failure line in the dialogue
  window is correct behavior, not a bug).
- Equip: equipment pane → `[data-action="equip-cand"]` → `.diff-table` → Equip.
- Keyboard: digits 1–7 switch panes, arrows move focus/rows, Enter confirms
  (first Enter completes the dialogue reveal).
- Run: Accept Quest → run screen; wait ~4s for enemies/log; reload mid-run
  must land back on the run view.
- Settle: backdate `activeRun.startedAtWall` in the `psi.save` localStorage
  envelope by ~2h, reload → boots to SELECT (per ui-navigation; run no longer
  active), then selecting the character shows the report over the Guild pane.

## Gotchas

- All `[data-action]` attributes are stable selector hooks — use them.
- `innerText` reflects CSS `text-transform: uppercase` on `h3` (e.g.
  "IF EQUIPPED") — compare case-insensitively.
- Each Playwright context has its own localStorage; same-save multi-tab
  tests need `context.newPage()`, not `browser.newPage()`.

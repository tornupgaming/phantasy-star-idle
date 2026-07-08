# Domain glossary

## Enemies

- **Pan Arms** — a fused enemy composed of two halves (Hidoom and Migium).
  One map spawn of Pan Arms represents a single fused enemy, even though
  authentic PSO map data pre-allocates three enemy-list entries for it
  (fused form + both halves).
- **Split** — the moment a fused Pan Arms separates into Hidoom and Migium.
  Triggered when the fused Pan Arms completes its second attack (any attack
  it performs counts — hit, miss, or sidestepped). A split is not a kill:
  it awards no EXP and rolls no drop for the fused form. Both halves are
  engaged in combat immediately on split.
- **Hidoom / Migium** — the two halves of a Pan Arms. Each is a fully
  independent enemy with its own HP, EXP, and drop table. Halves spawn at
  full HP; damage dealt to the fused form does not carry over.
- **Fused form** — Pan Arms before splitting. If killed before its second
  attack, the halves never appear and the fused form's own EXP/drop apply.

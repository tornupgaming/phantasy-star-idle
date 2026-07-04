/**
 * Shopkeeper dialogue data (shop-dialogue spec). Pure data + lookup helpers,
 * no DOM: greetings per hub pane, reaction lines per action outcome, and item
 * flavor text with kind-level fallbacks. Line selection cycles deterministically
 * (caller passes an incrementing index) — no RNG, so the engine's no-ad-hoc-
 * randomness stance never comes near the UI voice.
 */

import type { Item } from "../engine/items";

export type DialoguePane =
  | "guild"
  | "weapon-shop"
  | "armour-shop"
  | "tool-shop"
  | "equipment"
  | "bank";

const GREETINGS: Record<DialoguePane, string[]> = {
  guild: [
    "Welcome to the Hunter's Guild. Which quest will you take?",
    "The Guild has work for you, hunter. Choose your hunting ground.",
    "Back again? The surface isn't getting any safer. Pick a quest.",
  ],
  "weapon-shop": [
    "Welcome to the Weapon Shop! Looking for something with an edge?",
    "Fresh stock from the workshop. See anything you like?",
    "A hunter's only as good as their blade. Take a look around.",
  ],
  "armour-shop": [
    "Welcome to the Armour Shop. Let's keep you in one piece.",
    "Frames, barriers, units — everything a careful hunter needs.",
    "You look like you've taken a few hits. Browse the stock.",
  ],
  "tool-shop": [
    "Welcome to the Tools Shop! Stock up before you head down.",
    "Mates, atomizers, grinders — the essentials. What'll it be?",
    "Never leave Pioneer 2 without a Monomate. Trust me.",
  ],
  equipment: [
    "Let's sort out your loadout. What do you want to change?",
    "Check your gear before every descent — that's the rule.",
  ],
  bank: [
    "Your shared storage, hunter. What do you want to do?",
    "Everything your team has hauled back is right here.",
  ],
};

const REACTIONS = {
  bought: [
    "A fine choice! Anything else?",
    "Sold! Use it well.",
    "Pleasure doing business with you.",
  ],
  sold: [
    "I'll give it a good home. Anything else to sell?",
    "Deal. The meseta's yours.",
  ],
  equipped: [
    "Looking sharp. That should serve you well down there.",
    "Equipped and ready.",
  ],
  removed: ["Stowed away safely.", "Back in storage it goes."],
  grind: ["The grinder bites — your weapon's stronger now.", "Ground and polished. Feel the difference."],
  quest: ["Good hunting, hunter. Come back in one piece.", "Quest accepted. The Guild expects results."],
  filter: ["Loot filter updated. The Guild will handle the rest.", "Noted. We'll sort your spoils accordingly."],
} as const;

export type ReactionId = keyof typeof REACTIONS;

/** In-voice failure lines keyed by fragments of engine failure reasons. */
const FAILURES: Array<[RegExp, string]> = [
  [/meseta/i, "You're a little short on meseta, hunter."],
  [/grinder/i, "No grinders left — the Tools Shop stocks them."],
  [/slot/i, "There's no room for that — check your unit slots."],
  [/frame/i, "You'll need a frame first — units mount on a frame."],
];

export function greeting(pane: DialoguePane, cycle: number): string {
  const pool = GREETINGS[pane];
  return pool[cycle % pool.length];
}

export function reaction(id: ReactionId, cycle: number): string {
  const pool = REACTIONS[id];
  return pool[cycle % pool.length];
}

export function failureLine(reason: string): string {
  for (const [pattern, line] of FAILURES) {
    if (pattern.test(reason)) return `${line} (${reason})`;
  }
  return `Hmm, that won't work: ${reason}`;
}

// ---- Item flavor -----------------------------------------------------------

/** Hand-written lines for known names; falls through to kind-level lines. */
const FLAVOR_BY_NAME: Record<string, string> = {
  Saber: "The standard-issue single-hand blade. Honest, reliable steel.",
  "Hand Blade": "A compact blade favored by rookie hunters on a budget.",
  Brand: "A refined saber with a keener edge than standard issue.",
  Buster: "Heavy for a saber — it lands like it means it.",
  Sword: "A two-handed slab of metal. Subtlety not included.",
  Handgun: "Sidearm of choice for Rangers. Never jams, never complains.",
  Autogun: "A reworked handgun with a hair trigger.",
  Cane: "A channeling rod for Forces. Hums faintly near monsters.",
  Frame: "Basic protective plating. Better than your street clothes.",
  Armor: "Standard hunter armor, scarred by someone else's runs.",
  Barrier: "A compact energy shield emitter. Keeps the claws off.",
  Shield: "A sturdier barrier for hunters who plan on getting hit.",
  Monomate: "Restores a little HP. The taste grows on you. Eventually.",
  Dimate: "Restores a good chunk of HP. Standard field ration.",
  Trimate: "Full-strength recovery in a bottle. Expensive, worth it.",
  "Moon Atomizer": "Revives a fallen hunter. Handle with reverence.",
  Grinder: "Workshop-grade abrasive. Raises a weapon's grind by one.",
};

const FLAVOR_BY_KIND: Record<string, string> = {
  weapon: "A hunter's weapon, tuned for the field.",
  frame: "Protective plating that mounts units.",
  barrier: "An energy shield emitter worn off-hand.",
  unit: "A slot-in module that augments a frame.",
  heal: "A recovery item for use mid-run.",
  revive: "An emergency revival item. Hope you won't need it.",
  grinder: "Workshop-grade abrasive for weapon tuning.",
  tool: "Field supplies with no use here — the shop pays for them.",
  inert: "Standard Pioneer 2 field supply. No system on this ship can use it yet.",
};

export function flavor(name: string, kind: string): string {
  return FLAVOR_BY_NAME[name] ?? FLAVOR_BY_KIND[kind] ?? "Curious gear of unknown provenance.";
}

export function itemFlavor(item: Item): string {
  return flavor(item.name, item.kind);
}

/**
 * Browser entry point. Binds the injected wall clock (`Date.now`) and localStorage
 * to the engine, then mounts the Solid UI and drives a 1 Hz tick: poll the active
 * run (settling it when its timeline is fully played out) and re-sync the UI
 * store. The run advances purely from elapsed time, so it keeps progressing while
 * the tab is unfocused and resumes correctly after a reload (tasks 7.4, 8.x).
 * The battle stage self-updates via requestAnimationFrame while a run is live;
 * this poll stays the settle authority and its sync flips the regime switch when
 * the run ends.
 */

import { Game } from "./engine/game";
import { browserStorage } from "./engine/save";
import { mountApp } from "./ui/app";

const root = document.getElementById("app");
if (!root) throw new Error("#app not found");

const game = Game.loadOrNew(browserStorage(), () => Date.now());

// On load, settle any run that finished while the app was closed, then mount.
game.poll();
const { sync } = mountApp(root, game);

setInterval(() => {
  game.poll();
  sync();
}, 1000);

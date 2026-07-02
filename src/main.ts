/**
 * Browser entry point. Binds the injected wall clock (`Date.now`) and localStorage
 * to the engine, then drives a 1 Hz tick: poll the active run (settling it when its
 * timeline is fully played out) and re-render. The run advances purely from elapsed
 * time, so it keeps progressing while the tab is unfocused and resumes correctly
 * after a reload (tasks 7.4, 8.x).
 */

import { Game } from "./engine/game";
import { browserStorage } from "./engine/save";
import { UI } from "./ui/views";

const root = document.getElementById("app");
if (!root) throw new Error("#app not found");

const game = Game.loadOrNew(browserStorage(), () => Date.now());
const ui = new UI(root, game);

// On load, settle any run that finished while the app was closed, then paint.
game.poll();
ui.render();

setInterval(() => {
  const wasActive = game.state.activeRun !== null;
  const settled = game.poll();
  // The battle stage self-updates via requestAnimationFrame while a run is live
  // (render() is a no-op then); this 1 Hz poll stays the settle authority and
  // triggers the screen swap when the run ends.
  if (game.state.activeRun !== null || settled || wasActive) ui.render();
}, 1000);

/**
 * Shopkeeper dialogue typewriter as a reactive primitive (design D4). The
 * revealed text is a memo over (line, chars); the interval only bumps the
 * chars signal, so the reveal survives any surrounding re-render — the old
 * paintDialogue() re-attachment pass is gone by construction.
 */

import { createMemo, createSignal, onCleanup, type Accessor } from "solid-js";

export interface Typewriter {
  /** The currently visible slice of the line. */
  visible: Accessor<string>;
  /** True when the full line is shown (also true before the first say()). */
  done: Accessor<boolean>;
  /** Start revealing a new line from the beginning. */
  say(line: string): void;
  /** Complete the reveal immediately. */
  skip(): void;
}

const TICK_MS = 24;
const CHARS_PER_TICK = 2;

export function createTypewriter(): Typewriter {
  const [line, setLine] = createSignal("");
  const [chars, setChars] = createSignal(0);
  let timer: ReturnType<typeof setInterval> | null = null;

  const stop = () => {
    if (timer) clearInterval(timer);
    timer = null;
  };

  const say = (l: string) => {
    stop();
    setLine(l);
    setChars(0);
    timer = setInterval(() => {
      setChars((c) => c + CHARS_PER_TICK);
      if (chars() >= line().length) stop();
    }, TICK_MS);
  };

  const skip = () => {
    stop();
    setChars(line().length);
  };

  onCleanup(stop);

  return {
    visible: createMemo(() => line().slice(0, Math.min(chars(), line().length))),
    done: createMemo(() => chars() >= line().length),
    say,
    skip,
  };
}

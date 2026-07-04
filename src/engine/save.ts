/**
 * Persistent save/load layer (task 1.3).
 *
 * A tiny `Storage` port keeps the engine runtime-agnostic (design D10):
 * `localStorage` in the browser, an in-memory map in tests. Saves are versioned
 * and carry a wall-clock `savedAt` timestamp so background/offline resume can
 * compute how much game time elapsed while the app was closed (design D11).
 */

export interface StoragePort {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

/** Wraps the browser `localStorage`. */
export function browserStorage(): StoragePort {
  return {
    get: (k) => window.localStorage.getItem(k),
    set: (k, v) => window.localStorage.setItem(k, v),
    remove: (k) => window.localStorage.removeItem(k),
  };
}

/** In-memory storage for tests / SSR. */
export function memoryStorage(initial?: Record<string, string>): StoragePort {
  const map = new Map<string, string>(Object.entries(initial ?? {}));
  return {
    get: (k) => (map.has(k) ? (map.get(k) as string) : null),
    set: (k, v) => void map.set(k, v),
    remove: (k) => void map.delete(k),
  };
}

export const SAVE_KEY = "psi.save";
export const SAVE_VERSION = 5; // v5: authentic shop inventory (stock shape {level, offers} + tool counter)

export interface SaveEnvelope<T> {
  version: number;
  /** Wall-clock epoch ms at which the state was persisted. */
  savedAt: number;
  state: T;
  /** Set by load() when an older save was migrated; re-persist promptly. */
  migrated?: boolean;
}

/**
 * Migrates an older save's state to the current shape, or returns null when
 * that version cannot be migrated (the save is then treated as unreadable).
 */
export type SaveMigration<T> = (version: number, state: unknown) => T | null;

export class SaveManager<T> {
  constructor(
    private readonly storage: StoragePort,
    private readonly key: string = SAVE_KEY,
  ) {}

  /** Persist state, stamping it with the given wall-clock time. */
  save(state: T, now: number): void {
    const envelope: SaveEnvelope<T> = { version: SAVE_VERSION, savedAt: now, state };
    this.storage.set(this.key, JSON.stringify(envelope));
  }

  /**
   * Load the envelope (state + savedAt), or null if none / unreadable. An
   * older version is passed through `migrate` when given; without a migration
   * (or when it returns null) the mismatched save loads as null, as before.
   */
  load(migrate?: SaveMigration<T>): SaveEnvelope<T> | null {
    const raw = this.storage.get(this.key);
    if (raw == null) return null;
    try {
      const parsed = JSON.parse(raw) as SaveEnvelope<T>;
      if (parsed == null || typeof parsed.version !== "number") return null;
      if (parsed.version === SAVE_VERSION) return parsed;
      if (!migrate) return null;
      const migratedState = migrate(parsed.version, parsed.state);
      if (migratedState == null) return null;
      return { version: SAVE_VERSION, savedAt: parsed.savedAt, state: migratedState, migrated: true };
    } catch {
      return null;
    }
  }

  clear(): void {
    this.storage.remove(this.key);
  }
}

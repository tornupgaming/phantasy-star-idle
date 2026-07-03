/**
 * Hub scene backdrop (hub-scene-backdrop spec): a full-viewport canvas wall of
 * falling teal glyphs (the Guards Shop look) under per-pane tint + motif layers.
 *
 * Ownership: mounted once into a persistent scene layer that hub re-renders
 * never touch, so the animation runs uninterrupted across purchases and pane
 * switches. Pane switches only swap CSS classes on the tint/motif layers —
 * their crossfade is a CSS transition, the canvas itself never remounts.
 *
 * Safeguards: ~12fps cap, pause while document.hidden, and a single static
 * frame under prefers-reduced-motion. Visual randomness comes from a local
 * constant-seeded xorshift — never Math.random — keeping the repo's seeded-RNG
 * stance unambiguous even though this layer needs no determinism.
 */

export type BackdropThemeId =
  | "guild"
  | "weapon-shop"
  | "armour-shop"
  | "tool-shop"
  | "equipment"
  | "bank";

interface Column {
  x: number;
  y: number;
  speed: number;
  glyphs: string[];
}

const GLYPHS = "アイウエオカキクケコサシスセソタチツテト0123456789ABCDEF◇◆<>";
const FRAME_MS = 1000 / 12;
const FONT_PX = 16;

/** Motif silhouettes, one faint landmark shape per location. */
const MOTIFS: Record<BackdropThemeId, string> = {
  guild: `<svg viewBox="0 0 100 100"><path d="M50 8 88 30v40L50 92 12 70V30z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M35 55l15-25 15 25M32 65h36" fill="none" stroke="currentColor" stroke-width="2"/></svg>`,
  "weapon-shop": `<svg viewBox="0 0 100 100"><path d="M22 78 68 22l10-6-6 10L26 82zM78 78 32 22l-10-6 6 10L74 82z" fill="none" stroke="currentColor" stroke-width="2.5"/></svg>`,
  "armour-shop": `<svg viewBox="0 0 100 100"><path d="M50 10 84 24v26c0 22-15 34-34 40-19-6-34-18-34-40V24z" fill="none" stroke="currentColor" stroke-width="2.5"/></svg>`,
  "tool-shop": `<svg viewBox="0 0 100 100"><path d="M42 14h16M46 14v20l22 38a10 10 0 0 1-9 15H41a10 10 0 0 1-9-15l22-38V14" fill="none" stroke="currentColor" stroke-width="2.5"/></svg>`,
  equipment: `<svg viewBox="0 0 100 100"><rect x="24" y="24" width="52" height="52" rx="6" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="M38 24V12M62 24V12M38 88V76M62 88V76M24 38H12M24 62H12M88 38H76M88 62H76" stroke="currentColor" stroke-width="2.5"/></svg>`,
  bank: `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="36" fill="none" stroke="currentColor" stroke-width="2.5"/><circle cx="50" cy="50" r="14" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="M50 14v10M50 76v10M14 50h10M76 50h10" stroke="currentColor" stroke-width="2.5"/></svg>`,
};

/** Glyph-wall density multiplier per theme (columns per viewport width). */
const DENSITY: Record<BackdropThemeId, number> = {
  guild: 1,
  "weapon-shop": 0.8,
  "armour-shop": 0.8,
  "tool-shop": 1.2,
  equipment: 0.7,
  bank: 0.9,
};

/** Constant-seeded xorshift32 — visual-only randomness, deliberately not Math.random. */
function xorshift(seed: number): () => number {
  let s = seed || 0x9e3779b9;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
}

export class Backdrop {
  private canvas: HTMLCanvasElement;
  private tintEl: HTMLDivElement;
  private motifEl: HTMLDivElement;
  private ctx: CanvasRenderingContext2D | null;
  private rand = xorshift(0x50534f42); // "PSOB"
  private columns: Column[] = [];
  private raf = 0;
  private last = 0;
  private running = false;
  private theme: BackdropThemeId = "guild";
  private readonly reducedMotion: boolean;
  private readonly onVisibility = () => {
    if (document.hidden) this.stopLoop();
    else this.startLoop();
  };
  private readonly onResize = () => this.layout();

  constructor(private host: HTMLElement) {
    this.canvas = document.createElement("canvas");
    this.canvas.className = "scene-canvas";
    this.tintEl = document.createElement("div");
    this.tintEl.className = "scene-tint";
    this.motifEl = document.createElement("div");
    this.motifEl.className = "scene-motif";
    host.append(this.canvas, this.tintEl, this.motifEl);
    this.ctx = this.canvas.getContext?.("2d") ?? null;
    this.reducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    document.addEventListener("visibilitychange", this.onVisibility);
    window.addEventListener("resize", this.onResize);
    this.layout();
    this.setTheme(this.theme);
    if (this.reducedMotion) {
      // Static frame: run the simulation a few steps once, then never again.
      for (let i = 0; i < 40; i++) this.step();
    } else {
      this.startLoop();
    }
  }

  setTheme(theme: BackdropThemeId): void {
    this.theme = theme;
    // Tint + motif crossfade via CSS transitions on these class/content swaps.
    this.tintEl.className = `scene-tint theme-${theme}`;
    if (this.motifEl.dataset.theme !== theme) {
      this.motifEl.dataset.theme = theme;
      this.motifEl.innerHTML = MOTIFS[theme];
      this.motifEl.classList.remove("motif-in");
      // Force restart of the fade-in transition on the next frame.
      void this.motifEl.offsetWidth;
      this.motifEl.classList.add("motif-in");
    }
    this.layout();
  }

  destroy(): void {
    this.stopLoop();
    document.removeEventListener("visibilitychange", this.onVisibility);
    window.removeEventListener("resize", this.onResize);
    this.canvas.remove();
    this.tintEl.remove();
    this.motifEl.remove();
  }

  // ---- internals -----------------------------------------------------------

  private layout(): void {
    const w = (this.canvas.width = this.host.clientWidth || window.innerWidth || 1024);
    const h = (this.canvas.height = this.host.clientHeight || window.innerHeight || 768);
    const count = Math.min(120, Math.floor((w / (FONT_PX * 1.6)) * DENSITY[this.theme]));
    this.columns = Array.from({ length: count }, (_, i) => ({
      x: (i + 0.5) * (w / count),
      y: this.rand() * h,
      speed: 30 + this.rand() * 90,
      glyphs: Array.from(
        { length: 4 + Math.floor(this.rand() * 10) },
        () => GLYPHS[Math.floor(this.rand() * GLYPHS.length)],
      ),
    }));
    if (this.ctx) {
      this.ctx.fillStyle = "#04101a";
      this.ctx.fillRect(0, 0, w, h);
    }
  }

  private startLoop(): void {
    if (this.running || this.reducedMotion || !this.ctx) return;
    this.running = true;
    this.last = 0;
    const tick = (t: number) => {
      if (!this.running) return;
      if (t - this.last >= FRAME_MS) {
        this.last = t;
        this.step();
      }
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  private stopLoop(): void {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private step(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const { width: w, height: h } = this.canvas;
    // Translucent wipe leaves fading trails behind the falling glyphs.
    ctx.fillStyle = "rgba(4, 16, 26, 0.22)";
    ctx.fillRect(0, 0, w, h);
    ctx.font = `${FONT_PX}px monospace`;
    for (const col of this.columns) {
      col.y += col.speed / 12;
      if (col.y > h + col.glyphs.length * FONT_PX) {
        col.y = -this.rand() * h * 0.5;
        col.speed = 30 + this.rand() * 90;
      }
      for (let i = 0; i < col.glyphs.length; i++) {
        const y = col.y - i * FONT_PX;
        if (y < -FONT_PX || y > h + FONT_PX) continue;
        // Head glyph bright, tail dimmer; occasional glyph mutation.
        if (this.rand() < 0.02) {
          col.glyphs[i] = GLYPHS[Math.floor(this.rand() * GLYPHS.length)];
        }
        const alpha = i === 0 ? 0.55 : Math.max(0.05, 0.3 - i * 0.03);
        ctx.fillStyle = `rgba(70, 200, 220, ${alpha})`;
        ctx.fillText(col.glyphs[i], col.x, y);
      }
    }
  }
}

// Keyboard input (desktop). Touch and mouse go through Phaser's pointer events in the scenes.

const keys = new Set<string>();
let enabled = true;

export interface KeyHandlers {
  /** Space / E: open the menu for whatever is nearby. */
  interact(): void;
  /** 1–9: pick an option in the open radial menu. */
  choose(index: number): void;
  /** Escape: close the radial menu. */
  cancel(): void;
  guide(): void;
}

let handlers: KeyHandlers | null = null;

const MOVE_KEYS: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  KeyW: [0, -1],
  ArrowDown: [0, 1],
  KeyS: [0, 1],
  ArrowLeft: [-1, 0],
  KeyA: [-1, 0],
  ArrowRight: [1, 0],
  KeyD: [1, 0],
};

export function initKeyboard(): void {
  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement) return;
    if (MOVE_KEYS[e.code]) {
      keys.add(e.code);
      e.preventDefault();
      return;
    }
    if (e.repeat || !enabled || !handlers) return;
    if (e.code === 'Space' || e.code === 'KeyE' || e.code === 'Enter') {
      if (document.activeElement instanceof HTMLButtonElement) return;
      e.preventDefault();
      handlers.interact();
    } else if (/^Digit[1-9]$/.test(e.code)) {
      handlers.choose(Number(e.code.slice(5)) - 1);
    } else if (e.code === 'Escape') {
      handlers.cancel();
    } else if (e.code === 'KeyG') {
      handlers.guide();
    }
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());
}

export function setKeyHandlers(h: KeyHandlers | null): void {
  handlers = h;
}

/** Freeze movement and actions while an overlay (guide, summary) is open. */
export function setInputEnabled(on: boolean): void {
  enabled = on;
  if (!on) keys.clear();
}

export function isInputEnabled(): boolean {
  return enabled;
}

/** Keyboard movement vector with length 0..1. */
export function keyVector(): { x: number; y: number } {
  if (!enabled) return { x: 0, y: 0 };
  let x = 0;
  let y = 0;
  for (const k of keys) {
    const d = MOVE_KEYS[k];
    if (d) {
      x += d[0];
      y += d[1];
    }
  }
  const len = Math.hypot(x, y);
  return len > 1 ? { x: x / len, y: y / len } : { x, y };
}

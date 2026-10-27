// Merges the touch joystick and keyboard into one movement vector + action presses.

const keys = new Set<string>();
const stick = { x: 0, y: 0 };
let actionHandler: (() => void) | null = null;
let guideHandler: (() => void) | null = null;
let enabled = true;

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
    } else if ((e.code === 'Space' || e.code === 'KeyE' || e.code === 'Enter') && !e.repeat) {
      // Let Enter/Space activate focused overlay buttons instead.
      if (document.activeElement instanceof HTMLButtonElement && document.activeElement.closest('.overlay')) return;
      e.preventDefault();
      if (enabled) actionHandler?.();
    } else if (e.code === 'KeyG' && !e.repeat) {
      guideHandler?.();
    }
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());
}

export function setStick(x: number, y: number): void {
  stick.x = x;
  stick.y = y;
}

export function onAction(fn: () => void): void {
  actionHandler = fn;
}

export function onGuideKey(fn: () => void): void {
  guideHandler = fn;
}

export function triggerAction(): void {
  if (enabled) actionHandler?.();
}

/** Freeze movement and actions while an overlay (guide, summary) is open. */
export function setInputEnabled(on: boolean): void {
  enabled = on;
  if (!on) {
    keys.clear();
    stick.x = stick.y = 0;
  }
}

export function isInputEnabled(): boolean {
  return enabled;
}

/** Movement vector with length 0..1. */
export function moveVector(): { x: number; y: number } {
  if (!enabled) return { x: 0, y: 0 };
  let x = stick.x;
  let y = stick.y;
  for (const k of keys) {
    const d = MOVE_KEYS[k];
    if (d) {
      x += d[0];
      y += d[1];
    }
  }
  const len = Math.hypot(x, y);
  if (len > 1) {
    x /= len;
    y /= len;
  }
  return { x, y };
}

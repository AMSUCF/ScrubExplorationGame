// Radial action menu: a ring of icon buttons that floats over whatever was tapped.
import { ICON } from '../data/icons';
import { Action } from '../systems/actions';
import { services } from '../services';

const BUTTON = 58;
const RADIUS = 62;

export class RadialMenu {
  private root: HTMLElement;
  private actions: Action[] = [];
  private onPick: ((a: Action) => void) | null = null;
  private key = '';
  private extent = 80;
  open = false;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'radial';
    this.root.hidden = true;
    parent.appendChild(this.root);
    this.root.addEventListener('pointerdown', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-i]');
      e.stopPropagation();
      e.preventDefault();
      if (!btn) return;
      this.pick(Number(btn.dataset.i));
    });
  }

  show(actions: Action[], onPick: (a: Action) => void): void {
    this.onPick = onPick;
    this.open = true;
    this.root.hidden = false;
    this.setActions(actions);
  }

  /** Refresh buttons in place (after an action changed what's possible). */
  setActions(actions: Action[]): void {
    this.actions = actions;
    const key = actions.map((a) => `${a.verb}${a.param}${a.enabled}${a.block}${a.cost}`).join('|');
    if (key === this.key) return;
    this.key = key;
    const n = actions.length;
    // Fan the buttons out in an arc above the target; wrap to a full ring when there are many.
    const ARC = [0, 0, Math.PI * 0.5, Math.PI * 0.7, Math.PI * 0.9];
    const ring = n > 4;
    const span = ring ? Math.PI * 2 : ARC[n];
    const start = -Math.PI / 2 - (ring ? 0 : span / 2);
    const radius = n <= 1 ? 0 : ring ? RADIUS + (n - 4) * 6 : RADIUS + 2 + n * 4;
    const lift = ring ? 0 : 40;
    this.extent = radius + BUTTON / 2 + 8;
    this.root.innerHTML = actions
      .map((a, i) => {
        const ang = ring ? start + (span * i) / n : start + (span * i) / Math.max(1, n - 1);
        const x = Math.cos(ang) * radius - BUTTON / 2;
        const y = Math.sin(ang) * radius - BUTTON / 2 - lift;
        const img = a.tex ? `<img class="tex" src="${services.icon(a.tex)}" alt="" />` : '';
        const main = a.tex ? `<span class="verb">${a.icon}</span>` : `<span class="emoji">${a.icon}</span>`;
        const cost = a.parts
          ? `<span class="cost">${ICON.parts}${a.parts}</span>`
          : a.cost > 0
            ? `<span class="cost">${ICON.battery}${a.cost}</span>`
            : '';
        const block = a.enabled
          ? ''
          : a.blockTex
            ? `<img class="block tex-block" src="${services.icon(a.blockTex)}" alt="" />`
            : `<span class="block">${a.block ?? ''}</span>`;
        return `<button class="rbtn${a.enabled ? '' : ' off'}" data-i="${i}" style="transform: translate(${x}px, ${y}px); transition-delay: ${i * 25}ms"
          aria-label="${a.label}" title="${a.label}">${img}${main}${cost}${block}<span class="kbd">${i + 1}</span></button>`;
      })
      .join('');
    requestAnimationFrame(() => this.root.classList.add('in'));
  }

  /** Keep the ring over its target (screen pixels in CSS units). */
  moveTo(x: number, y: number): void {
    const m = this.extent;
    const cx = Math.max(m, Math.min(window.innerWidth - m, x));
    const cy = Math.max(m + 60, Math.min(window.innerHeight - m + 40, y));
    this.root.style.transform = `translate(${cx}px, ${cy}px)`;
  }

  pick(i: number): void {
    const a = this.actions[i];
    if (!a) return;
    if (!a.enabled) {
      const btn = this.root.querySelector<HTMLElement>(`[data-i="${i}"]`);
      btn?.classList.remove('shake');
      void btn?.offsetWidth;
      btn?.classList.add('shake');
      return;
    }
    this.onPick?.(a);
  }

  hide(): void {
    this.open = false;
    this.key = '';
    this.root.classList.remove('in');
    this.root.hidden = true;
    this.root.innerHTML = '';
    this.actions = [];
  }
}

// A stable, labelled action tray. World targets stay visible instead of hiding behind a ring.
import { audio } from '../audio';
import { ICON } from '../data/icons';
import { Action } from '../systems/actions';
import { services } from '../services';
import { renderIcons } from './icons';

const safe = (s: string) => s.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);
const blocked = (a: Action): string => {
  if (a.blockTex) return 'A wildlife milestone is needed first.';
  const reasons: Record<string, string> = { [ICON.battery]: 'Recharge at your pod.', [ICON.bag]: 'Make room in your bag at the recycler.', [ICON.sad]: 'Free the nearby native habitat first.', [ICON.wait]: 'Come back after the next morning.', [ICON.done]: 'Done for today.', [ICON.parts]: 'Gather more recycled parts.', [ICON.lock]: 'Help more wildlife return first.', [ICON.question]: 'Collect native seeds or sprigs first.', [ICON.crate]: 'Drop off the animal you are carrying.', [ICON.jar]: 'Drop off your jar at the wildlife pad.', [ICON.bang]: 'Choose open sand outside the clearing.' };
  return reasons[a.block ?? ''] ?? 'Not quite ready yet.';
};

export class RadialMenu {
  private root: HTMLElement;
  private actions: Action[] = [];
  private onPick: ((a: Action) => void) | null = null;
  private onClose: (() => void) | null = null;
  private context = { name: '', detail: '' };
  private key = '';
  open = false;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'radial action-dock';
    this.root.hidden = true;
    parent.appendChild(this.root);
    const activate = (e: Event) => {
      const button = (e.target as Element).closest<HTMLElement>('button');
      if (!button) return;
      e.stopPropagation(); e.preventDefault();
      if (button.hasAttribute('data-close-action')) { this.onClose?.(); return; }
      if (button.dataset.i !== undefined) this.pick(Number(button.dataset.i));
    };
    this.root.addEventListener('pointerdown', activate);
    // Keyboard activation produces a zero-detail click; pointer input already runs on pointerdown.
    this.root.addEventListener('click', e => { if (e.detail === 0) activate(e); });
  }

  show(actions: Action[], onPick: (a: Action) => void, context = this.context, onClose?: () => void): void {
    this.onPick = onPick; this.onClose = onClose ?? this.onClose; this.context = context;
    this.open = true; this.root.hidden = false;
    this.setActions(actions);
  }

  setActions(actions: Action[]): void {
    this.actions = actions;
    const key = `${this.context.name}|${this.context.detail}|` + actions.map(a => `${a.verb}${a.param}${a.enabled}${a.block}${a.cost}${a.parts}`).join('|');
    if (key === this.key) return;
    this.key = key;
    this.root.innerHTML = renderIcons(`<section class="action-panel" aria-label="Actions for ${safe(this.context.name)}">
      <header><div><h2>${safe(this.context.name)}</h2><p>${safe(this.context.detail)}</p></div><button class="action-close" data-close-action aria-label="Dismiss actions">${ICON.close}</button></header>
      <div class="action-options">${actions.map((a, i) => {
        const icon = a.tex ? `<img class="tex" src="${services.icon(a.tex)}" alt=""/><span class="verb">${a.icon}</span>` : `<span class="emoji">${a.icon}</span>`;
        const cost = a.parts !== undefined ? `${ICON.parts} ${a.parts} parts` : a.cost ? `${ICON.battery} ${a.cost} energy` : 'No energy';
        return `<button class="rbtn${a.enabled ? '' : ' off'}" data-i="${i}" aria-label="${safe(a.label)}" aria-disabled="${!a.enabled}" title="${safe(a.enabled ? a.label : blocked(a))}"><span class="action-art">${icon}</span><span class="action-label">${safe(a.label)}</span><span class="action-cost">${a.enabled ? cost : safe(blocked(a))}</span><span class="kbd">${i + 1}</span></button>`;
      }).join('')}</div><p class="action-hint" role="status"></p></section>`);
    requestAnimationFrame(() => this.root.classList.add('in'));
  }

  // Retain the scene API; the labelled tray stays anchored safely above the screen edge.
  moveTo(_x: number, _y: number): void {}

  pick(i: number): void {
    const action = this.actions[i];
    if (!action) return;
    if (!action.enabled) {
      audio.sfx('nope');
      this.root.querySelector<HTMLElement>('.action-hint')!.textContent = blocked(action);
      return;
    }
    this.onPick?.(action);
  }

  hide(): void { this.open = false; this.root.hidden = true; this.root.classList.remove('in'); this.key = ''; }
  destroy(): void { this.root.remove(); }
}

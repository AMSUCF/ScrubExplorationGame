// Heads-up display: battery, day, zone health, inventory, toasts and the big context button.
import { BAG_CAPACITY, JAR_CAPACITY } from '../config';
import { ZONE_NAME, ZoneId } from '../data/map';
import { SEED_NOUN, speciesName } from '../data/species';
import { Action } from '../systems/actions';
import { batteryFraction } from '../systems/battery';
import { GameState, NATIVE_PLANTS } from '../systems/state';
import { triggerAction } from './input';
import { createJoystick } from './joystick';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, parent?: HTMLElement): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  parent?.appendChild(node);
  return node;
}

export interface HudCallbacks {
  onGuide(): void;
  onCycleSeed(): void;
  onMenu(): void;
}

export class Hud {
  private root: HTMLElement;
  private batteryFill: HTMLElement;
  private batteryText: HTMLElement;
  private dayText: HTMLElement;
  private zoneName: HTMLElement;
  private zoneFill: HTMLElement;
  private zoneWrap: HTMLElement;
  private inventory: HTMLElement;
  private toasts: HTMLElement;
  private actionBtn: HTMLButtonElement;
  private actionLabel: HTMLElement;
  private actionDetail: HTMLElement;
  private actionHint: HTMLElement;
  private guideBadge: HTMLElement;
  private cache = new Map<string, string>();

  constructor(parent: HTMLElement, cb: HudCallbacks) {
    this.root = el('div', 'hud', parent);

    const joy = el('div', 'joy-zone', this.root);
    createJoystick(joy);

    const top = el('div', 'topbar', this.root);
    const status = el('div', 'status panel', top);
    const battery = el('div', 'battery', status);
    battery.setAttribute('aria-label', 'Battery');
    this.batteryFill = el('div', 'battery-fill', battery);
    this.batteryText = el('span', 'battery-text', battery);
    this.dayText = el('div', 'day', status);

    this.zoneWrap = el('div', 'zone panel', top);
    this.zoneName = el('div', 'zone-name', this.zoneWrap);
    const zb = el('div', 'zone-bar', this.zoneWrap);
    this.zoneFill = el('div', 'zone-fill', zb);

    const buttons = el('div', 'buttons', top);
    const guide = el('button', 'icon-btn', buttons);
    guide.innerHTML = '<span aria-hidden="true">📖</span>';
    guide.title = 'Field guide (G)';
    guide.setAttribute('aria-label', 'Field guide');
    this.guideBadge = el('span', 'badge', guide);
    guide.addEventListener('click', cb.onGuide);
    const menu = el('button', 'icon-btn', buttons);
    menu.innerHTML = '<span aria-hidden="true">☰</span>';
    menu.title = 'Menu';
    menu.setAttribute('aria-label', 'Menu');
    menu.addEventListener('click', cb.onMenu);

    this.inventory = el('div', 'inventory', this.root);
    this.inventory.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('[data-chip="seeds"]')) cb.onCycleSeed();
    });

    this.toasts = el('div', 'toasts', this.root);

    const actionWrap = el('div', 'action-wrap', this.root);
    this.actionHint = el('div', 'action-hint', actionWrap);
    this.actionBtn = el('button', 'action-btn', actionWrap);
    this.actionLabel = el('span', 'action-label', this.actionBtn);
    this.actionDetail = el('span', 'action-detail', this.actionBtn);
    this.actionBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      triggerAction();
    });
  }

  private set(key: string, value: string, apply: () => void) {
    if (this.cache.get(key) === value) return;
    this.cache.set(key, value);
    apply();
  }

  update(state: GameState, action: Action | null, zone: ZoneId, health: number | null, guideNew: number): void {
    const frac = batteryFraction(state);
    const pct = Math.round(state.battery);
    this.set('battery', `${pct}/${state.batteryMax}`, () => {
      this.batteryFill.style.width = `${frac * 100}%`;
      this.batteryFill.dataset.level = frac < 0.2 ? 'low' : frac < 0.45 ? 'mid' : 'high';
      this.batteryText.textContent = `🔋 ${pct}`;
    });
    this.set('day', String(state.day), () => (this.dayText.textContent = `Day ${state.day}`));

    this.set('zone', `${zone}:${health}`, () => {
      this.zoneName.textContent = ZONE_NAME[zone] + (health === null ? '' : ` · ${health}%`);
      this.zoneWrap.classList.toggle('no-bar', health === null);
      this.zoneFill.style.width = `${health ?? 0}%`;
    });

    this.set('guide', String(guideNew), () => {
      this.guideBadge.textContent = guideNew > 0 ? String(guideNew) : '';
      this.guideBadge.hidden = guideNew === 0;
    });

    const chips: string[] = [];
    const seedTotal = NATIVE_PLANTS.reduce((n, p) => n + state.seeds[p], 0);
    if (seedTotal > 0) {
      const sel = state.seeds[state.selectedSeed] > 0 ? state.selectedSeed : NATIVE_PLANTS.find((p) => state.seeds[p] > 0)!;
      const kinds = NATIVE_PLANTS.filter((p) => state.seeds[p] > 0).length;
      chips.push(
        `<button class="chip" data-chip="seeds" title="Tap to choose which seed to sow">🌰 ${state.seeds[sel]} ${SEED_NOUN[sel]}${state.seeds[sel] > 1 ? 's' : ''}${kinds > 1 ? ' ⇄' : ''}</button>`,
      );
    }
    for (const p of NATIVE_PLANTS) {
      if (state.seedlings[p] > 0) chips.push(`<span class="chip">🌱 ${state.seedlings[p]} ${speciesName(p).toLowerCase()}</span>`);
    }
    chips.push(`<span class="chip${state.bag >= BAG_CAPACITY ? ' full' : ''}">🗑️ ${state.bag}/${BAG_CAPACITY}</span>`);
    if (state.jar > 0) chips.push(`<span class="chip${state.jar >= JAR_CAPACITY ? ' full' : ''}">🫙 ${state.jar}</span>`);
    if (state.crate) chips.push(`<span class="chip">📦 ${state.crate.name ?? speciesName(state.crate.species)}</span>`);
    chips.push(`<span class="chip">⚙️ ${state.parts}</span>`);
    const inv = chips.join('');
    this.set('inv', inv, () => (this.inventory.innerHTML = inv));

    const label = action ? `${action.label}|${action.detail}|${action.enabled}|${action.reason ?? ''}|${action.cost}` : 'none';
    this.set('action', label, () => {
      this.actionBtn.classList.toggle('disabled', !action || !action.enabled);
      this.actionBtn.classList.toggle('empty', !action);
      this.actionLabel.textContent = action ? action.label : '···';
      this.actionDetail.textContent = action ? action.detail : '';
      const hint = action && !action.enabled ? action.reason ?? '' : action && action.cost > 0 ? `−${action.cost} 🔋` : '';
      this.actionHint.textContent = hint;
      this.actionHint.hidden = !hint;
    });
  }

  toast(message: string, kind: 'info' | 'good' | 'warn' = 'info'): void {
    const t = el('div', `toast ${kind}`, this.toasts);
    t.textContent = message;
    while (this.toasts.children.length > 3) this.toasts.firstElementChild?.remove();
    setTimeout(() => t.classList.add('out'), 3800);
    setTimeout(() => t.remove(), 4400);
  }

  setVisible(on: boolean): void {
    this.root.classList.toggle('hidden', !on);
  }
}

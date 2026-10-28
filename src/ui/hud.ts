// Wordless heads-up display: battery, day, zone health, and an icon inventory.
import { audio } from '../audio';
import { BAG_CAPACITY, JAR_CAPACITY } from '../config';
import { ICON } from '../data/icons';
import { ZONE_NAME, ZoneId } from '../data/map';
import { batteryFraction } from '../systems/battery';
import { GameState, NATIVE_PLANTS } from '../systems/state';
import { services } from '../services';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, parent?: HTMLElement): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  parent?.appendChild(node);
  return node;
}

/** Each zone is shown by its signature plant instead of a name. */
const ZONE_ICON: Record<ZoneId, string> = { base: 'pod0', sand: 'palmetto', oak: 'oak', rosemary: 'rosemary' };

export interface HudCallbacks {
  onGuide(): void;
  onMenu(): void;
}

export class Hud {
  private root: HTMLElement;
  private batteryFill: HTMLElement;
  private batteryText: HTMLElement;
  private dayText: HTMLElement;
  private zoneIcon: HTMLImageElement;
  private zoneFill: HTMLElement;
  private zoneWrap: HTMLElement;
  private inventory: HTMLElement;
  private guideBadge: HTMLElement;
  private cache = new Map<string, string>();
  readonly layer: HTMLElement;

  constructor(parent: HTMLElement, cb: HudCallbacks) {
    this.root = el('div', 'hud', parent);

    const top = el('div', 'topbar', this.root);
    const status = el('div', 'status panel', top);
    const battery = el('div', 'battery', status);
    battery.setAttribute('role', 'meter');
    battery.setAttribute('aria-label', 'Battery');
    this.batteryFill = el('div', 'battery-fill', battery);
    this.batteryText = el('span', 'battery-text', battery);
    this.dayText = el('div', 'day', status);

    this.zoneWrap = el('div', 'zone panel', top);
    this.zoneIcon = el('img', 'zone-icon', this.zoneWrap);
    this.zoneIcon.alt = '';
    const zb = el('div', 'zone-bar', this.zoneWrap);
    this.zoneFill = el('div', 'zone-fill', zb);

    const buttons = el('div', 'buttons', top);
    const guide = el('button', 'icon-btn', buttons);
    guide.innerHTML = `<span aria-hidden="true">${ICON.info}</span>`;
    guide.title = 'Field guide (G)';
    guide.setAttribute('aria-label', 'Field guide');
    this.guideBadge = el('span', 'badge', guide);
    guide.addEventListener('click', cb.onGuide);
    const sound = el('button', 'icon-btn', buttons);
    sound.setAttribute('aria-label', 'Sound');
    const paintSound = () => {
      const on = audio.musicOn || audio.sfxOn;
      sound.innerHTML = `<span aria-hidden="true">${on ? '🔊' : '🔇'}</span>`;
      sound.setAttribute('aria-pressed', String(on));
    };
    paintSound();
    audio.onChange(paintSound);
    sound.addEventListener('click', () => {
      audio.unlock();
      audio.toggleAll();
    });
    const menu = el('button', 'icon-btn', buttons);
    menu.innerHTML = '<span aria-hidden="true">☰</span>';
    menu.title = 'Menu';
    menu.setAttribute('aria-label', 'Menu');
    menu.addEventListener('click', cb.onMenu);

    this.inventory = el('div', 'inventory', this.root);
    // Layer for things that float over the canvas (radial menu).
    this.layer = el('div', 'float-layer', this.root);
  }

  private set(key: string, value: string, apply: () => void) {
    if (this.cache.get(key) === value) return;
    this.cache.set(key, value);
    apply();
  }

  update(state: GameState, zone: ZoneId | null, health: number | null, guideNew: number): void {
    const frac = batteryFraction(state);
    const pct = Math.round(state.battery);
    this.set('battery', `${pct}/${state.batteryMax}`, () => {
      this.batteryFill.style.width = `${frac * 100}%`;
      this.batteryFill.dataset.level = frac < 0.2 ? 'low' : frac < 0.45 ? 'mid' : 'high';
      this.batteryText.textContent = `${ICON.battery} ${pct}`;
    });
    this.set('day', String(state.day), () => (this.dayText.textContent = `${ICON.day} ${state.day}`));

    this.set('zone', `${zone}:${health}`, () => {
      this.zoneWrap.hidden = zone === null;
      if (!zone) return;
      this.zoneIcon.src = services.icon(ZONE_ICON[zone]);
      this.zoneWrap.title = ZONE_NAME[zone];
      this.zoneWrap.classList.toggle('no-bar', health === null);
      this.zoneFill.style.width = `${health ?? 0}%`;
      this.zoneFill.dataset.level = (health ?? 0) >= 65 ? 'good' : (health ?? 0) >= 35 ? 'mid' : 'low';
    });

    this.set('guide', String(guideNew), () => {
      this.guideBadge.textContent = guideNew > 0 ? String(guideNew) : '';
      this.guideBadge.hidden = guideNew === 0;
    });

    const chip = (inner: string, cls = '') => `<span class="chip${cls}">${inner}</span>`;
    const img = (key: string) => `<img src="${services.icon(key)}" alt="" />`;
    const chips: string[] = [];
    for (const p of NATIVE_PLANTS) if (state.seeds[p] > 0) chips.push(chip(`${img(p)}${ICON.seeds}${state.seeds[p]}`));
    for (const p of NATIVE_PLANTS) if (state.seedlings[p] > 0) chips.push(chip(`${img(p)}${ICON.plant}${state.seedlings[p]}`, ' seedling'));
    for (const p of NATIVE_PLANTS) if (state.sprigs[p] > 0) chips.push(chip(`${img(`sprig_${p}`)}${state.sprigs[p]}`));
    chips.push(chip(`${ICON.bag}${state.bag}/${BAG_CAPACITY}`, state.bag >= BAG_CAPACITY ? ' full' : ''));
    if (state.jar > 0) chips.push(chip(`${ICON.jar}${state.jar}`, state.jar >= JAR_CAPACITY ? ' full' : ''));
    if (state.crate) chips.push(chip(`${ICON.crate}${img(state.crate.species)}`));
    chips.push(chip(`${ICON.parts}${state.parts}`));
    const inv = chips.join('');
    this.set('inv', inv, () => (this.inventory.innerHTML = inv));
  }

  setVisible(on: boolean): void {
    this.root.classList.toggle('hidden', !on);
  }
}

// Wordless heads-up display: battery, day, zone health, and an icon inventory.
import { audio } from '../audio';
import { BAG_CAPACITY, JAR_CAPACITY } from '../config';
import { ICON } from '../data/icons';
import { ZONE_NAME, ZoneId } from '../data/map';
import { batteryFraction } from '../systems/battery';
import { GameState, NATIVE_PLANTS } from '../systems/state';
import { services } from '../services';
import { renderIcons } from './icons';

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
  private zoneName: HTMLElement;
  private zoneHealth: HTMLElement;
  private message: HTMLElement;
  private work: HTMLElement;
  private hint: HTMLElement;
  private toastTimer: number | null = null;
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
    const caption = el('div', 'zone-caption', this.zoneWrap);
    this.zoneName = el('span', 'zone-name', caption);
    this.zoneHealth = el('span', 'zone-health', caption);
    const zb = el('div', 'zone-bar', this.zoneWrap);
    this.zoneFill = el('div', 'zone-fill', zb);

    const buttons = el('div', 'buttons', top);
    const guide = el('button', 'icon-btn', buttons);
    guide.innerHTML = renderIcons(`${ICON.info}<small>Guide</small>`);
    guide.title = 'Field guide (G)';
    guide.setAttribute('aria-label', 'Field guide');
    this.guideBadge = el('span', 'badge', guide);
    guide.addEventListener('click', cb.onGuide);
    const sound = el('button', 'icon-btn', buttons);
    sound.setAttribute('aria-label', 'Sound');
    const paintSound = () => {
      const on = audio.musicOn || audio.sfxOn;
      sound.innerHTML = renderIcons(`${on ? ICON.sound : ICON.mute}<small>Sound</small>`);
      sound.setAttribute('aria-pressed', String(on));
    };
    paintSound();
    audio.onChange(paintSound);
    sound.addEventListener('click', () => {
      audio.unlock();
      audio.toggleAll();
    });
    const menu = el('button', 'icon-btn', buttons);
    menu.innerHTML = renderIcons(`${ICON.menu}<small>Pause</small>`);
    menu.title = 'Menu';
    menu.setAttribute('aria-label', 'Menu');
    menu.addEventListener('click', cb.onMenu);

    this.inventory = el('div', 'inventory', this.root);
    this.hint = el('div', 'journey-hint', this.root);
    this.message = el('div', 'world-message', this.root);
    this.message.setAttribute('role', 'status');
    this.message.hidden = true;
    this.work = el('div', 'work-progress', this.root);
    this.work.hidden = true;
    // Layer for things that float over the canvas (radial menu).
    this.layer = el('div', 'float-layer', this.root);
  }

  private set(key: string, value: string, apply: () => void) {
    if (this.cache.get(key) === value) return;
    this.cache.set(key, value);
    apply();
  }

  update(state: GameState, zone: ZoneId | null, health: number | null, guideNew: number): void {
    this.root.classList.toggle('inside-home', state.location === 'home');
    const frac = batteryFraction(state);
    const pct = Math.round(state.battery);
    this.set('battery', `${pct}/${state.batteryMax}`, () => {
      this.batteryFill.style.width = `${frac * 100}%`;
      this.batteryFill.dataset.level = frac < 0.2 ? 'low' : frac < 0.45 ? 'mid' : 'high';
      this.batteryText.innerHTML = renderIcons(`${ICON.battery} ${pct}<small>energy</small>`);
      this.batteryFill.parentElement?.setAttribute('aria-valuenow', String(pct));
      this.batteryFill.parentElement?.setAttribute('aria-valuemax', String(state.batteryMax));
      this.batteryFill.parentElement?.setAttribute('aria-valuemin', '0');
    });
    this.set('day', String(state.day), () => (this.dayText.innerHTML = renderIcons(`${ICON.day} Day ${state.day}`)));

    this.set('zone', `${zone}:${health}:${state.location}`, () => {
      this.zoneWrap.hidden = zone === null;
      if (!zone) return;
      this.zoneIcon.src = services.icon(ZONE_ICON[zone]);
      this.zoneWrap.title = ZONE_NAME[zone];
      this.zoneName.textContent = zone === 'base' && state.location === 'home' ? 'Inside the pod' : ZONE_NAME[zone];
      this.zoneHealth.textContent = health === null ? 'A place to grow' : `${health}% restored`;
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
    chips.push(chip(`${ICON.bag} Bag ${state.bag}/${BAG_CAPACITY}`, state.bag >= BAG_CAPACITY ? ' full' : ''));
    if (state.jar > 0) chips.push(chip(`${ICON.jar}${state.jar}`, state.jar >= JAR_CAPACITY ? ' full' : ''));
    if (state.crate) chips.push(chip(`${ICON.crate}${img(state.crate.species)}`));
    chips.push(chip(`${ICON.parts} Parts ${state.parts}`));
    const inv = chips.join('');
    this.set('inv', inv, () => (this.inventory.innerHTML = renderIcons(inv)));
    const hint = state.location === 'home' ? '' : !state.scanned.includes('cogon') ? 'Start small: tap the white-plumed grass, then Scan.' : state.entities.some(e => e.kind === 'invasivePlant' && e.tx === 31 && e.ty === 28 && e.species === 'airpotato') ? 'A little rescue: free the vine-covered oak northeast of home.' : state.stats.planted === 0 ? 'Healthy natives offer seeds. Grow them in the pod’s nursery.' : 'A healthier scrub brings new neighbors. Say hello when they arrive.';
    this.set('hint', hint, () => { this.hint.textContent = hint; this.hint.hidden = !hint; });
  }

  toast(text: string): void {
    if (this.toastTimer !== null) window.clearTimeout(this.toastTimer);
    this.message.textContent = text; this.message.hidden = false;
    this.toastTimer = window.setTimeout(() => { this.message.hidden = true; this.toastTimer = null; }, 5500);
  }

  setWork(text: string | null, duration = 0): void {
    this.work.hidden = text === null;
    if (text === null) return;
    this.work.style.setProperty('--work-duration', `${duration}ms`);
    this.work.innerHTML = renderIcons(`<span>${text}</span><div><i></i></div>`);
  }

  setVisible(on: boolean): void {
    this.root.classList.toggle('hidden', !on);
  }
}

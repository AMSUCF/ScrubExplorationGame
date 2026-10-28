// Wordless heads-up display: battery, day, zone health, and an icon inventory.
import { audio } from '../audio';
import { BAG_CAPACITY, JAR_CAPACITY } from '../config';
import { ICON } from '../data/icons';
import { ZONE_NAME, ZoneId } from '../data/map';
import { batteryFraction } from '../systems/battery';
import { SEASON_NAME, calendar } from '../systems/calendar';
import { levelProgress } from '../systems/progress';
import { WEATHER } from '../systems/weather';
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
  private levelText: HTMLElement;
  private levelFill: HTMLElement;
  private tasks: HTMLElement;
  private tasksOpen = false;
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
    const level = el('div', 'level', status);
    this.levelText = el('span', 'level-text', level);
    const bar = el('div', 'level-bar', level);
    this.levelFill = el('i', '', bar);

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
    this.inventory.addEventListener('click', (e) => {
      if (!(e.target as Element).closest('[data-tasks]')) return;
      this.tasksOpen = !this.tasksOpen;
      this.cache.delete('tasks');
      audio.sfx('page');
    });
    this.tasks = el('div', 'today-list', this.root);
    this.tasks.hidden = true;
    this.hint = el('div', 'journey-hint', this.root);
    this.message = el('div', 'world-message', this.root);
    this.message.setAttribute('role', 'status');
    this.message.hidden = true;
    this.work = el('div', 'work-progress', this.root);
    this.work.hidden = true;
    // Layer for things that float over the canvas (radial menu).
    this.layer = el('div', 'float-layer', this.root);
    window.addEventListener('resize', () => this.layout());
  }

  private set(key: string, value: string, apply: () => void) {
    if (this.cache.get(key) === value) return;
    this.cache.set(key, value);
    apply();
    // Reading layout forces a reflow, so only re-measure when a row's size can change.
    if (key !== 'battery' && key !== 'guide') this.layout();
  }

  /** Stack the inventory, hint and goals list under the topbar, which grows on small screens. */
  private layout(): void {
    const top = this.root.querySelector<HTMLElement>('.topbar');
    if (!top) return;
    const below = top.offsetTop + top.offsetHeight + 6;
    this.root.style.setProperty('--below-topbar', `${below}px`);
    this.root.style.setProperty('--below-inventory', `${below + this.inventory.offsetHeight + 8}px`);
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
    const cal = calendar(state.day);
    const sky = WEATHER[state.weather.kind];
    this.set('day', `${state.day}:${state.weather.kind}`, () => {
      this.dayText.innerHTML = renderIcons(`<span title="${SEASON_NAME[cal.season]}">${ICON[cal.season]}</span> Day ${state.day} <span class="sky" title="${sky.name}">${sky.icon}</span>`);
      this.dayText.setAttribute('aria-label', `${SEASON_NAME[cal.season]}, year ${cal.year}, day ${state.day}. ${sky.name}.`);
    });
    const lv = levelProgress(state);
    this.set('level', `${state.level}:${state.xp}`, () => {
      this.levelText.innerHTML = renderIcons(`${ICON.level} Lv ${lv.level} <small>${lv.title}</small>`);
      this.levelFill.style.width = `${Math.min(100, (lv.into / Math.max(1, lv.need)) * 100)}%`;
    });

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
    if (state.fires.length || state.water < state.waterMax) chips.push(chip(`${ICON.tank} ${state.water}/${state.waterMax}`, state.water === 0 ? ' full' : ''));
    if (state.fires.length && state.location === 'outside') chips.push(chip(`${ICON.fire} Fire · ${state.fires.length}`, ' alert'));
    const goals = state.tasks ?? [];
    if (goals.length) chips.push(`<button class="chip today${goals.every((t) => t.done) ? ' done' : ''}" data-tasks aria-expanded="${this.tasksOpen}" aria-label="Today’s goals">${ICON.task} Today ${goals.filter((t) => t.done).length}/${goals.length}</button>`);
    const inv = chips.join('');
    this.set('inv', inv, () => (this.inventory.innerHTML = renderIcons(inv)));
    const list = goals.map((t) => `<li class="${t.done ? 'done' : ''}">${t.done ? ICON.done : t.icon}<span>${t.label}</span><small>${t.done ? 'Done!' : `${t.progress}/${t.goal} · +${t.reward} parts`}</small></li>`).join('');
    this.set('tasks', `${this.tasksOpen}:${list}`, () => {
      this.tasks.hidden = !this.tasksOpen || !goals.length;
      this.tasks.innerHTML = renderIcons(`<h3>Today’s little list</h3><ul>${list}</ul>`);
    });
    const hint = state.location === 'home' ? '' : state.fires.length ? 'A fire is burning. Tap the flames: contain it, or let it renew old scrub.' : !state.scanned.includes('cogon') ? 'Start small: tap the white-plumed grass, then Scan.' : state.entities.some(e => e.kind === 'invasivePlant' && e.tx === 31 && e.ty === 28 && e.species === 'airpotato') ? 'A little rescue: free the vine-covered oak northeast of home.' : state.stats.planted === 0 ? 'Healthy natives offer seeds. Grow them in the pod’s nursery.' : 'A healthier scrub brings new neighbors. Say hello when they arrive.';
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

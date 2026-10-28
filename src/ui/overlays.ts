// Modal cards. Everything is pictures and numbers except the field guide, which is the robot's
// reference book and keeps its written facts.
import { ICON } from '../data/icons';
import { CATEGORY_LABEL, Category, GUIDE, GUIDE_BY_ID, GuideEntry, NativeAnimalId, SpeciesId, speciesName } from '../data/species';
import { NightSummary } from '../systems/dayCycle';
import { zoneHealth } from '../systems/habitat';
import { NATIVE_ANIMALS, speciesNeeds, trend } from '../systems/population';
import { GameState, Postcard } from '../systems/state';
import type { LevelUp } from '../systems/progress';
import { audio } from '../audio';
import { services } from '../services';
import { setInputEnabled } from './input';
import { renderIcons } from './icons';
import { MAP_H, MAP_W } from '../config';
import { ZONE_NAME } from '../data/map';
import { SEASON_NAME, SEASON_NOTE, calendar } from '../systems/calendar';
import { FIRE_STATE_INFO, FireState, fireState, tileIndex, zoneFire, zoneOf } from '../systems/fire';
import { incursionPressure } from '../systems/incursion';
import { levelProgress } from '../systems/progress';
import { WEATHER } from '../systems/weather';

export type IconSource = (key: string) => string;

let openCount = 0;
const icon: IconSource = (key) => services.icon(key);

export function overlay(className: string, html: string): { root: HTMLElement; close: () => void } {
  const root = document.createElement('div');
  root.className = `overlay ${className}`;
  root.innerHTML = `<div class="card" role="dialog" aria-modal="true" aria-label="${className === 'title' ? 'Scrub Bot' : className}">${renderIcons(html)}</div>`;
  root.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const buttons = [...root.querySelectorAll<HTMLElement>('button:not([disabled]), [tabindex="0"]')].filter((b) => !b.closest('[hidden]'));
    const first = buttons[0], last = buttons[buttons.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
  });
  document.body.appendChild(root);
  root.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('button')) audio.sfx('click');
  });
  openCount++;
  setInputEnabled(false);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    root.classList.add('out');
    setTimeout(() => root.remove(), 180);
    openCount--;
    if (openCount === 0) setInputEnabled(true);
  };
  requestAnimationFrame(() => root.classList.add('in'));
  return { root, close };
}

export function isOverlayOpen(): boolean {
  return openCount > 0;
}

function escape(s: string): string {
  return s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);
}

function focusFirst(root: HTMLElement) {
  root.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
}

function onEscape(root: HTMLElement, close: () => void) {
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });
}

const img = (key: string, cls = '') => `<img class="${cls}" src="${icon(key)}" alt="" />`;

/** Wordless confirm: the first tap arms the button (it wiggles and shows ❗), the second commits. */
function armable(btn: HTMLElement): boolean {
  if (btn.classList.contains('armed')) return true;
  btn.classList.add('armed');
  setTimeout(() => btn.classList.remove('armed'), 2500);
  return false;
}

// --- title ------------------------------------------------------------------------------

export function showTitle(hasSave: boolean): Promise<'continue' | 'new'> {
  return new Promise((resolve) => {
    const { root, close } = overlay(
      'title',
      `<img class="title-landscape" src="${import.meta.env.BASE_URL}art/splash.webp" alt="A gentle little robot plants a seedling beside a gopher tortoise, with a scrub-jay and a cozy pod cottage in the Florida scrub." />
       <div class="title-wash" aria-hidden="true"></div>
       <header class="title-header"><span class="title-brand">${ICON.plant}<span>A Florida scrub story</span></span>
         <div class="title-controls"><button class="icon-btn title-sound" data-act="sound" aria-label="Sound" aria-pressed="${audio.musicOn || audio.sfxOn}">${audio.musicOn || audio.sfxOn ? ICON.sound : ICON.mute}</button></div>
       </header>
       <main class="title-copy">
         <p class="title-kicker">Small acts. Wild wonders.</p>
         <h1>Scrub<span>Bot<span class="title-leaf" aria-hidden="true">${ICON.plant}</span></span></h1>
         <p class="title-description">A little kindness.<br> A place to grow.</p>
         <div class="title-actions">
           <button class="primary title-start" data-act="${hasSave ? 'continue' : 'new'}" aria-label="${hasSave ? 'Continue' : 'Start'}">${ICON.play}<span>${hasSave ? 'Keep growing' : 'Let’s grow'}</span><svg class="title-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19L19 5M6 5H19V18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg></button>
           ${hasSave ? `<button class="title-new" data-act="new" aria-label="New game">${ICON.sparkle}<span>A fresh beginning</span></button>` : ''}
           <p class="title-save" aria-live="polite">${ICON.done} Your little world saves as you go</p>
         </div>
       </main>
       <footer class="title-footer"><span>Take your time. Nature does.</span><span class="title-habitat">${ICON.day} Made for curious hearts</span></footer>
       <div class="title-motes" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>`,
    );
    root.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
      const act = btn?.dataset.act;
      if (act === 'sound') {
        audio.unlock();
        audio.toggleAll();
        const on = audio.musicOn || audio.sfxOn;
        btn!.innerHTML = renderIcons(on ? ICON.sound : ICON.mute);
        btn!.setAttribute('aria-pressed', String(on));
        return;
      }
      if (act === 'new' && hasSave && !armable(btn!)) {
        root.querySelector('.title-save')!.textContent = 'Start fresh? Tap once more to begin again.';
        setTimeout(() => {
          if (!root.isConnected) return;
          root.querySelector('.title-save')!.innerHTML = renderIcons(`${ICON.done} Your little world saves as you go`);
        }, 2500);
        return;
      }
      if (act === 'continue' || act === 'new') {
        close();
        resolve(act);
      }
    });
    root.querySelector<HTMLButtonElement>('.title-start')?.focus({ preventScroll: true });
  });
}

// --- field guide (text) ------------------------------------------------------------------

export function showDiscovery(id: SpeciesId): Promise<void> {
  const g = GUIDE_BY_ID[id];
  audio.sfx('discovery', { delay: 0.2 });
  return new Promise((resolve) => {
    const { root, close } = overlay(
      'discovery',
      `<div class="eyebrow">${ICON.sparkle} ${CATEGORY_LABEL[g.category]}</div>
       <img class="hero" src="${icon(id)}" alt="" />
       <h2>${escape(g.name)}</h2>
       ${g.sci ? `<div class="sci">${escape(g.sci)}</div>` : ''}
       <p>${escape(g.facts[0])}</p>
       <p class="helped">${escape(g.helped)}</p>
       <button class="primary big-icon" data-close aria-label="Close">✔</button>`,
    );
    const done = () => {
      close();
      resolve();
    };
    root.querySelector('[data-close]')!.addEventListener('click', done);
    onEscape(root, done);
    focusFirst(root);
  });
}

const CATEGORY_ORDER: Category[] = ['nativeAnimal', 'nativePlant', 'burrowGuest', 'invasivePlant', 'invasiveAnimal', 'hazard', 'scrubForce'];

export function showFieldGuide(state: GameState, openId?: SpeciesId): Promise<void> {
  audio.sfx('page');
  return new Promise((resolve) => {
    const found = GUIDE.filter((g) => state.scanned.includes(g.id)).length;
    const sections = CATEGORY_ORDER.map((cat) => {
      const items = GUIDE.filter((g) => g.category === cat)
        .map((g) => {
          const known = state.scanned.includes(g.id);
          return `<button class="entry${known ? '' : ' unknown'}" data-id="${g.id}" aria-label="${known ? escape(g.name) : 'Unknown'}">
            <img src="${icon(g.id)}" alt="" /><span>${known ? escape(g.name) : '?'}</span></button>`;
        })
        .join('');
      return `<h3>${CATEGORY_LABEL[cat]}</h3><div class="grid">${items}</div>`;
    }).join('');
    const { root, close } = overlay(
      'guide',
      `<div class="guide-head"><h2>${ICON.info} Field guide</h2><span class="count">${found}/${GUIDE.length}</span>
         <button class="icon-btn" data-close aria-label="Close">✕</button></div>
       <div class="guide-body">${sections}</div>
       <div class="detail" hidden></div>`,
    );
    const detail = root.querySelector<HTMLElement>('.detail')!;
    const body = root.querySelector<HTMLElement>('.guide-body')!;
    const openDetail = (id: SpeciesId) => {
      detail.innerHTML = renderIcons(renderDetail(GUIDE_BY_ID[id], state));
      detail.hidden = false;
      body.hidden = true;
    };
    const done = () => {
      close();
      resolve();
    };
    root.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-close]')) return done();
      if (target.closest('[data-back]')) {
        detail.hidden = true;
        body.hidden = false;
        return;
      }
      const id = target.closest<HTMLElement>('.entry')?.dataset.id as SpeciesId | undefined;
      if (id) openDetail(id);
    });
    if (openId) openDetail(openId);
    onEscape(root, done);
    focusFirst(root);
  });
}

function renderDetail(g: GuideEntry, state: GameState): string {
  const known = state.scanned.includes(g.id);
  let body: string;
  if (known) {
    body = `<h2>${escape(g.name)}</h2>${g.sci ? `<div class="sci">${escape(g.sci)}</div>` : ''}
       <ul>${g.facts.map((f) => `<li>${escape(f)}</li>`).join('')}</ul>
       <p class="helped">${escape(g.helped)}</p>`;
  } else if (g.category === 'nativeAnimal') {
    body = `<h2>?</h2>${needsRow(state, g.id as NativeAnimalId, true)}`;
  } else if (g.hint) {
    body = `<h2>?</h2><p class="helped">${escape(g.hint)}</p>`;
  } else {
    body = `<h2>?</h2><p class="pict">${ICON.scan}</p>`;
  }
  return `<button class="back" data-back aria-label="Back">←</button>
    <img class="hero${known ? '' : ' unknown'}" src="${icon(g.id)}" alt="" />${body}`;
}

// --- wildlife pictograms --------------------------------------------------------------------

/** Picture row of what a species still needs (or a heart if it's content). */
function needsRow(state: GameState, species: NativeAnimalId, arrivalOnly = false): string {
  const needs = speciesNeeds(state, species).filter((n) => !n.met && (!arrivalOnly || n.forArrival));
  if (needs.length === 0) return `<span class="needs ok">${ICON.heart} ${arrivalOnly ? 'This habitat is ready for a new neighbor.' : 'Everything this neighbor needs is here.'}</span>`;
  const seen = new Set<string>();
  return `<span class="needs">${needs
    .filter((n) => !seen.has(n.label) && seen.add(n.label))
    .map((n) => `<span class="need">${img(n.icon)}<span>${escape(n.label)}</span></span>`)
    .join('')}</span>`;
}

function sparkline(state: GameState, species: NativeAnimalId): string {
  const pts = state.history.map((h) => h.pop[species] ?? 0);
  if (pts.length < 2) return '<svg class="spark" viewBox="0 0 80 24"></svg>';
  const max = Math.max(1, ...pts);
  const step = 80 / (pts.length - 1);
  const coords = pts.map((p, i) => `${(i * step).toFixed(1)},${(22 - (p / max) * 20).toFixed(1)}`).join(' ');
  return `<svg class="spark" viewBox="0 0 80 24" aria-hidden="true">
    <polyline points="0,22 ${coords} 80,22" class="area" />
    <polyline points="${coords}" class="line" /></svg>`;
}

function postcardHtml(p: Postcard): string {
  const mark =
    p.kind === 'adopted' ? `${ICON.enter}${ICON.heart}` : p.kind === 'anoles' ? `×${p.count} ${ICON.lab}` : ICON.truck;
  return `<div class="postcard-pic" title="${p.name ?? speciesName(p.species)}">
    ${img(p.species, 'pc-animal')}<span class="pc-mark">${mark}</span><span class="pc-day">${ICON.day}${p.day}</span></div>`;
}

export function showMorning(summary: NightSummary, state: GameState): Promise<void> {
  return new Promise((resolve) => {
    const tiles: string[] = [];
    for (const sp of summary.arrived) tiles.push(`<div class="tile star">${img(sp)}<span>${ICON.star}</span><small>Welcome home,<br>${escape(speciesName(sp))}!</small></div>`);
    for (const p of summary.pops) {
      if (p.arrived) continue;
      tiles.push(`<div class="tile">${img(p.species)}<span>${p.to > p.from ? ICON.up : ICON.down}${p.to}</span><small>${p.to > p.from ? 'A growing family' : 'Needs a little care'}</small></div>`);
    }
    const f = summary.fire;
    if (f) {
      tiles.push(`<div class="tile fire">${img('ui_fire')}<span>${f.renewed}</span><small>Patches of scrub renewed by fire</small></div>`);
      if (f.thickets) tiles.push(`<div class="tile">${img('thicket')}<span>−${f.thickets}</span><small>Thickets opened by fire</small></div>`);
      if (f.lost) tiles.push(`<div class="tile warn">${img('resprout')}<span>−${f.lost}</span><small>Young plants lost: it burned too soon</small></div>`);
    }
    if (summary.sprouts.natives) tiles.push(`<div class="tile star">${img('rosemary')}<span>+${summary.sprouts.natives}</span><small>Rosemary sprouted in the fresh ash</small></div>`);
    if (summary.sprouts.invasives) tiles.push(`<div class="tile warn">${img('cogon')}<span>+${summary.sprouts.invasives}</span><small>Old roots sprouted again</small></div>`);
    if (summary.ready > 0) tiles.push(`<div class="tile">${img('hydro_ready_wet')}<span>×${summary.ready}</span><small>Ready to pot up</small></div>`);
    else if (summary.grew > 0) tiles.push(`<div class="tile">${img('hydro_sprout_wet')}<span>${ICON.up}</span><small>Your seeds are growing</small></div>`);
    if (summary.unwatered > 0) tiles.push(`<div class="tile warn">${img('hydro_sown_dry')}<span>${ICON.water}${ICON.bang}</span><small>Water these each day</small></div>`);
    if (summary.soaked > 0) tiles.push(`<div class="tile">${img('ui_rain')}<span>${ICON.up}${summary.soaked}</span><small>Rain helped your plantings grow</small></div>`);
    if (summary.spread > 0) tiles.push(`<div class="tile warn">${img('cogon')}<span>+${summary.spread}</span><small>Cogon crept outward</small></div>`);
    // Newcomers from beyond the edge, grouped by kind.
    const arrivals = new Map<string, number>();
    for (const a of summary.arrivals) arrivals.set(a.species, (arrivals.get(a.species) ?? 0) + 1);
    for (const [sp, n] of arrivals) tiles.push(`<div class="tile edge">${img(sp)}<span>+${n}</span><small>Blew in from the edge</small></div>`);
    if (summary.thickets) tiles.push(`<div class="tile warn">${img('thicket')}<span>+${summary.thickets}</span><small>Overdue for fire: thickets creep in</small></div>`);

    const w = WEATHER[summary.weather.kind], tomorrow = WEATHER[summary.forecast];
    const cal = calendar(summary.day);
    const season = summary.season
      ? `<div class="season-banner"><b>${ICON[summary.season]} ${SEASON_NAME[summary.season]}${cal.dayOfSeason === 1 && cal.season === 'spring' ? `, year ${cal.year}` : ''}</b>${escape(SEASON_NOTE[summary.season])}</div>`
      : '';
    const win = summary.wonTonight
      ? `<div class="win">🌅 ${NATIVE_ANIMALS.map((a) => img(a)).join('')} ${ICON.heart}<p>Everyone is home! But the edges never rest. Keep caring for your scrub.</p></div>`
      : '';
    const goals = summary.tasks.length
      ? `<div class="goals"><h3>${ICON.task} Today’s little list</h3><ul>${summary.tasks.map((t) => `<li>${t.icon} ${escape(t.label)} <small>(+${t.reward} parts)</small></li>`).join('')}</ul></div>`
      : '';
    const lv = levelProgress(state);
    const quiet = tiles.length === 0 && summary.postcards.length === 0 ? `<p class="pict">🌙 ${ICON.sparkle}</p>` : '';
    const { root, close } = overlay(
      'morning',
      `<div class="morning-heading">Good morning, little helper.</div><div class="sunrise">${ICON[cal.season]}<b>Day ${summary.day}</b></div>
       <div class="forecast"><span>${w.icon} ${escape(w.name)}: ${escape(w.note)}</span><span>Tomorrow ${tomorrow.icon} ${escape(tomorrow.name)}</span></div>
       ${season}
       ${win}
       <div class="tiles">${tiles.join('')}</div>
       ${quiet}
       <div class="postcards">${summary.postcards.map(postcardHtml).join('')}</div>
       ${goals}
       <div class="level-line">${ICON.level} Level ${lv.level} · ${escape(lv.title)} · ${lv.into}/${lv.need} care points</div>
       <div class="mini-health">${(['sand', 'oak', 'rosemary'] as const)
         .map((z) => `<span>${img(z === 'sand' ? 'palmetto' : z)}<i style="width:${zoneHealth(state, z)}%"></i></span>`)
         .join('')}</div>
       <button class="primary" data-close aria-label="Start the day">▶ Start the day</button>`,
    );
    const done = () => {
      close();
      resolve();
    };
    root.querySelector('[data-close]')!.addEventListener('click', done);
    focusFirst(root);
  });
}

const FIRE_COLORS: Record<FireState | 'base' | 'burning', string> = { recovering: '#3f5f4a', young: '#6f9a6a', ready: '#d9b45a', overdue: '#d9734f', base: '#9a8f74', burning: '#ff5a2a' };

/** A small map of the scrub coloured by time since fire. */
function fireMap(state: GameState): string {
  const step = 2, cols = Math.floor((MAP_W - 2) / step), rows = Math.floor((MAP_H - 2) / step);
  const cells: string[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tx = 1 + c * step, ty = 1 + r * step;
      if (zoneOf(tx, ty) === 'base') { cells.push('<i class="base"></i>'); continue; }
      const burning = state.fires.some((f) => Math.abs(f.tx - tx - 0.5) <= 1 && Math.abs(f.ty - ty - 0.5) <= 1);
      const age = state.day - state.burned[tileIndex(tx, ty)];
      cells.push(`<i class="${burning ? 'burning' : fireState(age)}"></i>`);
    }
  }
  const legend = (['recovering', 'young', 'ready', 'overdue'] as FireState[]).map((k) => `<span style="--c:${FIRE_COLORS[k]}">${FIRE_STATE_INFO[k].name}</span>`).join('');
  return `<div class="fire-map" style="--cols:${cols};--ratio:${cols}/${rows}" role="img" aria-label="Map of the scrub coloured by time since fire">${cells.join('')}</div><div class="fire-legend">${legend}</div>`;
}

export function showMonitor(state: GameState): Promise<void> {
  return new Promise((resolve) => {
    const rows = NATIVE_ANIMALS.map((sp) => {
      const pop = state.populations[sp] ?? 0;
      const back = pop > 0;
      const t = trend(state, sp);
      const arrow = t > 0 ? ICON.up : t < 0 ? ICON.down : '';
      return `<div class="mon-row${back ? '' : ' away'}">${img(sp, back ? 'mon-animal' : 'mon-animal unknown')}
        <div class="mon-details"><div class="mon-identity"><h3>${escape(speciesName(sp))}</h3><b class="mon-pop">${back ? `${pop} ${pop === 1 ? 'neighbor' : 'neighbors'} ${arrow}` : 'Not home yet'}</b><span>${back ? `${state.sightings[sp] ?? 0} sightings` : 'How to welcome them'}</span></div>
        ${needsRow(state, sp, !back)}${back ? sparkline(state, sp) : ''}</div></div>`;
    }).join('');
    const zones = (['sand', 'oak', 'rosemary'] as const)
      .map((z) => {
        const h = zoneHealth(state, z);
        const fire = zoneFire(state, z);
        return `<div class="mon-zone">${img(z === 'sand' ? 'palmetto' : z)}<span>${ZONE_NAME[z]}</span><span class="bar"><i style="width:${h}%"></i></span><b>${h}% restored</b><span class="fire-state">${ICON.fire} Typically burned ${fire.age} days ago · ${FIRE_STATE_INFO[fire.state].name}${fire.overdue > 0.15 ? ` · ${Math.round(fire.overdue * 100)}% overdue` : ''}</span></div>`;
      })
      .join('');
    const pressure = incursionPressure(state);
    const lv = levelProgress(state);
    const s = state.stats;
    const { root, close } = overlay(
      'monitor',
      `<div class="screen">
         <div class="monitor-heading"><div><div class="eyebrow">Home is a healthier habitat</div><h2>Our little neighbors</h2><p>Day ${state.day} · Meet their needs to help them return.</p></div>
           <button class="icon-btn" data-close aria-label="Close">✕</button></div>
         ${rows}
         <div class="mon-zones">${zones}</div>
         <div class="mon-stats">
           <span>${img('cogon')}${s.invasivesRemoved}<small class="stat-label">cleared</small></span><span>${ICON.bag}${s.trashCollected}<small class="stat-label">trash gathered</small></span>
           <span>${ICON.plant}${s.planted}<small class="stat-label">planted</small></span><span>${ICON.truck}${s.relocated}<small class="stat-label">relocated</small></span>
         </div>
         <div class="mon-fire"><h3>${ICON.fire} Fire history</h3><p>Scrub needs fire about every 20 days here, but not much sooner. Burn the gold and orange ground; protect the green.</p>${fireMap(state)}</div>
         <div class="mon-edge"><h3>${ICON.edge} Edge watch</h3><p>Seeds, pets and litter keep arriving from roads and yards: ${s.arrivals ?? 0} so far. Tonight’s pressure is ${pressure > 3.5 ? 'very high (storm!)' : pressure > 2.2 ? 'high' : pressure > 1.4 ? 'moderate' : 'low'}. Healthy natives planted near the edge help hold the line.</p></div>
         <div class="mon-progress"><span>${ICON.level} Level ${lv.level} · ${escape(lv.title)}</span><span>${ICON.camera} ${Object.keys(state.portraits ?? {}).length}/4 portraits</span><span>${ICON.scope} ${state.guests.length}/3 burrow neighbors</span><span>${ICON.info} ${state.scanned.length}/${GUIDE.length} in the guide</span><span>${ICON.fire} ${s.burned ?? 0} patches renewed · ${s.contained ?? 0} fires contained</span></div>
       </div>`,
    );
    const done = () => {
      close();
      resolve();
    };
    root.querySelector('[data-close]')!.addEventListener('click', done);
    onEscape(root, done);
    focusFirst(root);
  });
}

export function showBoard(state: GameState): Promise<void> {
  return new Promise((resolve) => {
    const photos = state.photos
      .map((p) => `<div class="polaroid">${img(p.species)}<span>${ICON.day}${p.day}</span></div>`)
      .join('');
    const cards = [...state.postcards].reverse().map(postcardHtml).join('');
    const portraits = NATIVE_ANIMALS.filter((sp) => state.portraits?.[sp])
      .map((sp, i) => `<div class="portrait" style="--tilt:${(i % 2 ? 1 : -1) * 3}deg">${img(sp)}<span class="mg-stars">${'★'.repeat(state.portraits[sp] ?? 0)}</span></div>`)
      .join('');
    const guests = (['frog', 'beetle', 'cricket'] as const)
      .map((g) => `<div class="guest${state.guests.includes(g) ? '' : ' unknown'}">${img(g)}<span>${state.guests.includes(g) ? escape(speciesName(g)) : '?'}</span></div>`)
      .join('');
    const extras = `${portraits ? `<div class="board-section"><h3>${ICON.camera} Portraits</h3><div class="portraits">${portraits}</div></div>` : ''}
      ${state.guests.length ? `<div class="board-section"><h3>${ICON.scope} Burrow neighbors</h3><div class="guests">${guests}</div></div>` : ''}`;
    const empty = !photos && !cards && !portraits ? `<p class="pict">${ICON.board} ${ICON.question}</p>` : '';
    const { root, close } = overlay(
      'board',
      `<div class="cork">
         <button class="icon-btn close-corner" data-close aria-label="Close">✕</button>
         <div class="photos">${photos}</div>
         <div class="postcards">${cards}</div>
         ${extras}
         ${empty}
       </div>`,
    );
    const done = () => {
      close();
      resolve();
    };
    root.querySelector('[data-close]')!.addEventListener('click', done);
    onEscape(root, done);
    focusFirst(root);
  });
}

export function showMenu(state: GameState): Promise<'resume' | 'new'> {
  return new Promise((resolve) => {
    const s = state.stats;
    const { root, close } = overlay(
      'menu',
      `<h2>A little breather</h2>
       <div class="mon-stats">
         <span>${img('cogon')}${s.invasivesRemoved}</span><span>${ICON.bag}${s.trashCollected}</span>
         <span>${ICON.plant}${s.planted}</span><span>${ICON.truck}${s.relocated}</span>
         <span>${ICON.postcard}${state.postcards.length}</span>
       </div>
       <div class="row">
         <button class="primary big-icon" data-act="resume" aria-label="Resume">▶<span class="menu-label">Keep exploring</span></button>
         <button class="big-icon toggle${audio.musicOn ? '' : ' muted'}" data-act="music" aria-label="Music" aria-pressed="${audio.musicOn}">🎵<span class="menu-label">Music</span></button>
         <button class="big-icon toggle${audio.sfxOn ? '' : ' muted'}" data-act="sfx" aria-label="Sound effects" aria-pressed="${audio.sfxOn}">🔔<span class="menu-label">Sounds</span></button>
         ${document.fullscreenEnabled ? '<button class="big-icon" data-act="full" aria-label="Fullscreen">⛶</button>' : ''}
         <button class="big-icon" data-act="new" aria-label="New game">✦<span class="menu-label">Start fresh</span></button>
       </div>`,
    );
    root.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
      const act = btn?.dataset.act;
      if (act === 'music' || act === 'sfx') {
        if (act === 'music') audio.toggleMusic();
        else audio.toggleSfx();
        const on = act === 'music' ? audio.musicOn : audio.sfxOn;
        btn!.classList.toggle('muted', !on);
        btn!.setAttribute('aria-pressed', String(on));
        return;
      }
      if (act === 'full') {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen?.().catch(() => undefined);
        return;
      }
      if (act === 'new' && !armable(btn!)) return;
      if (act === 'resume' || act === 'new') {
        close();
        resolve(act);
      }
    });
    onEscape(root, () => {
      close();
      resolve('resume');
    });
    focusFirst(root);
  });
}

/** A new stewardship level: its title and whatever new tool or perk came with it. */
export function showLevelUp(ups: LevelUp[]): Promise<void> {
  const top = ups[ups.length - 1];
  const unlocks = ups.flatMap((u) => u.unlocks);
  audio.sfx('levelUp');
  return new Promise((resolve) => {
    const { root, close } = overlay(
      'levelup',
      `<div class="eyebrow">${ICON.level} Stewardship level</div>
       <div class="lv-badge">${top.level}</div>
       <h2>${escape(top.title)}</h2>
       <p>The scrub is a little wilder, and a little safer, because of you.</p>
       ${unlocks.length ? `<div class="lv-unlocks">${unlocks.map((u) => `<div class="lv-unlock">${u.icon}<div><b>${escape(u.name)}</b><small>${escape(u.note)}</small></div></div>`).join('')}</div>` : ''}
       <button class="primary" data-close aria-label="Wonderful">${ICON.done} Wonderful</button>`,
    );
    const done = () => {
      close();
      resolve();
    };
    root.querySelector('[data-close]')!.addEventListener('click', done);
    onEscape(root, done);
    focusFirst(root);
  });
}

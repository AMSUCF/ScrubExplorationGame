// Modal cards. Everything is pictures and numbers except the field guide, which is the robot's
// reference book and keeps its written facts.
import { ICON } from '../data/icons';
import { CATEGORY_LABEL, Category, GUIDE, GUIDE_BY_ID, GuideEntry, NativeAnimalId, SpeciesId, speciesName } from '../data/species';
import { NightSummary } from '../systems/dayCycle';
import { zoneHealth } from '../systems/habitat';
import { NATIVE_ANIMALS, speciesNeeds, trend } from '../systems/population';
import { GameState, Postcard } from '../systems/state';
import { services } from '../services';
import { setInputEnabled } from './input';

export type IconSource = (key: string) => string;

let openCount = 0;
const icon: IconSource = (key) => services.icon(key);

function overlay(className: string, html: string): { root: HTMLElement; close: () => void } {
  const root = document.createElement('div');
  root.className = `overlay ${className}`;
  root.innerHTML = `<div class="card" role="dialog" aria-modal="true">${html}</div>`;
  document.body.appendChild(root);
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
      `<div class="title-art">${img('pod0', 'title-pod')}${img('robot', 'title-robot')}</div>
       <h1>Scrub Bot</h1>
       <div class="row">
         ${hasSave ? `<button class="primary big-icon" data-act="continue" aria-label="Continue">▶</button>` : ''}
         <button class="${hasSave ? 'big-icon' : 'primary big-icon'}" data-act="new" aria-label="${hasSave ? 'New game' : 'Start'}">${hasSave ? '✦' : '▶'}</button>
       </div>`,
    );
    root.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
      const act = btn?.dataset.act;
      if (act === 'new' && hasSave && !armable(btn!)) return;
      if (act === 'continue' || act === 'new') {
        close();
        resolve(act);
      }
    });
    focusFirst(root);
  });
}

// --- field guide (text) ------------------------------------------------------------------

export function showDiscovery(id: SpeciesId): Promise<void> {
  const g = GUIDE_BY_ID[id];
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

const CATEGORY_ORDER: Category[] = ['nativeAnimal', 'nativePlant', 'invasivePlant', 'invasiveAnimal', 'hazard'];

export function showFieldGuide(state: GameState, openId?: SpeciesId): Promise<void> {
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
      `<div class="guide-head"><h2>${ICON.info}</h2><span class="count">${found}/${GUIDE.length}</span>
         <button class="icon-btn" data-close aria-label="Close">✕</button></div>
       <div class="guide-body">${sections}</div>
       <div class="detail" hidden></div>`,
    );
    const detail = root.querySelector<HTMLElement>('.detail')!;
    const body = root.querySelector<HTMLElement>('.guide-body')!;
    const openDetail = (id: SpeciesId) => {
      detail.innerHTML = renderDetail(GUIDE_BY_ID[id], state);
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
  if (needs.length === 0) return `<span class="needs ok">${ICON.heart}</span>`;
  const seen = new Set<string>();
  return `<span class="needs">${needs
    .filter((n) => !seen.has(n.icon) && seen.add(n.icon))
    .map((n) => `<span class="need">${img(n.icon)}</span>`)
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
    for (const sp of summary.arrived) tiles.push(`<div class="tile star">${img(sp)}<span>${ICON.star}</span></div>`);
    for (const p of summary.pops) {
      if (p.arrived) continue;
      tiles.push(`<div class="tile">${img(p.species)}<span>${p.to > p.from ? ICON.up : ICON.down}${p.to}</span></div>`);
    }
    if (summary.ready > 0) tiles.push(`<div class="tile">${img('hydro_ready_wet')}<span>×${summary.ready}</span></div>`);
    else if (summary.grew > 0) tiles.push(`<div class="tile">${img('hydro_sprout_wet')}<span>${ICON.up}</span></div>`);
    if (summary.unwatered > 0) tiles.push(`<div class="tile warn">${img('hydro_sown_dry')}<span>${ICON.water}${ICON.bang}</span></div>`);
    if (summary.spread > 0) tiles.push(`<div class="tile warn">${img('cogon')}<span>+${summary.spread}</span></div>`);
    const win = summary.wonTonight
      ? `<div class="win">🌅 ${NATIVE_ANIMALS.map((a) => img(a)).join('')} ${ICON.heart}</div>`
      : '';
    const quiet = tiles.length === 0 && summary.postcards.length === 0 ? `<p class="pict">🌙 ${ICON.sparkle}</p>` : '';
    const { root, close } = overlay(
      'morning',
      `<div class="sunrise">${ICON.day}<b>${summary.day}</b></div>
       ${win}
       <div class="tiles">${tiles.join('')}</div>
       ${quiet}
       <div class="postcards">${summary.postcards.map(postcardHtml).join('')}</div>
       <div class="mini-health">${(['sand', 'oak', 'rosemary'] as const)
         .map((z) => `<span>${img(z === 'sand' ? 'palmetto' : z)}<i style="width:${zoneHealth(state, z)}%"></i></span>`)
         .join('')}</div>
       <button class="primary big-icon" data-close aria-label="Start the day">▶</button>`,
    );
    const done = () => {
      close();
      resolve();
    };
    root.querySelector('[data-close]')!.addEventListener('click', done);
    focusFirst(root);
  });
}

export function showMonitor(state: GameState): Promise<void> {
  return new Promise((resolve) => {
    const rows = NATIVE_ANIMALS.map((sp) => {
      const pop = state.populations[sp] ?? 0;
      const back = pop > 0;
      const t = trend(state, sp);
      const arrow = t > 0 ? ICON.up : t < 0 ? ICON.down : '';
      return `<div class="mon-row${back ? '' : ' away'}">
        ${img(sp, back ? 'mon-animal' : 'mon-animal unknown')}
        <b class="mon-pop">${back ? pop : '–'}<small>${arrow}</small></b>
        ${back ? sparkline(state, sp) : '<span class="spark"></span>'}
        ${needsRow(state, sp, !back)}
        <span class="mon-seen">${ICON.eye}${state.sightings[sp] ?? 0}</span>
      </div>`;
    }).join('');
    const zones = (['sand', 'oak', 'rosemary'] as const)
      .map((z) => {
        const h = zoneHealth(state, z);
        return `<div class="mon-zone">${img(z === 'sand' ? 'palmetto' : z)}<span class="bar"><i style="width:${h}%"></i></span><b>${h}</b></div>`;
      })
      .join('');
    const s = state.stats;
    const { root, close } = overlay(
      'monitor',
      `<div class="screen">
         <div class="mon-head">${ICON.monitor}<span>${ICON.day}${state.day}</span>
           <button class="icon-btn" data-close aria-label="Close">✕</button></div>
         ${rows}
         <div class="mon-zones">${zones}</div>
         <div class="mon-stats">
           <span>${img('cogon')}${s.invasivesRemoved}</span><span>${ICON.bag}${s.trashCollected}</span>
           <span>${ICON.plant}${s.planted}</span><span>${ICON.truck}${s.relocated}</span>
         </div>
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
    const empty = !photos && !cards ? `<p class="pict">${ICON.board} ${ICON.question}</p>` : '';
    const { root, close } = overlay(
      'board',
      `<div class="cork">
         <button class="icon-btn close-corner" data-close aria-label="Close">✕</button>
         <div class="photos">${photos}</div>
         <div class="postcards">${cards}</div>
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
      `<h2>⏸</h2>
       <div class="mon-stats">
         <span>${img('cogon')}${s.invasivesRemoved}</span><span>${ICON.bag}${s.trashCollected}</span>
         <span>${ICON.plant}${s.planted}</span><span>${ICON.truck}${s.relocated}</span>
         <span>${ICON.postcard}${state.postcards.length}</span>
       </div>
       <div class="row">
         <button class="primary big-icon" data-act="resume" aria-label="Resume">▶</button>
         ${document.fullscreenEnabled ? '<button class="big-icon" data-act="full" aria-label="Fullscreen">⛶</button>' : ''}
         <button class="big-icon" data-act="new" aria-label="New game">✦</button>
       </div>`,
    );
    root.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
      const act = btn?.dataset.act;
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

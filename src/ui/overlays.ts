// Modal cards: title screen, field guide, discovery popups, morning summary and menu.
import { CATEGORY_LABEL, Category, GUIDE, GUIDE_BY_ID, GuideEntry, SpeciesId } from '../data/species';
import { NightSummary } from '../systems/dayCycle';
import { GameState } from '../systems/state';
import { setInputEnabled } from './input';

export type IconSource = (key: string) => string;

let openCount = 0;

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

export function showTitle(hasSave: boolean, icon: IconSource): Promise<'continue' | 'new'> {
  return new Promise((resolve) => {
    const { root, close } = overlay(
      'title',
      `<img class="title-robot" src="${icon('robot')}" alt="" />
       <h1>Scrub Bot</h1>
       <p class="subtitle">A little robot. A forgotten Florida scrub. Let's make it home again.</p>
       <div class="row">
         ${hasSave ? '<button class="primary" data-act="continue">Continue</button>' : ''}
         <button class="${hasSave ? '' : 'primary'}" data-act="new">${hasSave ? 'New game' : 'Start'}</button>
       </div>
       <p class="how">Drag anywhere to drive. Tap the big button to act.<br/>Keyboard: WASD / arrows to move, Space to act, G for the guide.</p>`,
    );
    root.addEventListener('click', (e) => {
      const act = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
      if (act === 'new' && hasSave && !confirm('Start over? Your current scrub will be replaced.')) return;
      if (act === 'continue' || act === 'new') {
        close();
        resolve(act);
      }
    });
    focusFirst(root);
  });
}

export function showDiscovery(id: SpeciesId, icon: IconSource): Promise<void> {
  const g = GUIDE_BY_ID[id];
  return new Promise((resolve) => {
    const { root, close } = overlay(
      'discovery',
      `<div class="eyebrow">New discovery · ${CATEGORY_LABEL[g.category]}</div>
       <img class="hero" src="${icon(id)}" alt="" />
       <h2>${escape(g.name)}</h2>
       ${g.sci ? `<div class="sci">${escape(g.sci)}</div>` : ''}
       <p>${escape(g.facts[0])}</p>
       <p class="helped">${escape(g.helped)}</p>
       <button class="primary" data-close>Got it!</button>`,
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

export function showFieldGuide(state: GameState, icon: IconSource): Promise<void> {
  return new Promise((resolve) => {
    const found = GUIDE.filter((g) => state.scanned.includes(g.id)).length;
    const sections = CATEGORY_ORDER.map((cat) => {
      const items = GUIDE.filter((g) => g.category === cat)
        .map((g) => {
          const known = state.scanned.includes(g.id);
          const back = cat === 'nativeAnimal' && state.returned.includes(g.id as never);
          const label = known ? escape(g.name) : back ? 'Scan me!' : '???';
          return `<button class="entry${known ? '' : ' unknown'}" data-id="${g.id}">
            <img src="${icon(g.id)}" alt="" /><span>${label}</span></button>`;
        })
        .join('');
      return `<h3>${CATEGORY_LABEL[cat]}</h3><div class="grid">${items}</div>`;
    }).join('');
    const { root, close } = overlay(
      'guide',
      `<div class="guide-head"><h2>Field Guide</h2><span class="count">${found}/${GUIDE.length} found</span>
         <button class="icon-btn" data-close aria-label="Close">✕</button></div>
       <div class="guide-body">${sections}</div>
       <div class="detail" hidden></div>`,
    );
    const detail = root.querySelector<HTMLElement>('.detail')!;
    const body = root.querySelector<HTMLElement>('.guide-body')!;
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
      if (!id) return;
      detail.innerHTML = renderDetail(GUIDE_BY_ID[id], state, icon);
      detail.hidden = false;
      body.hidden = true;
      detail.querySelector<HTMLButtonElement>('[data-back]')?.focus({ preventScroll: true });
    });
    onEscape(root, done);
    focusFirst(root);
  });
}

function renderDetail(g: GuideEntry, state: GameState, icon: IconSource): string {
  const known = state.scanned.includes(g.id);
  const body = known
    ? `<h2>${escape(g.name)}</h2>${g.sci ? `<div class="sci">${escape(g.sci)}</div>` : ''}
       <ul>${g.facts.map((f) => `<li>${escape(f)}</li>`).join('')}</ul>
       <p class="helped">${escape(g.helped)}</p>`
    : `<h2>???</h2><p>${g.hint ? escape(g.hint) : 'Find this out in the scrub and scan it to learn more.'}</p>`;
  return `<button class="back" data-back>← Back</button>
    <img class="hero${known ? '' : ' unknown'}" src="${icon(g.id)}" alt="" />${body}`;
}

export function showMorning(summary: NightSummary): Promise<void> {
  return new Promise((resolve) => {
    const postcards = summary.postcards
      .map((p) => `<div class="postcard"><div class="stamp">✉️</div><strong>${escape(p.title)}</strong><p>${escape(p.body)}</p></div>`)
      .join('');
    const lines = summary.lines.map((l) => `<li>${escape(l)}</li>`).join('');
    const win = summary.wonTonight
      ? `<div class="win">🌅 Every native visitor is home! The scrub is alive again. Keep tending it as long as you like.</div>`
      : '';
    const { root, close } = overlay(
      'morning',
      `<div class="eyebrow">Good morning!</div>
       <h2>Day ${summary.day}</h2>
       ${win}
       <ul class="lines">${lines}</ul>
       ${postcards}
       <button class="primary" data-close>Start the day</button>`,
    );
    const done = () => {
      close();
      resolve();
    };
    root.querySelector('[data-close]')!.addEventListener('click', done);
    focusFirst(root);
  });
}

export function showMenu(state: GameState): Promise<'resume' | 'new'> {
  return new Promise((resolve) => {
    const s = state.stats;
    const { root, close } = overlay(
      'menu',
      `<h2>Paused</h2>
       <ul class="stats">
         <li>🌿 Invasive plants removed: <b>${s.invasivesRemoved}</b></li>
         <li>🗑️ Trash collected: <b>${s.trashCollected}</b></li>
         <li>🌱 Natives planted: <b>${s.planted}</b></li>
         <li>🚚 Animals relocated: <b>${s.relocated}</b></li>
         <li>✉️ Postcards: <b>${state.postcards.length}</b></li>
       </ul>
       <div class="row">
         <button class="primary" data-act="resume">Resume</button>
         ${document.fullscreenEnabled ? '<button data-act="full">Fullscreen</button>' : ''}
         <button data-act="new">New game</button>
       </div>
       <p class="how">Your progress saves automatically on this device.</p>`,
    );
    root.addEventListener('click', (e) => {
      const act = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
      if (act === 'full') {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen?.().catch(() => undefined);
        return;
      }
      if (act === 'new' && !confirm('Start over? Your current scrub will be replaced.')) return;
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

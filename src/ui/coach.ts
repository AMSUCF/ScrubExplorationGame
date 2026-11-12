// The tutorial's coach: a small card under the HUD with the robot, the current step, and a progress
// bar. It advances the tutorial as steps are done, cheers each one, and highlights the buttons to
// press (HUD, home navigation, nursery and action tray). The scene draws the hand in the world.
import { audio } from '../audio';
import { ICON } from '../data/icons';
import { services } from '../services';
import { GameState } from '../systems/state';
import { Advance, Guidance, Pointer, advanceTutorial, guidance, noteTutorial, setTutorialTips, tutorialActive } from '../systems/tutorial';
import { renderIcons } from './icons';

/** How often the coach re-checks the steps and redraws (ms). */
const SYNC_MS = 160;
const CHEER_MS = 1300;
const CHEERS = ['Nice work!', 'Wonderful!', 'You did it!', 'Lovely!', 'Just right!', 'Well done!'];

const safe = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);

const CHEVRON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export interface CoachFrame {
  /** A modal card or close-up is open: the coach steps back, but keeps highlighting buttons inside it. */
  overlay: boolean;
  /** The robot's position outdoors (world px). */
  robot?: { x: number; y: number };
}

export class Coach {
  private root: HTMLElement;
  private state: GameState | null = null;
  private current: Guidance | null = null;
  private key = '';
  private glowing = new Set<Element>();
  private minimized = false;
  private cheerUntil = 0;
  private cheer = '';
  private pendingCheer = false;
  private lastSync = -Infinity;
  private dirty = false;
  private skipTimer: number | null = null;
  private height = -1;
  private cover = 0;
  private inset = 0;
  private measuredAt = 0;
  private listeners = new Set<() => void>();
  private readonly desktop = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches ?? false;

  constructor(private hud: HTMLElement) {
    this.root = document.createElement('section');
    this.root.className = 'coach';
    this.root.hidden = true;
    this.root.setAttribute('aria-label', 'Tutorial');
    // Each new step (and each little cheer) is read out politely.
    this.root.setAttribute('aria-live', 'polite');
    hud.appendChild(this.root);
    this.root.addEventListener('click', (e) => this.onClick(e));
    window.addEventListener('resize', () => this.measure(true));
  }

  /**
   * Called every frame by the play scene. A few times a second it moves past finished steps, redraws
   * and re-highlights. Returns where the hand should point, and whether the tutorial changed (to save).
   */
  sync(state: GameState, frame: CoachFrame): { pointer: Pointer | null; changed: boolean } {
    const now = performance.now();
    if (state !== this.state) {
      // A new game (or a reload) starts fresh.
      this.state = state;
      this.key = '';
      this.minimized = false;
      this.cheerUntil = 0;
      this.pendingCheer = false;
    }
    let changed = this.dirty;
    this.dirty = false;
    if (changed || now - this.lastSync >= SYNC_MS) {
      this.lastSync = now;
      const step = advanceTutorial(state);
      if (step) {
        changed = true;
        this.celebrate(step, frame.overlay, now);
      }
      this.current = tutorialActive(state) ? guidance(state, { robot: frame.robot, desktop: this.desktop }) : null;
      this.render(frame.overlay, now);
      this.highlight();
    }
    return { pointer: this.current && !frame.overlay && now >= this.cheerUntil ? this.current.pointer : null, changed };
  }

  /** CSS px from the top of the screen that the HUD's top stack (and the coach) covers. */
  topInset(): number {
    this.measure();
    return this.inset;
  }

  /** How tall the coach is where it covers the play area under the HUD (CSS px; 0 when it floats aside). */
  coverHeight(): number {
    // Behind a card it still keeps its space, so the view doesn't drift and slide back.
    this.measure();
    return this.cover;
  }

  /** Be told when the coach's size changes (the pod re-frames its room around it). */
  onLayout(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  /** Is the coach card taking up room in the top-left stack (rather than floating at the side)? */
  inTopStack(): boolean {
    if (this.root.hidden) return false;
    const r = this.root.getBoundingClientRect();
    return r.height > 0 && r.left < window.innerWidth * 0.4;
  }

  // --- drawing -------------------------------------------------------------------------------

  private celebrate(step: Advance, overlay: boolean, now: number): void {
    if (!this.state?.tutorial || this.state.tutorial.off) return;
    if (step.finished) {
      audio.sfx('levelUp');
      services.hud?.toast('Tutorial complete! The scrub is yours. Happy growing.');
      return;
    }
    audio.sfx('task', { vol: 0.8 });
    this.cheer = CHEERS[step.to % CHEERS.length];
    if (overlay) this.pendingCheer = true;
    else this.cheerUntil = now + CHEER_MS;
  }

  private render(overlay: boolean, now: number): void {
    const g = this.current;
    const visible = !!g;
    this.root.hidden = !visible;
    // Behind a card the coach keeps its space, so nothing below it jumps around.
    this.root.classList.toggle('behind', overlay);
    if (!g) {
      // Measure once as it hides (games without the tutorial never pay for layout reads).
      if (this.key !== '' || this.height !== 0) {
        this.key = '';
        this.measure(true);
      }
      return;
    }
    if (!overlay && this.pendingCheer) {
      this.pendingCheer = false;
      this.cheerUntil = now + CHEER_MS;
    }
    const cheering = now < this.cheerUntil;
    const key = cheering ? `cheer|${this.minimized}|${this.cheer}` : `${this.minimized}|${g.index}|${g.title}|${g.text}|${g.ack}|${g.detour}`;
    if (key === this.key) return;
    const fresh = !this.key.startsWith(cheering ? 'cheer' : `${this.minimized}|${g.index}|`);
    this.key = key;
    this.root.classList.toggle('minimized', this.minimized);
    this.root.classList.toggle('cheering', cheering);
    this.root.classList.toggle('detour', !!g.detour);
    this.root.innerHTML = renderIcons(cheering ? this.cheerHtml() : this.minimized ? this.pillHtml(g) : this.cardHtml(g));
    if (fresh) {
      this.root.classList.remove('arrive');
      void this.root.offsetWidth;
      this.root.classList.add('arrive');
    }
    this.measure(true);
  }

  private cardHtml(g: Guidance): string {
    const pct = Math.round((g.index / g.total) * 100);
    const eyebrow = g.detour ? 'A little detour' : safe(g.chapterName);
    return `<div class="coach-card">
      <img class="coach-bot" src="${services.icon('robot')}" alt="" />
      <div class="coach-body">
        <div class="coach-eyebrow">${eyebrow} · <span class="coach-count" aria-label="step ${g.index + 1} of ${g.total}">${g.index + 1}/${g.total}</span></div>
        <h2 class="coach-title">${safe(g.title)}</h2>
        <p class="coach-text">${safe(g.text)}</p>
        ${g.ack ? `<div class="coach-actions"><button class="coach-ack" data-coach="ack">${ICON.done}<span>${safe(g.ack)}</span></button></div>` : ''}
      </div>
      <div class="coach-tools">
        <button class="coach-skip" data-coach="skip" aria-label="Skip tutorial">Skip</button>
        <button class="coach-min" data-coach="min" aria-label="Tuck the tutorial tip away" aria-expanded="true">${CHEVRON}</button>
      </div>
      <div class="coach-progress" aria-hidden="true"><i style="width:${pct}%"></i></div>
    </div>`;
  }

  private pillHtml(g: Guidance): string {
    return `<button class="coach-pill" data-coach="min" aria-expanded="false" aria-label="Show the tutorial tip: ${safe(g.title)}">
      <img src="${services.icon('robot')}" alt="" /><span class="coach-count">${g.index + 1}/${g.total}</span><b>${safe(g.title)}</b>${CHEVRON}</button>`;
  }

  private cheerHtml(): string {
    return this.minimized
      ? `<div class="coach-pill">${ICON.done}<b>${this.cheer}</b></div>`
      : `<div class="coach-card coach-cheer"><span class="coach-check">${ICON.done}</span><b>${this.cheer}</b></div>`;
  }

  /** Glow every button the current step wants pressed, wherever it is on the page. */
  private highlight(): void {
    const want = new Set<Element>();
    if (this.current) for (const sel of this.current.glow) document.querySelectorAll(sel).forEach((el) => want.add(el));
    for (const el of this.glowing) if (!want.has(el)) el.classList.remove('tut-glow');
    for (const el of want) el.classList.add('tut-glow');
    this.glowing = want;
  }

  private measure(force = false): void {
    const now = performance.now();
    if (!force && now - this.measuredAt < 1000) return;
    this.measuredAt = now;
    const top = this.hud.querySelector<HTMLElement>('.topbar')?.getBoundingClientRect().bottom ?? 0;
    const inv = this.hud.querySelector<HTMLElement>('.inventory')?.getBoundingClientRect().bottom ?? 0;
    const stacked = this.inTopStack();
    const own = stacked ? this.root.getBoundingClientRect().bottom : 0;
    const inset = Math.round(Math.max(top, inv, own));
    const h = this.root.hidden ? 0 : Math.round(this.root.getBoundingClientRect().height);
    this.cover = stacked ? h : 0;
    const moved = Math.abs(inset - this.inset) > 2 || h !== this.height;
    this.inset = inset;
    if (h !== this.height) {
      this.height = h;
      this.hud.style.setProperty('--coach-h', `${h ? h + 8 : 0}px`);
    }
    // The coach grew, shrank, or slid down under a taller inventory: let the pod re-frame its room.
    if (moved) for (const cb of this.listeners) cb();
  }

  // --- buttons -------------------------------------------------------------------------------

  private onClick(e: MouseEvent): void {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-coach]');
    const s = this.state;
    if (!btn || !s?.tutorial) return;
    // Let Space and E go back to the robot after a tap on the card.
    if (e.detail > 0) btn.blur();
    const act = btn.dataset.coach;
    if (act === 'min') {
      this.minimized = !this.minimized;
      audio.sfx('page');
      this.dirty = true;
    } else if (act === 'ack' && this.current) {
      audio.sfx('click');
      noteTutorial(s, `ack:${this.current.id}`);
      this.dirty = true;
    } else if (act === 'skip') {
      if (!btn.classList.contains('armed')) {
        btn.classList.add('armed');
        btn.textContent = 'Really skip?';
        if (this.skipTimer !== null) window.clearTimeout(this.skipTimer);
        this.skipTimer = window.setTimeout(() => {
          btn.classList.remove('armed');
          btn.textContent = 'Skip';
        }, 2500);
        return;
      }
      setTutorialTips(s, false);
      audio.sfx('click');
      services.hud?.toast('Tutorial tips are off. You can turn them back on from Pause.');
      this.dirty = true;
    }
  }
}

import { audio } from '../../audio';
import { ICON } from '../../data/icons';
import { speciesName } from '../../data/species';
import { services } from '../../services';
import { ScopeGuest } from '../../systems/minigames/burrowScope';
import { renderIcons } from '../icons';
import { frameLoop, minigameShell } from './shell';

export interface ScopeResult {
  seen: ScopeGuest['id'][];
}

const TUNNEL = 'M30 40C130 90 30 170 120 220Q160 245 120 285';
const LIGHT = 30;
const GUEST_SIZE: Record<string, number> = { frog: 26, beetle: 16, cricket: 22, mouse: 24, indigo: 52, tortoise: 44 };
const SHY_SECONDS = 2.4;

/** Lower a little camera down the burrow and tap the neighbours caught in its light. */
export function showBurrowScope(guests: ScopeGuest[]): Promise<ScopeResult> {
  return new Promise((resolve) => {
    const { root, stage, notebook, feedback, close } = minigameShell(
      'scope',
      { eyebrow: 'Burrow scope', title: 'Who lives down there?', subtitle: 'A tortoise burrow can be home to hundreds of kinds of animals.' },
      `<svg class="bs-canvas" viewBox="0 0 180 320" aria-label="Side view of a tortoise burrow">
         <defs><mask id="bs-light"><rect width="180" height="320" fill="white"/><circle class="bs-hole" r="${LIGHT}" fill="black"/></mask>
           <radialGradient id="bs-glow"><stop offset=".6" stop-color="#fff6c8" stop-opacity="0"/><stop offset="1" stop-color="#fff6c8" stop-opacity=".45"/></radialGradient></defs>
         <image href="${services.icon('burrow_section')}" width="180" height="320" preserveAspectRatio="none"/>
         <path class="bs-path" d="${TUNNEL}" fill="none" stroke="none"/>
         <g class="bs-guests"></g>
         <rect y="36" width="180" height="284" fill="#1c140d" opacity=".93" mask="url(#bs-light)"/>
         <circle class="bs-ring" r="${LIGHT}" fill="url(#bs-glow)"/>
         <path class="bs-cable" fill="none" stroke="#5f6b74" stroke-width="2.2"/>
       </svg>`,
      `<label class="bs-depth"><span>Scope depth</span><input type="range" min="0" max="100" value="0" aria-label="Scope depth"/></label>
       <ul class="mg-tips"><li><b>Lower the scope:</b> drag down on the burrow, or use the depth slider.</li>
         <li><b>Tap a neighbor</b> while it’s in the light to log it.</li>
         <li>Shy guests slip deeper if you shine on them too long.</li></ul>
       <div class="bs-found"></div>
       <button class="primary bs-done">${ICON.done}<span>Wind the cable back up</span></button>`,
      'Leave',
    );
    const svg = stage.querySelector<SVGSVGElement>('.bs-canvas')!;
    const path = svg.querySelector<SVGPathElement>('.bs-path')!;
    const hole = svg.querySelector<SVGCircleElement>('.bs-hole')!;
    const ring = svg.querySelector<SVGCircleElement>('.bs-ring')!;
    const cable = svg.querySelector<SVGPathElement>('.bs-cable')!;
    const layer = svg.querySelector<SVGGElement>('.bs-guests')!;
    const slider = notebook.querySelector<HTMLInputElement>('.bs-depth input')!;
    const found = notebook.querySelector<HTMLElement>('.bs-found')!;
    const length = path.getTotalLength();
    const at = (d: number) => path.getPointAtLength(Math.max(0, Math.min(1, d)) * length);
    const live = guests.map((g) => ({ ...g, lit: 0, seen: false, moved: false }));
    const seen: ScopeGuest['id'][] = [];
    let depth = 0;
    let drag: { id: number; y: number; depth: number } | null = null;

    const placeGuests = () => {
      layer.innerHTML = live.map((g, i) => {
        const p = at(g.depth), s = GUEST_SIZE[g.id] ?? 22;
        return `<image class="bs-guest${g.seen ? ' seen' : ''}" data-g="${i}" href="${services.icon(g.id)}" x="${p.x - s / 2}" y="${p.y - s * 0.7}" width="${s}" height="${s * 0.8}" role="button" tabindex="0" aria-label="${speciesName(g.id)}"/>`;
      }).join('');
    };
    const paintFound = () => {
      found.innerHTML = renderIcons(`<h3>${ICON.eye} Logged ${seen.length}</h3>${seen.map((id) => `<span class="bs-chip"><img src="${services.icon(id)}" alt=""/>${speciesName(id)}</span>`).join('')}`);
    };

    const stop = frameLoop(root, (dt) => {
      const p = at(depth);
      hole.setAttribute('cx', String(p.x));
      hole.setAttribute('cy', String(p.y));
      ring.setAttribute('cx', String(p.x));
      ring.setAttribute('cy', String(p.y));
      cable.setAttribute('d', `M30 20 ${Array.from({ length: 12 }, (_, i) => { const q = at((depth * i) / 11); return `L${q.x} ${q.y}`; }).join(' ')}`);
      for (const g of live) {
        const q = at(g.depth);
        const inLight = Math.hypot(q.x - p.x, q.y - p.y) < LIGHT * 0.9;
        g.lit = inLight ? g.lit + dt : 0;
        if (g.shy && !g.seen && !g.moved && g.lit > SHY_SECONDS) {
          g.moved = true;
          g.depth = Math.min(0.9, g.depth + 0.1);
          g.lit = 0;
          feedback.textContent = `The ${speciesName(g.id).toLowerCase()} scooted deeper. Follow it gently.`;
          placeGuests();
        }
      }
    });

    const setDepth = (d: number) => {
      const before = depth;
      depth = Math.max(0, Math.min(1, d));
      slider.value = String(Math.round(depth * 100));
      if (Math.abs(depth - before) > 0.04 && Math.random() < 0.3) audio.sfx('scope', { vol: 0.4 });
    };
    const log = (i: number) => {
      const g = live[i];
      if (!g || g.seen) return;
      const q = at(g.depth), p = at(depth);
      if (Math.hypot(q.x - p.x, q.y - p.y) > LIGHT) {
        feedback.textContent = 'Too dark to see. Bring the light closer.';
        return;
      }
      g.seen = true;
      seen.push(g.id);
      audio.sfx('photo');
      if (g.id === 'frog') audio.sfx('frog', { delay: 0.2 });
      else if (g.id === 'mouse' || g.id === 'indigo' || g.id === 'tortoise') audio.animal(g.id, { delay: 0.2, vol: 0.6 });
      feedback.textContent = g.id === 'tortoise' ? 'The burrow’s builder, resting in the cool deep chamber.' : `Hello, ${speciesName(g.id).toLowerCase()}!`;
      placeGuests();
      paintFound();
    };

    svg.addEventListener('pointerdown', (e) => {
      const g = (e.target as Element).closest<SVGElement>('[data-g]');
      if (g) return log(Number(g.dataset.g));
      drag = { id: e.pointerId, y: e.clientY, depth };
      svg.setPointerCapture(e.pointerId);
    });
    svg.addEventListener('pointermove', (e) => {
      if (!drag || drag.id !== e.pointerId) return;
      setDepth(drag.depth + ((e.clientY - drag.y) / svg.clientHeight) * 1.25);
    });
    const release = (e: PointerEvent) => drag?.id === e.pointerId && (drag = null);
    svg.addEventListener('pointerup', release);
    svg.addEventListener('pointercancel', release);
    slider.addEventListener('input', () => setDepth(Number(slider.value) / 100));
    layer.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      const g = (e.target as Element).closest<SVGElement>('[data-g]');
      if (g) log(Number(g.dataset.g));
    });
    const leave = () => {
      stop();
      close();
      resolve({ seen });
    };
    notebook.querySelector('.bs-done')!.addEventListener('click', leave);
    root.querySelector('[data-leave]')!.addEventListener('click', leave);
    root.addEventListener('keydown', (e) => e.key === 'Escape' && leave());
    audio.sfx('scope');
    placeGuests();
    paintFound();
    slider.focus({ preventScroll: true });
  });
}

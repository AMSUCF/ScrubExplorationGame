import { audio } from '../audio';
import { ICON } from '../data/icons';
import { speciesName } from '../data/species';
import { services } from '../services';
import { InvasivePlantEntity, NativePlantEntity } from '../systems/state';
import { BAG, BRANCHES, BULBILS, PULL, SNIPS, Point, bagBulbil, careStage, cutStroke, newVineCare, pullVine, snipVine } from '../systems/vineCare';
import { overlay } from './overlays';

const VINES = [
  'M144 457C135 418 117 383 138 346C167 296 113 256 160 211C198 176 155 137 215 110',
  'M273 456C310 427 338 408 318 381C287 336 361 303 330 248C303 196 365 153 321 112',
  'M367 452C403 407 428 376 398 338C368 299 433 268 396 218C358 166 420 143 365 118',
];
const steps = ['Snip', 'Gather', 'Unwind'];

/** A calm, pointer-driven close-up. State changes happen only through the tested work rules. */
export function showVineCare(vine: InvasivePlantEntity, host: NativePlantEntity | undefined, onProgress: () => void): Promise<boolean> {
  vine.care ??= newVineCare();
  const work = vine.care;
  return new Promise(resolve => {
    const { root, close } = overlay('vine-care', `
      <header class="care-header"><div><div class="eyebrow">Little acts of restoration</div><h2>Room to breathe</h2><p>Free the air potato vine${host ? ` from this ${speciesName(host.species).toLowerCase()}` : ''}.</p></div>
      <button class="care-pause" data-pause aria-label="Pause vine care">${ICON.close}<span>Save & leave</span></button></header>
      <div class="care-layout"><div class="care-stage"><svg class="care-canvas" viewBox="0 0 540 540" aria-label="Vine restoration work area"><defs><radialGradient id="care-sun"><stop stop-color="#fff9da"/><stop offset="1" stop-color="#e6dfbf"/></radialGradient></defs><g class="care-art"></g><path class="care-stroke" fill="none" stroke="#fff3bf" stroke-width="5" stroke-linecap="round"/></svg></div>
      <aside class="care-notebook"><div class="care-steps"></div><div class="care-instruction" aria-live="polite"></div><div class="care-tip">${ICON.plant}<span>Protect the native branches.<br>There’s no hurry here.</span></div><p class="care-feedback" role="status"></p><div class="care-cost">${ICON.battery} 4 energy when finished<br>${ICON.bag} Room for 3 bulbils needed</div><button class="primary care-finish" disabled>${ICON.done}<span>Back to the scrub</span></button><p class="care-keyboard">Touch or mouse: swipe and drag.<br>Keyboard: Tab to a gold mark, then Enter.</p></aside></div>`);
    const canvas = root.querySelector<SVGSVGElement>('.care-canvas')!;
    const art = root.querySelector<SVGGElement>('.care-art')!;
    const trail = root.querySelector<SVGPathElement>('.care-stroke')!;
    const status = root.querySelector<HTMLElement>('.care-feedback')!;
    const finish = root.querySelector<HTMLButtonElement>('.care-finish')!;
    let active: { id: number; points: Point[]; bulbil: number } | null = null;
    let closed = false;
    const leave = (completed: boolean) => { if (closed) return; closed = true; onProgress(); close(); resolve(completed); };

    const paint = (message = '') => {
      const stage = careStage(work);
      root.dataset.stage = stage;
      const current = stage === 'snip' ? 0 : stage === 'bag' ? 1 : 2;
      root.querySelector('.care-steps')!.innerHTML = steps.map((s, i) => `<span class="${i < current || stage === 'done' ? 'complete' : i === current ? 'current' : ''}"><b>${i + 1}</b>${s}</span>`).join('');
      root.querySelector('.care-instruction')!.innerHTML = {
        snip: `<h3>Small snips, safe branches</h3><p>Swipe across each <strong>gold snip mark</strong>. Leave the thick, pale-outlined native branches alone.</p><strong>${work.cuts.length} / 3 stems cut</strong>`,
        bag: `<h3>Catch tomorrow’s vines</h3><p>Drag the three brown <strong>bulbils into the satchel</strong>. Left on the ground, they can grow again.</p><strong>${work.bagged.length} / 3 bulbils gathered</strong>`,
        pull: '<h3>A gentle goodbye</h3><p>The stems are cut and the bulbils are safe. <strong>Drag the loose vine downward</strong> to ease it off its host.</p>',
        done: `<h3>Look at that little patch of sunlight.</h3><p>${work.brushes === 0 ? 'Careful hands! You kept every native branch safe. +1 recycled part.' : 'Patient work makes a difference. Every native branch is safe.'}</p><strong>A butterfly found the sunshine.</strong>`,
      }[stage];
      status.textContent = message;
      finish.disabled = stage !== 'done';
      const native = host?.species ?? 'oak';
      art.innerHTML = `<rect width="540" height="540" rx="28" fill="url(#care-sun)"/>
        <ellipse cx="270" cy="457" rx="203" ry="38" fill="#c6ba94" opacity=".35"/>
        <image href="${services.icon(native)}" x="80" y="26" width="380" height="422" opacity="${stage === 'done' ? 1 : .66}"/>
        <g class="native-branches" opacity="${stage === 'done' ? 0 : .78}">${BRANCHES.map(([a, b]) => {
          const d = `M${a.x} ${a.y}Q${(a.x + b.x) / 2 + 3} ${(a.y + b.y) / 2 - 4} ${b.x} ${b.y}`;
          return `<path d="${d}" fill="none" stroke="#fff2cc" stroke-width="17" stroke-linecap="round"/><path d="${d}" fill="none" stroke="#a9916e" stroke-width="8" stroke-linecap="round"/><path d="${d}" fill="none" stroke="#78694d" stroke-width="1.2" stroke-dasharray="8 3 2 5" stroke-linecap="round"/>`;
        }).join('')}</g>
        ${stage === 'done' ? `<image class="care-butterfly" href="${import.meta.env.BASE_URL}art/decor_butterfly.png" x="327" y="113" width="62" height="52"/>` : VINES.map((d, i) => `<g class="care-vine" opacity="${work.cuts.includes(i) ? .28 : 1}"><path d="${d}" fill="none" stroke="#617546" stroke-width="4.5" stroke-linecap="round"/><path d="${d}" fill="none" stroke="#abb980" stroke-width="1.2" stroke-linecap="round"/><g class="care-leaves"></g></g>`).join('')}
        ${stage === 'snip' ? SNIPS.map((p, i) => work.cuts.includes(i) ? `<circle cx="${p.x}" cy="${p.y}" r="13" fill="#c6d5aa"/><path d="M${p.x - 6} ${p.y}l4 4 8-9" fill="none" stroke="#53734d" stroke-width="3"/>` : `<g role="button" tabindex="0" data-cut="${i}" aria-label="Cut vine ${i + 1}" class="care-target"><circle cx="${p.x}" cy="${p.y}" r="34" fill="#fff5d4" stroke="#d4a750" stroke-width="3"/><image href="${import.meta.env.BASE_URL}art/ui_cut.png" x="${p.x - 22}" y="${p.y - 22}" width="44" height="44"/></g>`).join('') : ''}
        ${stage !== 'done' ? BULBILS.map((p, i) => work.bagged.includes(i) ? '' : `<g data-bulbil="${i}" ${stage === 'bag' ? `role="button" tabindex="0" aria-label="Bag bulbil ${i + 1}" class="care-target"` : ''}><circle cx="${p.x}" cy="${p.y}" r="25" fill="${stage === 'bag' ? '#fff1c4' : 'transparent'}" ${stage === 'bag' ? 'stroke="#d4a750" stroke-width="2"' : ''}/><image href="${import.meta.env.BASE_URL}art/vine_bulbil.png" x="${p.x - 19}" y="${p.y - 22}" width="38" height="44"/></g>`).join('') : ''}
        ${stage === 'bag' ? `<g class="care-satchel"><circle cx="${BAG.x}" cy="${BAG.y}" r="${BAG.radius}" fill="#e5d9ae" stroke="#acaa79" stroke-width="2" stroke-dasharray="6 5"/><image href="${import.meta.env.BASE_URL}art/ui_bag.png" x="${BAG.x - 38}" y="${BAG.y - 38}" width="76" height="76"/><text x="${BAG.x}" y="${BAG.y + 48}" text-anchor="middle" fill="#5c6d4d" font-size="13" font-family="Nunito">Drag here</text></g>` : ''}
        ${stage === 'pull' ? `<g role="button" tabindex="0" data-pull aria-label="Gently pull the vine free" class="care-target"><circle cx="${PULL.x}" cy="${PULL.y}" r="32" fill="#fff1c4" stroke="#c7a458" stroke-width="3"/><image href="${import.meta.env.BASE_URL}art/ui_pull.png" x="${PULL.x - 23}" y="${PULL.y - 23}" width="46" height="46"/><path d="M263 476v38m-9-9 9 9 9-9" fill="none" stroke="#8b9d6c" stroke-width="3" stroke-linecap="round"/></g>` : ''}`;
      // Place smaller painted leaves on the actual curved stems, including their turns.
      art.querySelectorAll<SVGGElement>('.care-vine').forEach((vine, i) => {
        const path = vine.querySelector('path')!, length = path.getTotalLength();
        const leaves = vine.querySelector('.care-leaves')!;
        for (let j = 0; j < 8; j++) {
          const p = path.getPointAtLength(length * (.13 + j * .1)), side = j % 2 ? 1 : -1, size = 29 + (i + j) % 3 * 3;
          const leaf = document.createElementNS('http://www.w3.org/2000/svg', 'image');
          leaf.setAttribute('href', `${import.meta.env.BASE_URL}art/vine_leaf.png`);
          leaf.setAttribute('x', String(p.x - size / 2 + side * 6)); leaf.setAttribute('y', String(p.y - size / 2));
          leaf.setAttribute('width', String(size)); leaf.setAttribute('height', String(size * 1.14));
          leaf.setAttribute('transform', `rotate(${side * (28 + j * 3)} ${p.x} ${p.y})`);
          leaves.append(leaf);
        }
      });
    };
    const changed = (message: string, sound: 'cut' | 'pickup' | 'pull' = 'cut') => { audio.sfx(sound); onProgress(); paint(message); };
    const point = (e: PointerEvent): Point => {
      const p = canvas.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
      const local = p.matrixTransform(canvas.getScreenCTM()!.inverse());
      return { x: local.x, y: local.y };
    };
    canvas.addEventListener('pointerdown', e => {
      if (active || careStage(work) === 'done') return;
      e.preventDefault();
      const at = point(e), node = (e.target as Element).closest<SVGElement>('[data-bulbil]');
      active = { id: e.pointerId, points: [at], bulbil: node ? Number(node.dataset.bulbil) : -1 };
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', e => {
      if (!active || active.id !== e.pointerId) return;
      const at = point(e); active.points.push(at);
      if (careStage(work) === 'snip') trail.setAttribute('d', active.points.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(''));
      if (careStage(work) === 'bag' && active.bulbil >= 0) {
        const start = active.points[0];
        art.querySelector(`[data-bulbil="${active.bulbil}"]`)?.setAttribute('transform', `translate(${at.x - start.x} ${at.y - start.y})`);
      }
    });
    canvas.addEventListener('pointerup', e => {
      if (!active || active.id !== e.pointerId) return;
      const gesture = active; active = null;
      const at = point(e); gesture.points.push(at); trail.setAttribute('d', '');
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      const stage = careStage(work);
      if (stage === 'snip') {
        const result = cutStroke(work, gesture.points);
        if (result === 'cut') changed('A little snip. The native branch is safe.');
        else { onProgress(); paint(result === 'branch' ? 'Easy there! The robot caught the blade. Try a short swipe across a gold mark, away from the native branch.' : 'Make a short swipe through a gold snip mark.'); }
      } else if (stage === 'bag') {
        if (bagBulbil(work, gesture.bulbil, at)) changed('One less vine for tomorrow.', 'pickup');
        else paint('Drop each brown bulbil inside the dashed satchel circle.');
      } else if (stage === 'pull') {
        if (pullVine(work, gesture.points[0], at)) changed('Free at last. Hello, sunshine!', 'pull');
        else paint('Start on the little hand and draw the loose vine downward.');
      }
    });
    canvas.addEventListener('pointercancel', () => { active = null; trail.setAttribute('d', ''); paint('Take your time. Your work is saved.'); });
    canvas.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      const el = (e.target as Element).closest<SVGElement>('[data-cut], [data-bulbil], [data-pull]');
      if (!el) return;
      if (el.hasAttribute('data-cut') && snipVine(work, Number(el.dataset.cut))) changed('A careful snip.');
      else if (el.hasAttribute('data-bulbil') && bagBulbil(work, Number(el.dataset.bulbil))) changed('Safely in the satchel.', 'pickup');
      else if (el.hasAttribute('data-pull') && pullVine(work, PULL, { x: PULL.x, y: PULL.y + 70 })) changed('Hello, sunshine!', 'pull');
      requestAnimationFrame(() => (canvas.querySelector('[tabindex="0"]') as SVGElement | null)?.focus());
    });
    root.querySelector('[data-pause]')!.addEventListener('click', () => leave(false));
    finish.addEventListener('click', () => { if (careStage(work) === 'done') leave(true); });
    root.addEventListener('keydown', e => { if (e.key === 'Escape') leave(false); });
    paint();
    root.querySelector<HTMLButtonElement>('[data-pause]')!.focus({ preventScroll: true });
  });
}

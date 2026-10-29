import { audio } from '../../audio';
import { ICON } from '../../data/icons';
import { services } from '../../services';
import { Point } from '../../systems/vineCare';
import { RHIZOME_SIZE, digComplete, digStars, generateRhizome, newDig, tipsFound, traceStroke } from '../../systems/minigames/rhizome';
import { renderIcons } from '../icons';
import { frameLoop, minigameShell, stars, svgPoint } from './shell';

export interface DigResult {
  complete: boolean;
  stars: number;
  seconds: number;
}

const TIME_LIMIT = 50;

/** Trace each faint runner from the clump out to its green tip, under the sand. */
export function showRhizomeDig(seed: number): Promise<DigResult> {
  const r = generateRhizome(seed);
  const work = newDig(r);
  const S = RHIZOME_SIZE;
  return new Promise((resolve) => {
    const { root, stage, notebook, feedback, close } = minigameShell(
      'rhizome',
      { eyebrow: 'Rhizome probe', title: 'Roots and all', subtitle: 'Cogon creeps through the sand on hidden runners. Follow every one.' },
      `<svg class="rz-canvas" viewBox="0 0 ${S} ${S}" aria-label="Sand with hidden cogon runners">
         <image href="${services.icon('dig_sand')}" width="${S}" height="${S}" preserveAspectRatio="none"/>
         <g class="rz-runners"></g><g class="rz-tips"></g>
         <image href="${services.icon('cogon')}" x="${S / 2 - 46}" y="${S / 2 - 70}" width="92" height="92"/>
         <path class="rz-stroke" fill="none" stroke="#fff3bf" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
       </svg>`,
      `<div class="rz-progress"></div>
       <div class="rz-timer"><i></i></div>
       <ul class="mg-tips"><li><b>Start at the clump</b> and drag along the faint lines in the sand.</li>
         <li>Runners only count when they <b>connect back to the clump</b>.</li>
         <li>Reach every <b>green shoot</b> before the sand settles.</li></ul>
       <div class="rz-result" hidden></div>
       <button class="primary rz-done" hidden>${ICON.done}<span>Lift the clump</span></button>`,
      'Stop digging',
    );
    const svg = stage.querySelector<SVGSVGElement>('.rz-canvas')!;
    const runners = svg.querySelector('.rz-runners')!;
    const tips = svg.querySelector('.rz-tips')!;
    const trail = svg.querySelector('.rz-stroke')!;
    const progress = notebook.querySelector<HTMLElement>('.rz-progress')!;
    const timer = notebook.querySelector<HTMLElement>('.rz-timer i')!;
    let elapsed = 0, finished = false;
    let stroke: { id: number; pts: Point[] } | null = null;

    const paint = () => {
      const lines = (lit: boolean) => r.nodes.map((p, i) => {
        if (i === 0 || work.covered[i] !== lit) return '';
        const q = r.nodes[r.parent[i]];
        return `<line x1="${q.x}" y1="${q.y}" x2="${p.x}" y2="${p.y}"/>`;
      }).join('');
      // Hidden runners show as faint furrows in the pale sand; traced ones glow cream over a warm edge.
      // Opacity is set per group, so overlapping round caps don't darken the joints.
      runners.innerHTML = `<g stroke="#9a7a4c" stroke-width="6" stroke-linecap="round" opacity="0.4">${lines(false)}</g>
        <g stroke="#b08c5a" stroke-width="12" stroke-linecap="round" opacity="0.45">${lines(true)}</g>
        <g stroke="#fff6d8" stroke-width="8" stroke-linecap="round">${lines(true)}</g>`;
      tips.innerHTML = r.tips.map((i) => {
        const p = r.nodes[i];
        return `<image href="${services.icon('cogon')}" x="${p.x - 15}" y="${p.y - 26}" width="30" height="30" opacity="${work.covered[i] ? 0.35 : 1}"/>${work.covered[i] ? `<circle cx="${p.x}" cy="${p.y}" r="9" fill="#a5bb8d"/>` : ''}`;
      }).join('');
      progress.innerHTML = renderIcons(`${ICON.dig}<b>${tipsFound(r, work)} / ${r.tips.length}</b> shoots reached`);
    };

    const finish = (timeUp: boolean) => {
      if (finished) return;
      finished = true;
      stopClock();
      const n = digStars(r, work, elapsed);
      const complete = digComplete(r, work);
      const result = notebook.querySelector<HTMLElement>('.rz-result')!;
      result.hidden = false;
      result.innerHTML = `<h3>${complete ? 'Every runner found!' : timeUp ? 'The sand settles.' : 'Partly dug.'}</h3>${stars(n)}<p>${complete ? 'This patch, and the clumps joined to it, won’t come back.' : 'You lift the clump, but a few runners stay behind and may sprout again.'}</p>`;
      notebook.querySelector<HTMLElement>('.rz-done')!.hidden = false;
      notebook.querySelector<HTMLButtonElement>('.rz-done')!.focus({ preventScroll: true });
      audio.sfx(complete ? 'rescue' : 'pull');
    };

    const stopClock = frameLoop(root, (dt) => {
      if (finished) return;
      elapsed += dt;
      timer.style.width = `${Math.max(0, 1 - elapsed / TIME_LIMIT) * 100}%`;
      if (elapsed >= TIME_LIMIT) finish(true);
    });

    svg.addEventListener('pointerdown', (e) => {
      if (finished || stroke) return;
      e.preventDefault();
      stroke = { id: e.pointerId, pts: [svgPoint(svg, e)] };
      svg.setPointerCapture(e.pointerId);
    });
    svg.addEventListener('pointermove', (e) => {
      if (!stroke || stroke.id !== e.pointerId) return;
      stroke.pts.push(svgPoint(svg, e));
      trail.setAttribute('d', stroke.pts.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(''));
      // Trace live, so runners light up under the finger.
      if (traceStroke(r, work, stroke.pts.slice(-6)) > 0) {
        audio.sfx('dig', { vol: 0.5 });
        paint();
        if (digComplete(r, work)) finish(false);
      }
    });
    const end = (e: PointerEvent) => {
      if (!stroke || stroke.id !== e.pointerId) return;
      traceStroke(r, work, stroke.pts);
      stroke = null;
      trail.setAttribute('d', '');
      paint();
      if (digComplete(r, work)) finish(false);
      else feedback.textContent = 'Keep going: start from a lit runner and follow it outward.';
    };
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);

    const leave = () => {
      stopClock();
      close();
      resolve({ complete: digComplete(r, work), stars: digStars(r, work, elapsed), seconds: elapsed });
    };
    // Keyboard: each press traces the next runner segment outward.
    root.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') return leave();
      if ((e.key === 'Enter' || e.key === ' ') && document.activeElement === svg && !finished) {
        e.preventDefault();
        const next = r.nodes.findIndex((_, i) => i > 0 && !work.covered[i] && work.covered[r.parent[i]]);
        if (next > 0) traceStroke(r, work, [r.nodes[r.parent[next]], r.nodes[next]]);
        paint();
        if (digComplete(r, work)) finish(false);
      }
    });
    svg.setAttribute('tabindex', '0');
    notebook.querySelector('.rz-done')!.addEventListener('click', leave);
    root.querySelector('[data-leave]')!.addEventListener('click', leave);
    paint();
    svg.focus({ preventScroll: true });
  });
}

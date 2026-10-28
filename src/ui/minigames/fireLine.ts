import { audio } from '../../audio';
import { ICON } from '../../data/icons';
import { ZONE_NAME } from '../../data/map';
import { FIRE_TICK_MS } from '../../config';
import { services } from '../../services';
import { FIRE_STATE_INFO, fireState, fireTick, fuelAge, zoneOf } from '../../systems/fire';
import {
  FireCellView, FireLineScore, fireLineTap, fireWindow, flamesInView, nativesInView, scoreFireLine, windowCells,
} from '../../systems/minigames/fireLine';
import { mulberry32 } from '../../systems/rng';
import { GameState } from '../../systems/state';
import { windFrom } from '../../systems/weather';
import { renderIcons } from '../icons';
import { burnHistory } from '../targetInfo';
import { minigameShell, stars } from './shell';

export interface FireLineResult extends FireLineScore {
  left: boolean;
}

const GROUND: Record<string, string> = { sand: '#e6d6a8', oak: '#d6c48c', rosemary: '#f3eedf', base: '#d9c59b' };

/** Close-up containment on a 9×9 patch of real ground. The fire keeps moving while you work. */
export function showFireLine(state: GameState, at: { tx: number; ty: number }): Promise<FireLineResult> {
  const view = fireWindow(at.tx, at.ty);
  const before = nativesInView(state, view);
  const burnedBefore = state.fireToday.tiles;
  const rng = mulberry32((Date.now() ^ (at.tx * 977 + at.ty)) >>> 0);
  const age = fuelAge(state, at.tx, at.ty);
  const fstate = fireState(age);
  const advice = FIRE_STATE_INFO[fstate].good
    ? 'This scrub is ready for fire, so letting it burn can be the kind choice. Protect fragile seedlings (marked with a sprout).'
    : 'This ground burned recently. Young sprouts here won’t survive another fire: hold the line!';
  const angle = Math.atan2(state.weather.wind.y, state.weather.wind.x);

  return new Promise((resolve) => {
    const { root, stage, notebook, feedback, close } = minigameShell(
      'fireline',
      { eyebrow: `Wildfire · ${ZONE_NAME[zoneOf(at.tx, at.ty)]}`, title: 'Hold the line', subtitle: `${burnHistory(state, at.tx, at.ty, age)}.` },
      `<div class="fl-grid" style="--cols:${view.w}" role="grid" aria-label="Ground around the fire"></div>`,
      `<div class="fl-advice ${FIRE_STATE_INFO[fstate].good ? 'good' : 'bad'}">${advice}</div>
       <ul class="fl-how">
         <li>${ICON.douse}<span><b>Tap a flame</b> to spray water.</span></li>
         <li>${ICON.rake}<span><b>Tap dry ground</b> ahead of the fire to rake a firebreak (1 energy).</span></li>
       </ul>
       <div class="fl-status"></div>
       <div class="fl-wind"><span class="fl-arrow" style="transform:rotate(${angle}rad)">➜</span><span>Wind from the ${windFrom(state.weather)}. Fire runs downwind.</span></div>
       <div class="fl-result" hidden></div>
       <button class="primary fl-done" hidden>${ICON.done}<span>Back to the scrub</span></button>`,
      'Let it burn',
    );
    const grid = stage.querySelector<HTMLElement>('.fl-grid')!;
    const status = notebook.querySelector<HTMLElement>('.fl-status')!;
    let finished = false;

    // Cells are built once and patched in place, so keyboard focus survives each fire step.
    const cellState = (c: FireCellView) => {
      const bg = c.burning ? '#5a3a28' : c.age < 2 ? '#7a6a5a' : GROUND[c.zone];
      const thing = c.thing ? `<img class="fl-thing" src="${services.icon(c.thing)}" alt=""/>` : '';
      const flame = c.burning ? `<img class="fl-flame" style="--heat:${Math.min(1, 0.5 + c.heat * 0.1)}" src="${services.icon('wildfire')}" alt=""/>` : '';
      const fragile = c.fragile ? `<span class="fl-fragile" aria-hidden="true">${ICON.plant}</span>` : '';
      return {
        cls: `fl-cell${c.burning ? ' burning' : ''}${c.firebreak ? ' break' : ''}${c.age < 2 && !c.burning ? ' burnt' : ''}`,
        style: `--bg:${bg};--fuel:${Math.min(1, c.fuel).toFixed(2)}`,
        label: c.burning ? 'Flame: spray water' : c.firebreak ? 'Firebreak' : c.fuel < 0.06 ? 'Bare ground' : `Dry ground${c.native ? ' with a native plant' : ''}: rake a firebreak`,
        html: renderIcons(`${thing}${fragile}${flame}`),
      };
    };

    let cells: FireCellView[] = [];
    const drawn: string[] = [];
    const paint = () => {
      cells = windowCells(state, view);
      if (!grid.children.length) grid.innerHTML = cells.map((_, i) => `<button class="fl-cell" data-i="${i}"></button>`).join('');
      cells.forEach((c, i) => {
        const v = cellState(c), key = v.cls + v.style + v.html;
        if (drawn[i] === key) return;
        drawn[i] = key;
        const btn = grid.children[i] as HTMLElement;
        btn.className = v.cls;
        btn.setAttribute('style', v.style);
        btn.setAttribute('aria-label', v.label);
        btn.innerHTML = v.html;
      });
      const flames = flamesInView(state, view);
      status.innerHTML = renderIcons(`<span>${ICON.tank} Water ${state.water}/${state.waterMax}</span><span>${ICON.battery} ${Math.round(state.battery)}</span><span>${ICON.fire} ${flames} flame${flames === 1 ? '' : 's'} here</span>`);
      if (flames === 0 && !finished) finish();
    };

    const finish = () => {
      finished = true;
      const score = scoreFireLine(state, view, before, burnedBefore);
      root.querySelector<HTMLElement>('.fl-result')!.hidden = false;
      root.querySelector<HTMLElement>('.fl-result')!.innerHTML = renderIcons(`<h3>Contained!</h3>${stars(score.stars)}<p>${score.saved} native plant${score.saved === 1 ? '' : 's'} safe${score.lost ? `, ${score.lost} lost` : ''}. ${score.burned} patch${score.burned === 1 ? '' : 'es'} burned.</p>`);
      root.querySelector<HTMLElement>('.fl-done')!.hidden = false;
      root.querySelector<HTMLElement>('[data-leave] span')!.textContent = 'Done';
      audio.sfx('rescue');
      root.querySelector<HTMLButtonElement>('.fl-done')!.focus({ preventScroll: true });
    };

    const timer = window.setInterval(() => {
      if (finished || document.hidden || !root.isConnected) return;
      const step = fireTick(state, rng);
      if (step.ignited.length) audio.sfx('ignite', { vol: 0.35 });
      paint();
    }, FIRE_TICK_MS * 0.8);

    const leave = () => {
      window.clearInterval(timer);
      close();
      resolve({ ...scoreFireLine(state, view, before, burnedBefore), left: !finished });
    };
    grid.addEventListener('click', (e) => {
      const btn = (e.target as Element).closest<HTMLElement>('[data-i]');
      if (!btn || finished) return;
      const c = cells[Number(btn.dataset.i)];
      const move = fireLineTap(state, c.tx, c.ty);
      if (move === 'douse') { audio.sfx('douse'); feedback.textContent = 'Psssh. One flame out.'; }
      else if (move === 'rake') { audio.sfx('rake'); feedback.textContent = 'A strip of bare sand: fire can’t cross it.'; }
      else if (move === 'noWater') { audio.sfx('nope'); feedback.textContent = 'The tank is empty. Rake breaks instead, or let it burn.'; }
      else if (move === 'noEnergy') { audio.sfx('nope'); feedback.textContent = 'Out of energy for raking.'; }
      else feedback.textContent = 'Nothing here to burn.';
      paint();
    });
    root.querySelector('[data-leave]')!.addEventListener('click', leave);
    root.querySelector('.fl-done')!.addEventListener('click', leave);
    root.addEventListener('keydown', (e) => e.key === 'Escape' && leave());
    paint();
    (grid.querySelector<HTMLButtonElement>('.burning') ?? grid.querySelector<HTMLButtonElement>('button'))?.focus({ preventScroll: true });
  });
}

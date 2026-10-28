import { speciesName } from '../data/species';
import { ICON } from '../data/icons';
import { services } from '../services';
import { Action, getActions } from '../systems/actions';
import { GameState } from '../systems/state';
import { homeLayout } from '../data/home';
import { trayStage } from '../systems/nursery';
import { overlay } from './overlays';
import { renderIcons } from './icons';

export function showNursery(state: GameState, apply: (action: Action) => Promise<void>): Promise<void> {
  return new Promise(resolve => {
    const { root, close } = overlay('nursery', `<header class="nursery-head"><div><div class="eyebrow">Tiny roots. Big possibilities.</div><h2>Your little nursery</h2><p class="nursery-intro">A little water each day. Two watered nights to grow.<br>Pot up ready seedlings, then plant them outside.</p></div><button class="icon-btn" data-close aria-label="Close">${ICON.close}</button></header><div class="jar-grid"></div><p class="nursery-status" role="status"></p>`);
    let actions: Action[] = [], working = false;
    const paint = () => {
      actions = [];
      root.querySelector('.jar-grid')!.innerHTML = renderIcons(state.trays.map((tray, index) => {
        const stage = trayStage(tray), planted = !!tray.seed;
        const item = homeLayout(state.homeLevel, state.trays.length, state.vases.length).find(it => it.kind === 'slot' && it.index === index)!;
        const options = getActions(state, { type: 'home', item });
        const buttons = options.map(a => { const n = actions.push(a) - 1; return `<button data-action="${n}" ${a.enabled ? '' : 'disabled'} aria-label="${a.label} in jar ${index + 1}">${a.icon} ${a.label}${a.cost ? ` · ${a.cost} energy` : ''}</button>`; }).join('');
        return `<article class="jar-card"><span class="jar-state ${planted && !tray.watered && stage !== 'ready' ? 'thirsty' : ''}">Jar ${index + 1} · ${stage === 'empty' ? 'Ready for a seed' : stage === 'ready' ? 'Ready to plant' : tray.watered ? 'Watered today' : 'Needs water'}</span><img src="${services.icon(`hydro_${stage}_${tray.watered ? 'wet' : 'dry'}`)}" alt="${stage} nursery jar"/><h3>${tray.seed ? speciesName(tray.seed) : 'A new beginning'}</h3><p>${planted ? `${Math.min(2, tray.growth)} / 2 watered nights` : 'Collect seeds from a healthy native.'}</p>${buttons}</article>`;
      }).join(''));
    };
    const done = () => { close(); resolve(); };
    root.querySelector('[data-close]')!.addEventListener('click', done);
    root.addEventListener('keydown', e => { if (e.key === 'Escape') done(); });
    root.addEventListener('click', async e => {
      const button = (e.target as Element).closest<HTMLButtonElement>('[data-action]');
      if (!button || button.disabled || working) return;
      const action = actions[Number(button.dataset.action)];
      if (!action) return;
      working = true;
      try {
        await apply(action);
        root.querySelector('.nursery-status')!.textContent = action.verb === 'water' ? 'A little drink. All set for tonight.' : action.verb === 'pot' ? 'Ready for open sand! Tap your robot outside to plant this seedling.' : 'A new seed, tucked in. Remember its water each day.';
        paint();
      } finally { working = false; }
    });
    paint();
    root.querySelector<HTMLButtonElement>('[data-close]')!.focus({ preventScroll: true });
  });
}

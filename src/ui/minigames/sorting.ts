import { audio } from '../../audio';
import { ICON } from '../../data/icons';
import { services } from '../../services';
import { BINS, BIN_OF, Bin, ITEM_NAME, sortBonus } from '../../systems/minigames/sorting';
import { BagItem } from '../../systems/state';
import { renderIcons } from '../icons';
import { frameLoop, minigameShell } from './shell';

const BELT_SECONDS = 7;
const ITEM_TEX: Record<BagItem, string> = { bottle: 'bottle', can: 'can', fence: 'fence', plastic: 'plastic', tire: 'tire', balloon: 'balloon', bulbil: 'vine_bulbil' };
const WHY: Record<BagItem, string> = {
  bottle: 'Glass bottles melt down into new glass.',
  can: 'Aluminum cans recycle forever.',
  fence: 'Old wire is scrap metal.',
  plastic: 'Plastic bags go with plastic film.',
  tire: 'Tires become playground surfaces.',
  balloon: 'Foil balloons can’t be recycled: seal them away.',
  bulbil: 'Bulbils sprout in compost! Always seal them away.',
};

/** Items ride the belt one at a time: drag each into its bin, or tap the bin. */
export function showSorting(items: BagItem[]): Promise<(Bin | null)[]> {
  const placed: (Bin | null)[] = items.map(() => null);
  return new Promise((resolve) => {
    const { root, stage, notebook, feedback, close } = minigameShell(
      'sort',
      { eyebrow: 'Recycling station', title: 'Sort it out', subtitle: 'Right bin, right future. Careful sorting earns bonus parts.' },
      `<div class="so-belt"><div class="so-track"></div><img class="so-item" alt="" draggable="false"/></div>
       <div class="so-queue"></div>
       <div class="so-bins">${BINS.map((b) => `<button class="so-bin so-${b.id}" data-bin="${b.id}"><b>${b.name}</b><small>${b.note}</small></button>`).join('')}</div>`,
      `<div class="so-score"></div>
       <ul class="mg-tips"><li><b>Drag</b> the item on the belt into a bin, or <b>tap a bin</b>.</li><li>Items that reach the end are recycled without a bonus.</li></ul>
       <div class="so-result" hidden></div>
       <button class="primary so-done" hidden>${ICON.parts}<span>Collect parts</span></button>`,
      'Leave',
    );
    const item = stage.querySelector<HTMLImageElement>('.so-item')!;
    const belt = stage.querySelector<HTMLElement>('.so-belt')!;
    const queue = stage.querySelector<HTMLElement>('.so-queue')!;
    const score = notebook.querySelector<HTMLElement>('.so-score')!;
    let current = 0, progress = 0, correct = 0, done = false;
    let drag: { id: number; dx: number; dy: number } | null = null;

    const paint = () => {
      const it = items[current];
      if (it) {
        item.src = services.icon(ITEM_TEX[it]);
        item.setAttribute('aria-label', ITEM_NAME[it]);
      }
      item.hidden = !it;
      queue.innerHTML = items.slice(current + 1).map((q) => `<img src="${services.icon(ITEM_TEX[q])}" alt="${ITEM_NAME[q]}"/>`).join('');
      score.innerHTML = renderIcons(`${ICON.recycle} <b>${correct}</b> sorted right · ${Math.max(0, items.length - current)} to go`);
    };
    const place = (bin: Bin | null) => {
      const it = items[current];
      if (!it || done) return;
      placed[current] = bin;
      if (bin === BIN_OF[it]) {
        correct++;
        audio.sfx('sortOk');
        feedback.textContent = `${ITEM_NAME[it][0].toUpperCase()}${ITEM_NAME[it].slice(1)}: ${WHY[it]}`;
      } else {
        audio.sfx('sortMiss');
        feedback.textContent = bin ? `Not quite: that ${ITEM_NAME[it]} belongs in ${BINS.find((b) => b.id === BIN_OF[it])!.name}. ${WHY[it]}` : `The ${ITEM_NAME[it]} rolled off the belt. Recycled, no bonus.`;
      }
      current++;
      progress = 0;
      item.style.removeProperty('translate');
      if (current >= items.length) finish();
      paint();
    };
    const finish = () => {
      done = true;
      stop();
      const bonus = sortBonus(correct, items.length);
      const result = notebook.querySelector<HTMLElement>('.so-result')!;
      result.hidden = false;
      result.innerHTML = renderIcons(`<h3>${correct === items.length ? 'Perfectly sorted!' : 'All recycled.'}</h3><p>${ICON.parts} ${items.length} parts${bonus ? ` + ${bonus} bonus` : ''}</p>`);
      notebook.querySelector<HTMLElement>('.so-done')!.hidden = false;
      notebook.querySelector<HTMLButtonElement>('.so-done')!.focus({ preventScroll: true });
    };
    const stop = frameLoop(root, (dt) => {
      if (done || drag) return;
      progress += dt / BELT_SECONDS;
      item.style.left = `${8 + progress * 80}%`;
      if (progress >= 1) place(null);
    });

    stage.querySelector('.so-bins')!.addEventListener('click', (e) => {
      const bin = (e.target as Element).closest<HTMLElement>('[data-bin]')?.dataset.bin as Bin | undefined;
      if (bin) place(bin);
    });
    item.addEventListener('pointerdown', (e) => {
      if (done) return;
      e.preventDefault();
      drag = { id: e.pointerId, dx: e.clientX, dy: e.clientY };
      item.setPointerCapture(e.pointerId);
      item.classList.add('held');
    });
    item.addEventListener('pointermove', (e) => {
      if (!drag || drag.id !== e.pointerId) return;
      item.style.translate = `${e.clientX - drag.dx}px ${e.clientY - drag.dy}px`;
    });
    const drop = (e: PointerEvent) => {
      if (!drag || drag.id !== e.pointerId) return;
      drag = null;
      item.classList.remove('held');
      item.style.visibility = 'hidden';
      const under = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-bin]');
      item.style.visibility = '';
      item.style.removeProperty('translate');
      if (under) place(under.dataset.bin as Bin);
    };
    item.addEventListener('pointerup', drop);
    item.addEventListener('pointercancel', drop);
    const leave = () => {
      stop();
      close();
      resolve(placed);
    };
    notebook.querySelector('.so-done')!.addEventListener('click', leave);
    root.querySelector('[data-leave]')!.addEventListener('click', leave);
    root.addEventListener('keydown', (e) => e.key === 'Escape' && leave());
    belt.setAttribute('aria-label', 'Conveyor belt');
    paint();
    stage.querySelector<HTMLButtonElement>('.so-bin')!.focus({ preventScroll: true });
  });
}

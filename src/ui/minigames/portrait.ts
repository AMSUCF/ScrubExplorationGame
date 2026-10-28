import { audio } from '../../audio';
import { ICON } from '../../data/icons';
import { NativeAnimalId, speciesName } from '../../data/species';
import { services } from '../../services';
import { ANIMAL_HOME } from '../../systems/habitat';
import { POSE_NAME, Shot, animalPose, lensFocus, shotStars } from '../../systems/minigames/portrait';
import { renderIcons } from '../icons';
import { frameLoop, minigameShell, stars } from './shell';

export interface PortraitResult {
  stars: number;
  shots: number;
}

const SIZE: Record<NativeAnimalId, number> = { tortoise: 0.3, mouse: 0.16, jay: 0.21, indigo: 0.38 };
const SCENE_W = 2;
const SCENE_H = 1.4;
const FRAME_H = 2 / 3;
const FILM = 3;

/** A viewfinder over the animal's habitat. Drag to frame it; press the shutter when it's sharp. */
export function showPortrait(species: NativeAnimalId, seed: number): Promise<PortraitResult> {
  const zone = ANIMAL_HOME[species];
  const decor = zone === 'oak' ? ['oak', 'palmetto', 'oak'] : zone === 'rosemary' ? ['rosemary', 'rosemary', 'palmetto'] : ['palmetto', 'rosemary', 'palmetto'];
  return new Promise((resolve) => {
    const { root, stage, notebook, feedback, close } = minigameShell(
      'portrait',
      { eyebrow: 'Wildlife camera · Portrait', title: speciesName(species), subtitle: 'Slow and quiet. Frame it, wait for focus, then click.' },
      `<div class="pt-frame" tabindex="0" aria-label="Viewfinder. Drag or use arrow keys to frame the animal.">
         <div class="pt-scene" style="background-image:url('${services.icon(`ground_${zone}`)}')">
           ${decor.map((d, i) => `<img class="pt-decor" src="${services.icon(d)}" alt="" style="left:${18 + i * 30}%;top:${i % 2 ? 62 : 46}%"/>`).join('')}
           <img class="pt-animal" src="${services.icon(species)}" alt="" style="width:${SIZE[species] * 50}%"/>
         </div>
         <div class="pt-reticle" aria-hidden="true"><i></i><i></i><i></i><i></i><b></b></div>
         <div class="pt-flash"></div>
         <div class="pt-pose" aria-live="polite"></div>
       </div>
       <div class="pt-controls"><div class="pt-focus" aria-hidden="true"><span>Focus</span><div><i></i></div></div>
         <button class="pt-shutter" aria-label="Take the photo">${ICON.camera}</button>
         <div class="pt-film" aria-label="Film left"></div></div>`,
      `<ul class="mg-tips"><li><b>Frame it:</b> drag the view so the animal sits in the center ring.</li>
         <li><b>Wait for focus:</b> the lens breathes in and out. Shoot when the bar is full.</li>
         <li><b>Patience:</b> a ${speciesName(species).toLowerCase()} ${POSE_NAME[species]} earns a bonus.</li></ul>
       <div class="pt-strip"></div>
       <button class="primary pt-done" hidden>${ICON.done}<span>Pin it to the corkboard</span></button>`,
    );
    const frame = stage.querySelector<HTMLElement>('.pt-frame')!;
    const scene = stage.querySelector<HTMLElement>('.pt-scene')!;
    const animal = stage.querySelector<HTMLElement>('.pt-animal')!;
    const poseText = stage.querySelector<HTMLElement>('.pt-pose')!;
    const focusBar = stage.querySelector<HTMLElement>('.pt-focus i')!;
    const film = stage.querySelector<HTMLElement>('.pt-film')!;
    const strip = notebook.querySelector<HTMLElement>('.pt-strip')!;
    let pan = { x: 0.5, y: (SCENE_H - FRAME_H) / 2 };
    let t = 0, shots = 0, best = 0, done = false;
    let drag: { id: number; x: number; y: number; pan: { x: number; y: number } } | null = null;
    let pose = animalPose(species, 0, seed);
    const paintFilm = () => (film.innerHTML = Array.from({ length: FILM }, (_, i) => `<i class="${i < shots ? 'used' : ''}"></i>`).join(''));

    const clampPan = () => {
      pan.x = Math.max(0, Math.min(SCENE_W - 1, pan.x));
      pan.y = Math.max(0, Math.min(SCENE_H - FRAME_H, pan.y));
    };
    const stop = frameLoop(root, (_dt, now) => {
      t = now;
      pose = animalPose(species, t, seed);
      const w = frame.clientWidth;
      scene.style.transform = `translate(${-pan.x * w}px, ${-pan.y * w}px)`;
      scene.style.width = `${SCENE_W * w}px`;
      scene.style.height = `${SCENE_H * w}px`;
      animal.style.left = `${pose.x * 100}%`;
      animal.style.top = `${pose.y * 100}%`;
      animal.style.transform = `translate(-50%, -85%) scaleX(${pose.facing})`;
      animal.classList.toggle('hidden', pose.hidden);
      const focus = lensFocus(t);
      scene.style.filter = `blur(${((1 - focus) * 3.5).toFixed(2)}px)`;
      focusBar.style.width = `${focus * 100}%`;
      focusBar.classList.toggle('sharp', focus > 0.85);
      poseText.textContent = pose.pose && !pose.hidden ? `${POSE_NAME[species]}!` : '';
    });

    const shoot = () => {
      if (done || shots >= FILM) return;
      const shot: Shot = {
        dx: pose.x * SCENE_W - (pan.x + 0.5),
        dy: pose.y * SCENE_H - 0.06 - (pan.y + FRAME_H / 2),
        hidden: pose.hidden,
        focus: lensFocus(t),
        pose: pose.pose,
      };
      const n = shotStars(shot);
      shots++;
      best = Math.max(best, n);
      audio.sfx('shutter');
      if (n >= 2) audio.animal(species, { delay: 0.3, vol: 0.6 });
      frame.classList.remove('flash');
      void frame.offsetWidth;
      frame.classList.add('flash');
      strip.insertAdjacentHTML('beforeend', `<figure class="pt-print"><img src="${services.icon(species)}" alt="" style="${shot.hidden ? 'opacity:.2;' : ''}filter:blur(${((1 - shot.focus) * 2).toFixed(1)}px);transform:translate(${(-shot.dx * 60).toFixed(0)}%, ${(-shot.dy * 60).toFixed(0)}%)"/><figcaption>${stars(n)}</figcaption></figure>`);
      feedback.textContent = n === 3 ? 'A beautiful portrait!' : n === 2 ? 'Lovely! Sharp and well framed.' : n === 1 ? 'Recognizable, at least. Try to center it and wait for focus.' : shot.hidden ? 'It slipped out of sight.' : 'Mostly sand and leaves. Keep it in the ring.';
      paintFilm();
      if (shots >= FILM) finish();
    };
    const finish = () => {
      done = true;
      stop();
      const btn = notebook.querySelector<HTMLButtonElement>('.pt-done')!;
      btn.hidden = false;
      btn.innerHTML = renderIcons(best > 0 ? `${ICON.done}<span>Pin it to the corkboard</span>` : `${ICON.done}<span>Back to the scrub</span>`);
      btn.focus({ preventScroll: true });
    };
    const leave = () => {
      stop();
      close();
      resolve({ stars: best, shots });
    };

    frame.addEventListener('pointerdown', (e) => {
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, pan: { ...pan } };
      frame.setPointerCapture(e.pointerId);
    });
    frame.addEventListener('pointermove', (e) => {
      if (!drag || drag.id !== e.pointerId) return;
      const w = frame.clientWidth;
      pan = { x: drag.pan.x - (e.clientX - drag.x) / w, y: drag.pan.y - (e.clientY - drag.y) / w };
      clampPan();
    });
    const release = (e: PointerEvent) => {
      if (drag?.id === e.pointerId) drag = null;
    };
    frame.addEventListener('pointerup', release);
    frame.addEventListener('pointercancel', release);
    root.addEventListener('keydown', (e) => {
      const step = 0.06;
      const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (moves[e.key]) {
        e.preventDefault();
        pan = { x: pan.x + moves[e.key][0], y: pan.y + moves[e.key][1] };
        clampPan();
      } else if ((e.key === ' ' || e.key === 'Enter') && document.activeElement === frame) {
        e.preventDefault();
        shoot();
      } else if (e.key === 'Escape') leave();
    });
    stage.querySelector('.pt-shutter')!.addEventListener('click', shoot);
    notebook.querySelector('.pt-done')!.addEventListener('click', leave);
    root.querySelector('[data-leave]')!.addEventListener('click', leave);
    paintFilm();
    frame.focus({ preventScroll: true });
  });
}

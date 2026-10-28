// Shared layout for the close-up activities: a header, a square play area and a side notebook.
// Mirrors the vine-care encounter so every mini-game feels like part of the same field kit.
import { ICON } from '../../data/icons';
import { overlay } from '../overlays';

export interface ShellParts {
  root: HTMLElement;
  stage: HTMLElement;
  notebook: HTMLElement;
  feedback: HTMLElement;
  close: () => void;
}

export function minigameShell(kind: string, head: { eyebrow: string; title: string; subtitle: string }, stage: string, notebook: string, leaveLabel = 'Leave'): ShellParts {
  const { root, close } = overlay(
    `mg mg-${kind}`,
    `<header class="mg-header"><div><div class="eyebrow">${head.eyebrow}</div><h2>${head.title}</h2><p class="mg-subtitle">${head.subtitle}</p></div>
       <button class="mg-leave" data-leave aria-label="${leaveLabel}">${ICON.close}<span>${leaveLabel}</span></button></header>
     <div class="mg-layout"><div class="mg-stage">${stage}</div>
       <aside class="mg-notebook">${notebook}<p class="mg-feedback" role="status" aria-live="polite"></p></aside></div>`,
  );
  return {
    root,
    stage: root.querySelector<HTMLElement>('.mg-stage')!,
    notebook: root.querySelector<HTMLElement>('.mg-notebook')!,
    feedback: root.querySelector<HTMLElement>('.mg-feedback')!,
    close,
  };
}

export function stars(n: number, of = 3): string {
  return `<span class="mg-stars" aria-label="${n} of ${of} stars">${'★'.repeat(n)}<span class="dim">${'★'.repeat(Math.max(0, of - n))}</span></span>`;
}

/** Map a pointer event into an SVG's own coordinate space. */
export function svgPoint(svg: SVGSVGElement, e: { clientX: number; clientY: number }): { x: number; y: number } {
  const p = svg.createSVGPoint();
  p.x = e.clientX;
  p.y = e.clientY;
  const local = p.matrixTransform(svg.getScreenCTM()!.inverse());
  return { x: local.x, y: local.y };
}

/** requestAnimationFrame loop that stops when the overlay closes or `stop` is called. */
export function frameLoop(root: HTMLElement, step: (dt: number, t: number) => void): () => void {
  let last = performance.now(), elapsed = 0, running = true;
  const tick = (now: number) => {
    if (!running || !root.isConnected) return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    // Time stands still while the tab is hidden.
    if (!document.hidden) step(dt, (elapsed += dt));
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return () => (running = false);
}

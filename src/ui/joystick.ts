// Floating virtual joystick: touch anywhere that isn't a button and drag.
import { setStick } from './input';

const RADIUS = 52;
const DEAD_ZONE = 0.12;

export function createJoystick(zone: HTMLElement): void {
  const base = document.createElement('div');
  base.className = 'stick-base';
  const knob = document.createElement('div');
  knob.className = 'stick-knob';
  base.appendChild(knob);
  zone.appendChild(base);

  let pointerId: number | null = null;
  let ox = 0;
  let oy = 0;

  const move = (e: PointerEvent) => {
    let dx = e.clientX - ox;
    let dy = e.clientY - oy;
    const len = Math.hypot(dx, dy);
    if (len > RADIUS) {
      dx = (dx / len) * RADIUS;
      dy = (dy / len) * RADIUS;
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const mag = Math.min(1, len / RADIUS);
    if (mag < DEAD_ZONE) setStick(0, 0);
    else setStick(dx / RADIUS, dy / RADIUS);
  };

  const end = (e: PointerEvent) => {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    base.classList.remove('active');
    knob.style.transform = '';
    setStick(0, 0);
  };

  zone.addEventListener('pointerdown', (e) => {
    if (pointerId !== null) return;
    pointerId = e.pointerId;
    zone.setPointerCapture(e.pointerId);
    ox = e.clientX;
    oy = e.clientY;
    base.style.left = `${ox}px`;
    base.style.top = `${oy}px`;
    base.classList.add('active');
    e.preventDefault();
  });
  zone.addEventListener('pointermove', (e) => {
    if (e.pointerId === pointerId) move(e);
  });
  zone.addEventListener('pointerup', end);
  zone.addEventListener('pointercancel', end);
}

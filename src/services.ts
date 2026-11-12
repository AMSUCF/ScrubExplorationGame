// Things shared between Phaser scenes and the DOM UI.
import type { Coach } from './ui/coach';
import type { Hud } from './ui/hud';
import type { IconSource } from './ui/overlays';

export const services: { hud: Hud | null; coach: Coach | null; icon: IconSource; unseenGuide: number } = {
  hud: null,
  coach: null,
  icon: () => '',
  unseenGuide: 0,
};

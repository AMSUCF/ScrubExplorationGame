// Things shared between Phaser scenes and the DOM UI.
import type { Hud } from './ui/hud';
import type { IconSource } from './ui/overlays';

export const services: { hud: Hud | null; icon: IconSource; unseenGuide: number } = {
  hud: null,
  icon: () => '',
  unseenGuide: 0,
};

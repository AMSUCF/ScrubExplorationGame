import { ICON_TEXTURE } from '../data/icons';

// These tokens contain no regexp metacharacters; longest first keeps variation selectors whole.
const TOKEN_PATTERN = new RegExp([...ICON_TEXTURE.keys()].sort((a, b) => b.length - a.length).join('|'), 'gu');

/** Render semantic icon tokens in trusted UI templates; labels remain normal accessible text. */
export function renderIcons(html: string): string {
  return html.replace(TOKEN_PATTERN, (token) => `<img class="pictogram" src="${import.meta.env.BASE_URL}art/${ICON_TEXTURE.get(token)}.png" alt="" aria-hidden="true" draggable="false" />`);
}

import { ICON_TEXTURE } from '../data/icons';
import { services } from '../services';

// These tokens contain no regexp metacharacters; longest first keeps variation selectors whole.
const TOKEN_PATTERN = new RegExp([...ICON_TEXTURE.keys()].sort((a, b) => b.length - a.length).join('|'), 'gu');

/** Render semantic icon tokens in trusted UI templates; labels remain normal accessible text. */
export function renderIcons(html: string): string {
  return html.replace(TOKEN_PATTERN, (token) => {
    const key = ICON_TEXTURE.get(token)!;
    // Delivered pictograms load as files; newer ones fall back to their drawn placeholder.
    const src = services.icon(key) || `${import.meta.env.BASE_URL}art/${key}.png`;
    return `<img class="pictogram" src="${src}" alt="" aria-hidden="true" draggable="false" />`;
  });
}

// Scrub time: short seasons that cycle forever, so there is always a next spring to grow toward.
import { SEASON_DAYS } from '../config';

export type Season = 'spring' | 'summer' | 'fall' | 'winter';

export const SEASONS: Season[] = ['spring', 'summer', 'fall', 'winter'];

export const SEASON_NAME: Record<Season, string> = { spring: 'Spring', summer: 'Summer', fall: 'Fall', winter: 'Winter' };

/** What each season brings, in a sentence for the morning card. */
export const SEASON_NOTE: Record<Season, string> = {
  spring: 'Wildflowers open and the sand dries out. Fires spread easily.',
  summer: 'The wet season: afternoon storms, lightning, and fast-growing weeds.',
  fall: 'Acorns everywhere! Scrub oaks drop extra seeds. Watch for hurricanes.',
  winter: 'Cool, dry and calm: good burn weather. A rare frosty morning slows the iguanas.',
};

export interface CalendarDay {
  year: number;
  season: Season;
  /** 1-based day within the season. */
  dayOfSeason: number;
}

export function calendar(day: number): CalendarDay {
  const d = Math.max(0, day - 1);
  const seasonIndex = Math.floor(d / SEASON_DAYS);
  return { year: Math.floor(seasonIndex / 4) + 1, season: SEASONS[seasonIndex % 4], dayOfSeason: (d % SEASON_DAYS) + 1 };
}

export function seasonOf(day: number): Season {
  return calendar(day).season;
}

/** True on the first morning of a new season (shown as a banner). */
export function isSeasonStart(day: number): boolean {
  return day > 1 && calendar(day).dayOfSeason === 1;
}

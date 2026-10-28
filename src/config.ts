// Shared tuning constants. Everything balance-related lives here so it can be tweaked in one place.

export const TILE = 32;
export const MAP_W = 56;
export const MAP_H = 44;
export const WORLD_W = MAP_W * TILE;
export const WORLD_H = MAP_H * TILE;

/** Pixels from the robot's centre within which it can interact with something. */
export const REACH = 46;

export const ROBOT_SPEED = 120;
export const ROBOT_SPEED_CARRYING = 85;
export const ROBOT_SPEED_EMPTY = 45;

export const BATTERY_START = 100;
export const BATTERY_UPGRADE_AMOUNT = 25;
export const BATTERY_UPGRADE_COST = 4;
export const BATTERY_MAX_UPGRADES = 3;
/** Battery drained per second of driving. */
export const BATTERY_DRIVE_DRAIN = 0.22;

export const BAG_CAPACITY = 6;
export const JAR_CAPACITY = 5;

/** Watered nights a tray needs before its seedling is ready. */
export const GROW_NIGHTS = 2;
export const TRAY_COUNT = 4;

/** Tiles (Chebyshev distance) within which an invasive plant chokes a native. */
export const CHOKE_RADIUS = 2;

export const COGON_SPREAD_CHANCE = 0.3;
export const COGON_MAX_SPREAD_PER_NIGHT = 4;

export const SAVE_KEY = 'scrubbot.save';

// --- Seasons, weather and fire ------------------------------------------------------------

/** Days in each season; a scrub year is four seasons. */
export const SEASON_DAYS = 7;

/** Tile-ages (days since that ground last burned) that sort the scrub into fire states. */
export const FIRE_RECOVER_DAYS = 8;
export const FIRE_READY_DAYS = 20;
export const FIRE_OVERDUE_DAYS = 40;
/** Ground fuel reaches its full load this many days after a fire. */
export const FUEL_FULL_DAYS = 24;
/** Milliseconds between fire spread steps while exploring. */
export const FIRE_TICK_MS = 1400;
/** Base chance (per step, before fuel, moisture and wind) that a flame catches a neighbour. */
export const FIRE_SPREAD = 0.43;
/** Raked firebreaks stay clear of fuel for this many days. */
export const FIREBREAK_DAYS = 4;
export const WATER_TANK = 6;
/** No thickets creep back in during the first few days. */
export const OVERGROWTH_GRACE_DAYS = 5;

/** Invasives keep arriving from the neighbouring land; pressure rises slowly over time. */
export const INCURSION_BASE = 0.8;
export const INCURSION_GROWTH = 0.04;
export const INCURSION_MAX = 3.5;
/** Tiles from the map border where new arrivals land. */
export const EDGE_BAND = 4;
/** Soft caps: a neglected scrub fills up, but never past what a returning player can face. */
export const INVASIVE_SOFT_CAP = 160;
export const COGON_SOFT_CAP = 110;
export const LITTER_SOFT_CAP = 30;

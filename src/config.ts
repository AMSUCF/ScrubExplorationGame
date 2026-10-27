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

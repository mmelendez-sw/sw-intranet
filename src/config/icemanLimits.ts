/**
 * ICEMAN oblique ground-coverage limits shown in the UI.
 * Must match server/iceman.ts — server/__tests__/icemanLimits.test.ts fails if they drift.
 */
export const ICEMAN_DEFAULT_MAX_ROWS = 500;

export const CLOSE_OBLIQUE_MIN_M = 15;
export const CLOSE_OBLIQUE_MAX_M = 50;
export const CLOSE_OBLIQUE_DEFAULT_M = 35;

export const FAR_OBLIQUE_MIN_M = 200;
export const FAR_OBLIQUE_MAX_M = 500;
export const FAR_OBLIQUE_DEFAULT_M = 300;

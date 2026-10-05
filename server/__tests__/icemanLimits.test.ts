import { describe, it, expect } from 'vitest';
import * as server from '../iceman';
import * as ui from '../../src/config/icemanLimits';

describe('ICEMAN limits stay in sync between UI and server', () => {
  it.each([
    'CLOSE_OBLIQUE_MIN_M',
    'CLOSE_OBLIQUE_MAX_M',
    'CLOSE_OBLIQUE_DEFAULT_M',
    'FAR_OBLIQUE_MIN_M',
    'FAR_OBLIQUE_MAX_M',
    'FAR_OBLIQUE_DEFAULT_M',
  ] as const)('%s matches', (name) => {
    expect(server[name]).toBe(ui[name]);
  });

  it('DEFAULT_MAX_ROWS matches ICEMAN_DEFAULT_MAX_ROWS', () => {
    expect(server.DEFAULT_MAX_ROWS).toBe(ui.ICEMAN_DEFAULT_MAX_ROWS);
  });

  it('defaults sit inside their ranges', () => {
    expect(server.CLOSE_OBLIQUE_DEFAULT_M).toBeGreaterThanOrEqual(server.CLOSE_OBLIQUE_MIN_M);
    expect(server.CLOSE_OBLIQUE_DEFAULT_M).toBeLessThanOrEqual(server.CLOSE_OBLIQUE_MAX_M);
    expect(server.FAR_OBLIQUE_DEFAULT_M).toBeGreaterThanOrEqual(server.FAR_OBLIQUE_MIN_M);
    expect(server.FAR_OBLIQUE_DEFAULT_M).toBeLessThanOrEqual(server.FAR_OBLIQUE_MAX_M);
  });
});

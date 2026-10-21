import { it, expect } from 'vitest';
// @ts-expect-error Native Node development entry is JavaScript, with no browser runtime dependency.
import { developmentOptions } from '../scripts/electron-dev.mjs';
it('keeps reloads manual by default and requires explicit HMR/main-restart choices', () => {
  expect(developmentOptions([])).toEqual({ hmr: false, watchMain: false });
  expect(developmentOptions(['--hmr'])).toEqual({ hmr: true, watchMain: false });
  expect(developmentOptions(['--hmr', '--watch-main'])).toEqual({ hmr: true, watchMain: true });
  expect(() => developmentOptions(['--unsafe'])).toThrow();
});

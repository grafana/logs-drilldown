// Jest setup provided by Grafana scaffolding
import { TextDecoder, TextEncoder } from 'util';

// After .config/jest-setup (which stubs HTMLCanvasElement.getContext) so Combobox measureText works in tests
import './.config/jest-setup';
import 'jest-canvas-mock';

import { toEmitValuesWith } from './tests/matchers';

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

expect.extend({
  toEmitValuesWith,
});

// mock the intersection observer and just say everything is in view
const mockIntersectionObserver = jest.fn().mockImplementation((callback) => ({
  disconnect: jest.fn(),
  observe: jest.fn().mockImplementation((elem) => {
    callback([{ isIntersecting: true, target: elem }]);
  }),
  unobserve: jest.fn(),
}));
global.IntersectionObserver = mockIntersectionObserver;

jest.mock('semver/preload', () => ({
  ...jest.requireActual('semver/preload'),
  ltr: () => false,
}));

// @grafana/scenes patchGetAdhocFilters logs via console.log when the Jest env lacks full Grafana APIs.
const nativeConsoleLog = console.log.bind(console);
jest.spyOn(console, 'log').mockImplementation((first, ...rest) => {
  if (typeof first === 'string' && first.includes('Failed to patch getAdhocFilters')) {
    return;
  }
  return nativeConsoleLog(first, ...rest);
});

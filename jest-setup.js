// Jest setup provided by Grafana scaffolding
import { TextDecoder, TextEncoder } from 'util';

import './.config/jest-setup';

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

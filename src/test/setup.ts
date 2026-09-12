/// <reference types="vitest/globals" />
import '@testing-library/jest-dom';

// Node's fetch multipart parser only accepts its own File implementation.
// jsdom installs a window.File in the test environment, which otherwise makes
// upload tests fail before MSW can dispatch the request.
import { File as NodeFile } from 'node:buffer';

Object.defineProperty(globalThis, 'File', {
  configurable: true,
  writable: true,
  value: NodeFile,
});

import { setupServer } from 'msw/node';

// MSW server — starts before all tests, resets handlers between tests, closes after all tests.
export const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

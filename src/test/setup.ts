/// <reference types="vitest/globals" />
import '@testing-library/jest-dom';

// Node's fetch multipart parser only accepts its own File implementation.
// jsdom installs a window.File in the test environment, which otherwise makes
// upload tests fail before MSW can dispatch the request.
//
// The builtin is reached through process.getBuiltinModule() rather than an
// `import ... from 'node:buffer'`. The jsdom test environment is a browser
// environment, so Vite externalises any `node:` import to a browser shim --
// and the shim for node:buffer resolves to a bare `node:` specifier that the
// browser-side runtime cannot load. The result is that EVERY test file fails
// to start with "No such built-in module: node:" before a single test runs.
//
// process.getBuiltinModule() is not an import, so Vite never sees a `node:`
// specifier to externalise, and the real builtin is returned as-is.
// Available since Node 22.3 (the CI image runs 22.22.0).
const { File: NodeFile } = process.getBuiltinModule('buffer') as unknown as {
  File: typeof globalThis.File;
};

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

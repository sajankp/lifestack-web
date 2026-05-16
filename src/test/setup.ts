/// <reference types="vitest/globals" />
import '@testing-library/jest-dom';

import { setupServer } from 'msw/node';

// MSW server — starts before all tests, resets handlers between tests, closes after all tests.
export const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

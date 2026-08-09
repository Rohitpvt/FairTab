import "@testing-library/jest-dom";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// Mock the Vite PWA virtual module
vi.mock("virtual:pwa-register/react", () => {
  return {
    useRegisterSW: () => ({
      offlineReady: [false, vi.fn()],
      needRefresh: [false, vi.fn()],
      updateServiceWorker: vi.fn(),
    }),
  };
});

// Automatically cleanup DOM elements after each test run
afterEach(() => {
  cleanup();
});

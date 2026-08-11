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

// Mock firebase-admin to solve CommonJS/ESM interop in Vitest SSR environment
vi.mock("firebase-admin", async (importOriginal) => {
  const actual: any = await importOriginal();
  const { getFirestore } = await import("firebase-admin/firestore");
  const { getAuth } = await import("firebase-admin/auth");
  const { getApps, initializeApp } = await import("firebase-admin/app");

  const mockAdmin: any = {
    initializeApp: (options?: any) => {
      if (getApps().length > 0) {
        return getApps()[0];
      }
      const projectId = options?.projectId || process.env.GCP_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || "mock-project-id";
      return initializeApp({ projectId, ...options });
    },
    firestore: () => {
      console.log("MOCK FIRESTORE CALL - getApps():", getApps().map(a => a.name));
      if (getApps().length === 0) {
        console.log("MOCK FIRESTORE - no apps, initializing...");
        mockAdmin.initializeApp();
        console.log("MOCK FIRESTORE - after init, getApps():", getApps().map(a => a.name));
      }
      try {
        const db = getFirestore();
        console.log("MOCK FIRESTORE - getFirestore() success");
        return db;
      } catch (err: any) {
        console.error("MOCK FIRESTORE - getFirestore() failed:", err);
        throw err;
      }
    },
    auth: () => {
      if (getApps().length === 0) {
        mockAdmin.initializeApp();
      }
      return getAuth();
    },
    storage: () => {
      return {
        bucket: () => {
          return {
            file: (path: string) => {
              return {
                getMetadata: async () => {
                  if (path.includes("badpath") || path.includes("r-badpath")) {
                    const err: any = new Error("File not found");
                    err.code = 404;
                    throw err;
                  }
                  return [{ size: 1024, contentType: "image/jpeg" }];
                }
              };
            }
          };
        }
      };
    },
    getApps: () => getApps(),
    credential: actual.credential || actual.default?.credential,
    get apps() {
      return getApps();
    }
  };
  return {
    ...mockAdmin,
    default: mockAdmin,
  };
});

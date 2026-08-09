import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import {
  ProtectedRoute,
  PublicOnlyRoute,
  VerifyEmailRoute,
  OnboardingRoute
} from "../features/auth/RouteGuards";

// Mock the useAuth hook
const mockUseAuth = vi.fn();
vi.mock("../features/auth/AuthProvider", () => ({
  useAuth: () => mockUseAuth()
}));

const TestComponent = ({ name }: { name: string }) => <div>{name}</div>;

describe("RouteGuards Authentication State Machine", () => {
  describe("ProtectedRoute", () => {
    test("renders skeleton when initializing or loading profile", () => {
      mockUseAuth.mockReturnValue({ authState: "initializing", error: null });
      render(
        <MemoryRouter initialEntries={["/overview"]}>
          <Routes>
            <Route element={<ProtectedRoute />}>
              <Route path="/overview" element={<TestComponent name="Overview" />} />
            </Route>
          </Routes>
        </MemoryRouter>
      );
      expect(screen.getByText("Resolving secure environment...")).toBeInTheDocument();
    });

    test("redirects unauthenticated users to login", () => {
      mockUseAuth.mockReturnValue({ authState: "unauthenticated", error: null });
      render(
        <MemoryRouter initialEntries={["/overview"]}>
          <Routes>
            <Route element={<ProtectedRoute />}>
              <Route path="/overview" element={<TestComponent name="Overview" />} />
            </Route>
            <Route path="/auth/login" element={<TestComponent name="Login" />} />
          </Routes>
        </MemoryRouter>
      );
      expect(screen.getByText("Login")).toBeInTheDocument();
    });

    test("redirects unverified users to verify email page", () => {
      mockUseAuth.mockReturnValue({ authState: "email-verification-required", error: null });
      render(
        <MemoryRouter initialEntries={["/overview"]}>
          <Routes>
            <Route element={<ProtectedRoute />}>
              <Route path="/overview" element={<TestComponent name="Overview" />} />
            </Route>
            <Route path="/auth/verify-email" element={<TestComponent name="Verify" />} />
          </Routes>
        </MemoryRouter>
      );
      expect(screen.getByText("Verify")).toBeInTheDocument();
    });

    test("redirects unonboarded users to onboarding", () => {
      mockUseAuth.mockReturnValue({ authState: "onboarding-required", error: null });
      render(
        <MemoryRouter initialEntries={["/overview"]}>
          <Routes>
            <Route element={<ProtectedRoute />}>
              <Route path="/overview" element={<TestComponent name="Overview" />} />
            </Route>
            <Route path="/onboarding" element={<TestComponent name="Onboard" />} />
          </Routes>
        </MemoryRouter>
      );
      expect(screen.getByText("Onboard")).toBeInTheDocument();
    });

    test("renders outlet when state is ready", () => {
      mockUseAuth.mockReturnValue({ authState: "ready", error: null });
      render(
        <MemoryRouter initialEntries={["/overview"]}>
          <Routes>
            <Route element={<ProtectedRoute />}>
              <Route path="/overview" element={<TestComponent name="Overview" />} />
            </Route>
          </Routes>
        </MemoryRouter>
      );
      expect(screen.getByText("Overview")).toBeInTheDocument();
    });
  });

  describe("PublicOnlyRoute", () => {
    test("redirects ready users to overview", () => {
      mockUseAuth.mockReturnValue({ authState: "ready", error: null });
      render(
        <MemoryRouter initialEntries={["/auth/login"]}>
          <Routes>
            <Route element={<PublicOnlyRoute />}>
              <Route path="/auth/login" element={<TestComponent name="Login" />} />
            </Route>
            <Route path="/overview" element={<TestComponent name="Overview" />} />
          </Routes>
        </MemoryRouter>
      );
      expect(screen.getByText("Overview")).toBeInTheDocument();
    });

    test("renders login for unauthenticated users", () => {
      mockUseAuth.mockReturnValue({ authState: "unauthenticated", error: null });
      render(
        <MemoryRouter initialEntries={["/auth/login"]}>
          <Routes>
            <Route element={<PublicOnlyRoute />}>
              <Route path="/auth/login" element={<TestComponent name="Login" />} />
            </Route>
          </Routes>
        </MemoryRouter>
      );
      expect(screen.getByText("Login")).toBeInTheDocument();
    });
  });

  describe("VerifyEmailRoute", () => {
    test("redirects ready users to overview", () => {
      mockUseAuth.mockReturnValue({ authState: "ready", error: null });
      render(
        <MemoryRouter initialEntries={["/auth/verify-email"]}>
          <Routes>
            <Route element={<VerifyEmailRoute />}>
              <Route path="/auth/verify-email" element={<TestComponent name="Verify" />} />
            </Route>
            <Route path="/overview" element={<TestComponent name="Overview" />} />
          </Routes>
        </MemoryRouter>
      );
      expect(screen.getByText("Overview")).toBeInTheDocument();
    });

    test("renders verify page for unverified users", () => {
      mockUseAuth.mockReturnValue({ authState: "email-verification-required", error: null });
      render(
        <MemoryRouter initialEntries={["/auth/verify-email"]}>
          <Routes>
            <Route element={<VerifyEmailRoute />}>
              <Route path="/auth/verify-email" element={<TestComponent name="Verify" />} />
            </Route>
          </Routes>
        </MemoryRouter>
      );
      expect(screen.getByText("Verify")).toBeInTheDocument();
    });
  });

  describe("OnboardingRoute", () => {
    test("redirects unauthenticated users to login", () => {
      mockUseAuth.mockReturnValue({ authState: "unauthenticated", error: null });
      render(
        <MemoryRouter initialEntries={["/onboarding"]}>
          <Routes>
            <Route element={<OnboardingRoute />}>
              <Route path="/onboarding" element={<TestComponent name="Onboarding" />} />
            </Route>
            <Route path="/auth/login" element={<TestComponent name="Login" />} />
          </Routes>
        </MemoryRouter>
      );
      expect(screen.getByText("Login")).toBeInTheDocument();
    });

    test("redirects unverified users to verify email", () => {
      mockUseAuth.mockReturnValue({ authState: "email-verification-required", error: null });
      render(
        <MemoryRouter initialEntries={["/onboarding"]}>
          <Routes>
            <Route element={<OnboardingRoute />}>
              <Route path="/onboarding" element={<TestComponent name="Onboarding" />} />
            </Route>
            <Route path="/auth/verify-email" element={<TestComponent name="Verify" />} />
          </Routes>
        </MemoryRouter>
      );
      expect(screen.getByText("Verify")).toBeInTheDocument();
    });

    test("renders onboarding page for onboarding-required state", () => {
      mockUseAuth.mockReturnValue({ authState: "onboarding-required", error: null });
      render(
        <MemoryRouter initialEntries={["/onboarding"]}>
          <Routes>
            <Route element={<OnboardingRoute />}>
              <Route path="/onboarding" element={<TestComponent name="Onboarding" />} />
            </Route>
          </Routes>
        </MemoryRouter>
      );
      expect(screen.getByText("Onboarding")).toBeInTheDocument();
    });
  });
});

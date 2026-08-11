
import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import App from "../App";
import { ThemeToggle } from "../components/feedback/FeedbackStates";

// Mock resize observer since JSDOM doesn't support it
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

vi.mock("../features/auth/AuthProvider", () => {
  return {
    useAuth: () => ({
      user: { uid: "test-user", email: "test@example.com" },
      profile: { displayName: "FairTab User", onboardingCompleted: true },
      authState: "ready",
      error: null,
      trustedDevice: false,
      setTrustedDevicePreference: vi.fn(),
      refreshProfile: vi.fn(),
      signOut: vi.fn(),
      bootstrapProfile: vi.fn()
    }),
    AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>
  };
});

describe("App Shell and Layout", () => {
  beforeEach(() => {
    // Reset location hash before each test
    window.location.hash = "#/overview";
  });

  test("renders AppShell title and brand logo on desktop", async () => {
    render(<App />);

    // Wait for OverviewPage lazy component to load
    await screen.findByText("Recent Transactions");

    // Verify Brand Logo initials is rendered
    const brandInitials = screen.getAllByText("FT");
    expect(brandInitials.length).toBeGreaterThan(0);

    // Verify page context title is displayed
    expect(screen.getByText("Dashboard Overview")).toBeInTheDocument();
  });

  test("toggles sidebar collapsed state when clicking trigger", async () => {
    render(<App />);
    await screen.findByText("Recent Transactions");

    // Get the collapse button by its aria-label
    const toggleBtn = screen.getByLabelText("Collapse sidebar");
    expect(toggleBtn).toBeInTheDocument();

    // Toggle collapse
    fireEvent.click(toggleBtn);

    // Verify it changed to expand button
    expect(screen.getByLabelText("Expand sidebar")).toBeInTheDocument();
  });

  test("navigates through desktop menu links", async () => {
    render(<App />);
    await screen.findByText("Recent Transactions");

    // Get the first link for Groups (from desktop sidebar) and click it
    const groupsLink = screen.getAllByRole("link", { name: /groups/i })[0];
    expect(groupsLink).toBeInTheDocument();

    fireEvent.click(groupsLink);

    // Content should transition to groups — header title updates after route change
    // Use extended timeout for heavy JSDOM re-renders with lazy-loaded routes
    const groupsTitle = await screen.findByText("My Groups", {}, { timeout: 5000 });
    expect(groupsTitle).toBeInTheDocument();
  });

  test("displays mobile navigation tabs", async () => {
    render(<App />);
    await screen.findByText("Recent Transactions");

    // Mobile tabs should be in the document
    expect(screen.getAllByRole("link", { name: /home/i })[0]).toBeInTheDocument();
    expect(screen.getByLabelText("Add new expense")).toBeInTheDocument();
  });
});

describe("Theme Toggle and Persistence", () => {
  test("toggles theme and updates localStorage", () => {
    // Start fresh
    localStorage.removeItem("theme");

    render(<ThemeToggle />);

    const toggleBtn = screen.getByRole("button", { name: /switch to/i });
    expect(toggleBtn).toBeInTheDocument();

    // Default theme is dark
    expect(localStorage.getItem("theme")).toBe("dark");

    // Click to toggle to light
    fireEvent.click(toggleBtn);
    expect(localStorage.getItem("theme")).toBe("light");
    expect(document.documentElement.classList.contains("light")).toBe(true);

    // Toggle back to dark
    fireEvent.click(toggleBtn);
    expect(localStorage.getItem("theme")).toBe("dark");
    expect(document.documentElement.classList.contains("light")).toBe(false);
  });
});

describe("Routing and Fallback 404", () => {
  test("displays 404 page for unknown routes", async () => {
    window.location.hash = "#/this-route-does-not-exist";
    render(<App />);

    // Wait for the lazy-loaded NotFoundPage to mount
    const errorHeading = await screen.findByText("Page Not Found");
    expect(errorHeading).toBeInTheDocument();
    expect(screen.getByText(/Return to Dashboard/i)).toBeInTheDocument();
  });
});

describe("App Action Context Dialog", () => {
  test("opens and closes Add Expense dialog via context hook actions", async () => {
    window.location.hash = "#/overview";
    render(<App />);

    // Wait for the lazy component to load
    await screen.findByText("Recent Transactions");

    // Dialog should not be in document initially
    expect(screen.queryByText("Record a new transaction to split with your group members.")).not.toBeInTheDocument();

    // Click "New Expense" button which calls openAddExpense() from context hook
    const newExpenseBtn = screen.getByRole("button", { name: "New Expense" });
    fireEvent.click(newExpenseBtn);

    // Dialog title and description should mount
    expect(await screen.findByText("Add Shared Expense")).toBeInTheDocument();
    expect(screen.getByText("Record a new transaction to split with your group members.")).toBeInTheDocument();

    // Click cancel to close it
    const cancelBtn = screen.getByRole("button", { name: "Cancel" });
    fireEvent.click(cancelBtn);

    // Dialog should unmount or be hidden
    await waitFor(() => {
      expect(screen.queryByText("Record a new transaction to split with your group members.")).not.toBeInTheDocument();
    });
  });
});

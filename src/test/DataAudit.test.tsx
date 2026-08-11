import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OverviewPage } from "../features/dashboard/OverviewPage";
import { ExpensesPage } from "../features/expenses/ExpensesPage";
import { NotificationsPage } from "../features/notifications/NotificationsPage";
import { ThemeToggle } from "../components/feedback/FeedbackStates";

// Mock providers and Auth
vi.mock("../features/auth/AuthProvider", () => ({
  useAuth: () => ({
    user: { uid: "test-uid-123", email: "audit@example.com", displayName: "Audit User" },
  }),
}));

vi.mock("../app/providers/AppActionProvider", () => ({
  useAppActions: () => ({
    openAddExpense: vi.fn(),
  }),
}));

// Mock firebase services
vi.mock("../infrastructure/firebase/groupService", () => ({
  groupService: {
    watchUserGroups: vi.fn((cb) => {
      // Mock returning empty group list
      cb([]);
      return vi.fn();
    }),
  },
}));

vi.mock("../infrastructure/firebase/expenseService", () => ({
  expenseService: {
    watchExpenses: vi.fn((_groupId, cb) => {
      cb([]);
      return vi.fn();
    }),
  },
}));

vi.mock("../infrastructure/firebase/settlementService", () => ({
  settlementService: {
    watchSettlements: vi.fn((_groupId, cb) => {
      cb([]);
      return vi.fn();
    }),
  },
}));

describe("Production Dynamic Data Audit", () => {
  test("1. Brand-new empty account shows genuine zero-data empty state with no mock fallbacks", () => {
    render(<OverviewPage />);
    
    // Check for ₹0 total balances
    const zeroBalances = screen.getAllByText(/₹0\.00/i);
    expect(zeroBalances.length).toBeGreaterThanOrEqual(3);

    // Insight card should reflect 0 groups
    expect(screen.getByText("0 Groups")).toBeInTheDocument();

    // Verify empty state is displayed
    expect(screen.getByText("No Transactions Logged")).toBeInTheDocument();
    expect(screen.getByText("Any shared group expenses or recorded settlements will reflect here.")).toBeInTheDocument();
  });

  test("2. Expenses page shows genuine zero-data empty state for fresh user", () => {
    render(<ExpensesPage />);

    expect(screen.getByText("No Expenses Logged")).toBeInTheDocument();
    expect(screen.getByText("No shared group expenses have been recorded yet.")).toBeInTheDocument();
    expect(screen.queryByText("Demo Empty List")).not.toBeInTheDocument();
    expect(screen.queryByText("Restore Data")).not.toBeInTheDocument();
  });

  test("3. Notifications page displays truthful empty state with no fake local mutations", () => {
    render(<NotificationsPage />);

    expect(screen.getByText("Clean Slate")).toBeInTheDocument();
    expect(screen.getByText("You have no notifications or activity log items at the moment.")).toBeInTheDocument();
    expect(screen.queryByText("Mark All Read")).not.toBeInTheDocument();
    expect(screen.queryByText("Clear")).not.toBeInTheDocument();
  });

  test("4. Theme toggles correctly and sets mutual-exclusivity classes on document root", () => {
    // Clear localStorage values
    localStorage.removeItem("fairtab:theme");
    localStorage.removeItem("theme");

    // Trigger matchMedia mock if needed
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query.includes("dark"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
    }));

    render(<ThemeToggle />);
    expect(localStorage.getItem("fairtab:theme")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.classList.contains("light")).toBe(false);

    // Toggle once
    const toggleBtn = screen.getByRole("button");
    fireEvent.click(toggleBtn);
    expect(localStorage.getItem("fairtab:theme")).toBe("light");
    expect(document.documentElement.classList.contains("light")).toBe(true);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});

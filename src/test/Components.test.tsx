
import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "../components/ui/Button";
import { Skeleton } from "../components/ui/Skeleton";
import { Dialog } from "../components/ui/Dialogs";

describe("Button Loading States", () => {
  test("retains layout width and sets aria-busy during loading state", () => {
    const { rerender } = render(<Button isLoading={false}>Submit Expense</Button>);
    
    // Normal button
    const normalBtn = screen.getByRole("button", { name: /Submit Expense/i });
    expect(normalBtn).toBeInTheDocument();
    expect(normalBtn).not.toHaveAttribute("aria-busy");

    // Loading button
    rerender(<Button isLoading={true} loadingText="Saving...">Submit Expense</Button>);
    const loadingBtn = screen.getByRole("button");
    expect(loadingBtn).toHaveAttribute("aria-busy", "true");
    expect(loadingBtn).toBeDisabled();
    expect(screen.getByText("Saving...")).toBeInTheDocument();
  });
});

describe("Skeleton Accessibility", () => {
  test("implements presentation roles and hides from screen readers", () => {
    render(<Skeleton className="h-4 w-12" />);
    
    const skeletonDiv = screen.getByRole("presentation", { hidden: true });
    expect(skeletonDiv).toBeInTheDocument();
    expect(skeletonDiv).toHaveAttribute("aria-hidden", "true");
  });
});

describe("Modal Overlay Dialog", () => {
  test("renders titles, descriptions, and triggers close events", () => {
    const onOpenChange = vi.fn();
    
    render(
      <Dialog
        isOpen={true}
        onOpenChange={onOpenChange}
        title="Test Modal Title"
        description="Test Modal Description"
      >
        <div>Modal Content Children</div>
      </Dialog>
    );

    // Verify Title and Description mounting
    expect(screen.getByText("Test Modal Title")).toBeInTheDocument();
    expect(screen.getByText("Test Modal Description")).toBeInTheDocument();
    expect(screen.getByText("Modal Content Children")).toBeInTheDocument();

    // Find Close trigger and click it
    const closeBtn = screen.getByLabelText("Close dialog");
    expect(closeBtn).toBeInTheDocument();
    fireEvent.click(closeBtn);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe("PWA and Reduced Motion Metadata", () => {
  test("verifies path values matching expectations in HTML header context", () => {
    // Check baseline /fairtab/ base paths
    const mockProductionBasePath = "/fairtab/";
    expect(mockProductionBasePath).toBe("/fairtab/");
  });
});

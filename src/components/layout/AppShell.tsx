import React, { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { Toaster, toast } from "sonner";
import { Sidebar } from "./Sidebar";
import { TopHeader } from "./TopHeader";
import { MobileNavigation } from "./MobileNavigation";
import { OfflineBanner } from "../feedback/FeedbackStates";
import { PwaUpdatePrompt } from "../feedback/PwaUpdatePrompt";
import { CommandPalette } from "../ui/CommandPalette";
import { Dialog } from "../ui/Dialogs";
import { Button } from "../ui/Button";
import { useAppActions, useAppState } from "../../app/providers/AppActionProvider";

// Isolated dialog component to prevent AppShell and active routes from re-rendering when open state changes
const AddExpenseDialog: React.FC = () => {
  const { isAddExpenseOpen } = useAppState();
  const { closeAddExpense } = useAppActions();
  
  // Local form inputs
  const [expTitle, setExpTitle] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleMockAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expTitle || !expAmount) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      closeAddExpense();
      setExpTitle("");
      setExpAmount("");
      toast.success(`Expense "${expTitle}" added successfully!`, {
        description: "It has been queued for sync (simulated).",
      });
    }, 1200);
  };

  return (
    <Dialog
      isOpen={isAddExpenseOpen}
      onOpenChange={(open) => { if (!open) closeAddExpense(); }}
      title="Add Shared Expense"
      description="Record a new transaction to split with your group members."
      footer={
        <div className="flex gap-2 w-full justify-end">
          <Button variant="ghost" onClick={closeAddExpense} size="sm">
            Cancel
          </Button>
          <Button
            variant="gradient"
            onClick={handleMockAddExpense}
            isLoading={isSubmitting}
            loadingText="Saving..."
            size="sm"
          >
            Add Expense
          </Button>
        </div>
      }
    >
      <form onSubmit={handleMockAddExpense} className="flex flex-col gap-4 mt-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="exp-title" className="text-xs font-semibold text-text-secondary">
            Expense Title *
          </label>
          <input
            id="exp-title"
            type="text"
            required
            autoFocus
            placeholder="e.g. Flight tickets, Groceries"
            value={expTitle}
            onChange={(e) => setExpTitle(e.target.value)}
            className="px-3.5 py-2.5 bg-surface-primary border border-white/10 rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent-cyan"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="exp-amount" className="text-xs font-semibold text-text-secondary">
              Amount (₹) *
            </label>
            <input
              id="exp-amount"
              type="number"
              required
              min="1"
              placeholder="e.g. 1500"
              value={expAmount}
              onChange={(e) => setExpAmount(e.target.value)}
              className="px-3.5 py-2.5 bg-surface-primary border border-white/10 rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent-cyan financial-number"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="exp-group" className="text-xs font-semibold text-text-secondary">
              Select Group
            </label>
            <select
              id="exp-group"
              className="px-3.5 py-2.5 bg-surface-primary border border-white/10 rounded-lg text-sm text-text-secondary focus:outline-none focus:border-accent-cyan cursor-pointer"
            >
              <option value="group-1">Himalayan Expedition 2026</option>
              <option value="group-2">Apartment 4B Groceries & Rent</option>
              <option value="group-3">Weekend Goa Trip</option>
            </select>
          </div>
        </div>
      </form>
    </Dialog>
  );
};

export const AppShell: React.FC = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  
  const { openAddExpense } = useAppActions();
  
  const navigate = useNavigate();
  const location = useLocation();

  // Map route path to human-readable title
  const getHeaderTitle = () => {
    const path = location.pathname;
    if (path === "/overview") return "Dashboard Overview";
    if (path === "/groups") return "My Groups";
    if (path === "/expenses") return "All Expenses";
    if (path === "/settlements") return "Debt Settlements";
    if (path === "/analytics") return "Spending Analytics";
    if (path === "/budgets") return "Group Budgets";
    if (path === "/recurring") return "Recurring Bills";
    if (path === "/notifications") return "Recent Activity & Notifications";
    if (path === "/settings") return "Account Settings";
    return "FairTab";
  };

  return (
    <div className="flex flex-col min-h-screen text-text-primary app-background selection:bg-accent-cyan/30">
      {/* Toast Announcements */}
      <Toaster
        theme="dark"
        position="top-right"
        toastOptions={{
          className: "glass-elevated border border-white/10 text-text-primary rounded-xl p-4 shadow-xl",
          descriptionClassName: "text-text-muted text-xs mt-1",
        }}
      />

      {/* Offline and SW Update Prompts */}
      <OfflineBanner />
      <PwaUpdatePrompt />

      {/* Navigation Command Palette */}
      <CommandPalette
        isOpen={isSearchOpen}
        onOpenChange={setIsSearchOpen}
        onNavigate={navigate}
      />

      <div className="flex flex-1 w-full min-h-0">
        {/* Desktop Sidebar (Collapsible) */}
        <Sidebar
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />

        {/* Main layout container */}
        <div className="flex-1 flex flex-col min-w-0 pb-[80px] md:pb-0">
          {/* Top Header details */}
          <TopHeader title={getHeaderTitle()} onSearchClick={() => setIsSearchOpen(true)} />

          {/* Dynamic page content slot */}
          <main className="flex-grow overflow-x-hidden">
            <Outlet />
          </main>
        </div>
      </div>

      {/* Mobile Navigation bar */}
      <MobileNavigation onAddClick={openAddExpense} />

      {/* Isolated Mock Add Expense Dialog */}
      <AddExpenseDialog />
    </div>
  );
};
export default AppShell;

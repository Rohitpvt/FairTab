import React, { useState, useEffect } from "react";
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
import { groupService } from "../../infrastructure/firebase/groupService";
import type { UserGroupIndexDocument } from "../../features/groups/userGroupIndexSchema";

// Isolated dialog component to prevent AppShell and active routes from re-rendering when open state changes
const AddExpenseDialog: React.FC = () => {
  const { isAddExpenseOpen } = useAppState();
  const { closeAddExpense } = useAppActions();
  const navigate = useNavigate();

  // Local state
  const [groups, setGroups] = useState<UserGroupIndexDocument[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);

  useEffect(() => {
    const unsubscribe = groupService.watchUserGroups((userGroups) => {
      const activeGroups = userGroups.filter((g) => g.status === "active");
      setGroups(activeGroups);
      if (activeGroups.length > 0) {
        setSelectedGroupId(activeGroups[0].groupId);
      } else {
        setSelectedGroupId("");
      }
      setIsLoadingGroups(false);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const handleNavigateToAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroupId) {
      toast.error("Please select a group first.");
      return;
    }
    closeAddExpense();
    navigate(`/groups/${selectedGroupId}/expenses/new`);
  };

  return (
    <Dialog
      isOpen={isAddExpenseOpen}
      onOpenChange={(open) => { if (!open) closeAddExpense(); }}
      title="Add Shared Expense"
      description="Select one of your active groups to record a new transaction."
      footer={
        <div className="flex gap-2 w-full justify-end">
          <Button variant="ghost" onClick={closeAddExpense} size="sm">
            Cancel
          </Button>
          <Button
            variant="gradient"
            onClick={handleNavigateToAddExpense}
            disabled={groups.length === 0 || isLoadingGroups}
            size="sm"
          >
            Continue
          </Button>
        </div>
      }
    >
      <form onSubmit={handleNavigateToAddExpense} className="flex flex-col gap-4 mt-2">
        <div className="flex flex-col gap-1.5 font-sans">
          <label htmlFor="exp-group" className="text-xs font-semibold text-text-secondary">
            Select Splitting Group
          </label>
          {isLoadingGroups ? (
            <div className="px-3.5 py-2.5 bg-surface-primary border border-white/10 rounded-lg text-sm text-text-muted animate-pulse">
              Loading groups...
            </div>
          ) : groups.length === 0 ? (
            <div className="flex flex-col gap-2">
              <div className="px-3.5 py-2.5 bg-surface-primary border border-danger/20 rounded-lg text-sm text-danger font-semibold">
                Create a group first
              </div>
              <Button
                variant="secondary"
                size="sm"
                autoFocus
                onClick={() => {
                  closeAddExpense();
                  navigate("/groups/new");
                }}
              >
                Create New Group
              </Button>
            </div>
          ) : (
            <select
              id="exp-group"
              autoFocus
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="px-3.5 py-2.5 bg-surface-primary border border-white/10 rounded-lg text-sm text-text-secondary focus:outline-none focus:border-accent-cyan cursor-pointer w-full font-sans"
            >
              {groups.map((g) => (
                <option key={g.groupId} value={g.groupId}>
                  {g.groupName}
                </option>
              ))}
            </select>
          )}
        </div>
      </form>
    </Dialog>
  );
};

export const AppShell: React.FC = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  
  const { isAddExpenseOpen } = useAppState();
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
    <div className="flex flex-col min-h-screen text-text-primary app-background selection:bg-accent-cyan/30 relative">
      {/* Liquid Ambient Light Blobs */}
      <div className="bg-mesh-container">
        <div className="ambient-blob ambient-blob-1" />
        <div className="ambient-blob ambient-blob-2" />
        <div className="ambient-blob ambient-blob-3" />
      </div>

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
      {isAddExpenseOpen && <AddExpenseDialog />}
    </div>
  );
};
export default AppShell;

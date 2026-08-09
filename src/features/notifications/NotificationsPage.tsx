import React, { useState } from "react";
import { toast } from "sonner";
import { Bell, CheckCheck, Trash2, ShieldAlert, Sparkles, UserPlus } from "lucide-react";
import { PageContainer } from "../../components/layout/PageContainer";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/feedback/FeedbackStates";
import { MOCK_NOTIFICATIONS } from "../../mocks/mockData";

export const NotificationsPage: React.FC = () => {
  const [items, setItems] = useState(MOCK_NOTIFICATIONS);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const unreadCount = items.filter((x) => !x.read).length;

  const handleMarkAllRead = () => {
    setItems((prev) => prev.map((x) => ({ ...x, read: true })));
    toast.success("All notifications marked as read.");
  };

  const handleClearAll = () => {
    setItems([]);
    toast.success("Activity log cleared.");
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "invite":
        return <UserPlus className="h-4.5 w-4.5 text-accent-indigo" />;
      case "sync_failed":
        return <ShieldAlert className="h-4.5 w-4.5 text-danger" />;
      case "expense_created":
        return <Sparkles className="h-4.5 w-4.5 text-accent-cyan" />;
      default:
        return <Bell className="h-4.5 w-4.5 text-text-secondary" />;
    }
  };

  const displayItems = filter === "all" ? items : items.filter((x) => !x.read);

  return (
    <PageContainer
      title="Notifications & Activity"
      description="Stay updated with invitations, sync warnings, and split additions."
      action={
        items.length > 0 ? (
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={handleMarkAllRead} className="flex gap-1.5">
              <CheckCheck className="h-4 w-4" />
              Mark All Read
            </Button>
            <Button variant="ghost" size="sm" onClick={handleClearAll} className="flex gap-1.5 text-danger hover:bg-danger/5">
              <Trash2 className="h-4 w-4" />
              Clear
            </Button>
          </div>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-5">
        {/* Toggle selector */}
        <div className="flex items-center gap-2 border-b border-white/5 pb-2">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer ${
              filter === "all" ? "bg-accent-indigo text-text-primary" : "text-text-muted hover:text-text-primary"
            }`}
          >
            All Logs ({items.length})
          </button>
          <button
            onClick={() => setFilter("unread")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer ${
              filter === "unread" ? "bg-accent-indigo text-text-primary" : "text-text-muted hover:text-text-primary"
            }`}
          >
            Unread ({unreadCount})
          </button>
        </div>

        {displayItems.length === 0 ? (
          <EmptyState
            title="Clean Slate"
            description="You have no notifications or activity log items at the moment."
            icon={<Bell className="h-8 w-8 text-text-muted" />}
          />
        ) : (
          <div className="flex flex-col gap-3">
            {displayItems.map((item) => (
              <GlassPanel
                key={item.id}
                variant="subtle"
                className={`p-4 flex items-start justify-between gap-4 border-l-2 ${
                  !item.read ? "border-l-accent-cyan bg-white/[0.04]" : "border-l-transparent"
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="p-2.5 rounded-lg bg-surface-elevated shrink-0 mt-0.5">
                    {getIcon(item.type)}
                  </div>
                  <div className="min-w-0">
                    <h4 className={`text-xs font-semibold leading-tight ${!item.read ? "text-text-primary" : "text-text-secondary"}`}>
                      {item.title}
                    </h4>
                    <p className="text-[11px] text-text-muted mt-1 leading-normal">
                      {item.body}
                    </p>
                  </div>
                </div>
                <span className="text-[10px] text-text-muted shrink-0 ml-2 font-medium">
                  {item.date}
                </span>
              </GlassPanel>
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
};
export default NotificationsPage;

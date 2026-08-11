import React from "react";
import { Bell } from "lucide-react";
import { PageContainer } from "../../components/layout/PageContainer";
import { EmptyState } from "../../components/feedback/FeedbackStates";

export const NotificationsPage: React.FC = () => {
  return (
    <PageContainer
      title="Notifications & Activity"
      description="Stay updated with invitations, sync warnings, and split additions."
    >
      <div className="flex flex-col gap-5">
        <EmptyState
          title="Clean Slate"
          description="You have no notifications or activity log items at the moment."
          icon={<Bell className="h-8 w-8 text-text-muted" />}
        />
      </div>
    </PageContainer>
  );
};
export default NotificationsPage;

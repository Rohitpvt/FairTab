import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Users, ArrowRight, Calendar, UserCheck } from "lucide-react";
import { PageContainer } from "../../components/layout/PageContainer";
import { groupService } from "../../infrastructure/firebase/groupService";
import type { UserGroupIndexDocument } from "./userGroupIndexSchema";
import { Button } from "../../components/ui/Button";
import { GroupCardSkeleton } from "../../components/ui/Skeleton";
import { EmptyState } from "../../components/feedback/FeedbackStates";

export const GroupsPage: React.FC = () => {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<UserGroupIndexDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = groupService.watchUserGroups((data) => {
      setGroups(data);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (isLoading) {
    return (
      <PageContainer title="Groups" description="Retrieving your expense sharing groups...">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <GroupCardSkeleton />
          <GroupCardSkeleton />
          <GroupCardSkeleton />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Groups"
      description="Collaborative expense groups with friends, roommates, and events."
      action={
        <Button
          onClick={() => navigate("/groups/new")}
          variant="gradient"
          size="sm"
          className="flex items-center gap-1.5"
        >
          <Plus className="h-4 w-4" />
          Create Group
        </Button>
      }
    >
      {groups.length === 0 ? (
        <EmptyState
          title="No Groups Found"
          description="Create your first expense splitting group to start sharing receipts, rent, bills, or travel expenditures with friends."
          actionText="Create Group"
          onAction={() => navigate("/groups/new")}
          icon={<Users className="h-8 w-8 text-accent-cyan" />}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map((group) => (
            <div
              key={group.groupId}
              className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-md transition-all duration-300 hover:border-white/20 hover:bg-white/[0.06] hover:shadow-lg hover:shadow-accent-cyan/5 group"
            >
              {/* Top Row: Icon/Indicator */}
              <div className="flex justify-between items-start mb-4">
                <div className="p-2.5 bg-white/5 rounded-xl border border-white/5 group-hover:border-white/10">
                  <Users className="h-5 w-5 text-accent-cyan" />
                </div>
                {group.status === "archived" && (
                  <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-warning/10 border border-warning/20 text-warning">
                    Archived
                  </span>
                )}
              </div>

              {/* Title & Role */}
              <h3 className="text-lg font-bold text-text-primary mb-1 group-hover:text-accent-cyan transition-colors">
                {group.groupName}
              </h3>
              <div className="flex items-center gap-1 text-xs text-text-muted mb-6">
                <UserCheck className="h-3 w-3 text-accent-indigo" />
                <span className="capitalize">{group.role}</span>
              </div>

              {/* Bottom Row: Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-white/5">
                <div className="flex items-center gap-1.5 text-xs text-text-muted">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>
                    {(group.latestActivityAt as { seconds: number })?.seconds
                      ? new Date((group.latestActivityAt as { seconds: number }).seconds * 1000).toLocaleDateString()
                      : "Recent"}
                  </span>
                </div>
                <Link
                  to={`/groups/${group.groupId}`}
                  className="flex items-center gap-1 text-xs font-semibold text-accent-cyan hover:underline"
                >
                  View Details
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </PageContainer>
  );
};

export default GroupsPage;

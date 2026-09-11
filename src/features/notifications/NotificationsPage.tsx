/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from "react";
import { Bell, UserPlus, Check, X, CheckCircle, XCircle, Smartphone, Settings, Send } from "lucide-react";
import { Link } from "react-router-dom";
import { PageContainer } from "../../components/layout/PageContainer";
import { EmptyState } from "../../components/feedback/FeedbackStates";
import { auth, db } from "../../infrastructure/firebase/firebase";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { fairtabApi } from "../../infrastructure/api/fairtabApi";
import { Button } from "../../components/ui/Button";
import { NotificationItemSkeleton } from "../../components/ui/Skeleton";
import { toast } from "sonner";
import { webNotificationService } from "../../infrastructure/notifications/webNotificationService";

interface NotificationItem {
  id: string;
  type: "join_request" | "join_request_approved" | "join_request_declined";
  status: "pending" | "approved" | "declined" | "read";
  groupId: string;
  groupName: string;
  applicantUid?: string;
  applicantName?: string;
  requestedRole?: string;
  createdAt?: any;
}

export const NotificationsPage: React.FC = () => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(() => !!auth.currentUser);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const currentUser = auth.currentUser;

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    const q = query(
      collection(db, `users/${currentUser.uid}/notifications`),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: NotificationItem[] = [];
        snapshot.forEach((doc) => {
          items.push({ id: doc.id, ...doc.data() } as NotificationItem);
        });
        setNotifications(items);
        setIsLoading(false);
      },
      (error) => {
        console.error("Error listening to notifications:", error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  const handleApprove = async (notif: NotificationItem) => {
    if (!notif.applicantUid) return;
    setProcessingId(`${notif.id}_approve`);
    try {
      const res: any = await fairtabApi.invitations.approveJoinRequest({
        groupId: notif.groupId,
        applicantUid: notif.applicantUid,
      });
      if (res && res.status === "cleared") {
        toast.info("Stale join request was already resolved and cleaned up.");
      } else {
        toast.success(`Approved ${notif.applicantName || "join request"}!`);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to approve join request.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (notif: NotificationItem) => {
    if (!notif.applicantUid) return;
    setProcessingId(`${notif.id}_decline`);
    try {
      const res: any = await fairtabApi.invitations.declineJoinRequest({
        groupId: notif.groupId,
        applicantUid: notif.applicantUid,
      });
      if (res && res.status === "cleared") {
        toast.info("Stale join request was already resolved and cleaned up.");
      } else {
        toast.success(`Declined ${notif.applicantName || "join request"}.`);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to decline join request.");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <PageContainer
      title="Notifications"
      description="Manage join requests, approvals, and split-ledger activity."
    >
      <div className="flex flex-col gap-4 max-w-2xl mx-auto w-full mt-4">
        {/* Phone & Browser Push Notifications quick status card */}
        <div className="glass-standard border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-accent-indigo/15 text-accent-indigo dark:text-accent-cyan border border-accent-indigo/25 shrink-0">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-text-primary">
                Phone Screen & Push Notifications
              </h4>
              <p className="text-[11px] text-text-muted">
                Receive instant alerts for budget spikes, new expenses & payments
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                const perm = await webNotificationService.requestPermission();
                if (perm === "granted") {
                  await webNotificationService.sendTestNotification();
                  toast.success("Test notification sent to your phone screen!");
                } else if (perm === "denied") {
                  toast.error("Notification permission was denied in your browser settings.");
                }
              }}
              className="text-xs flex items-center gap-1.5"
            >
              <Send className="h-3 w-3 text-accent-cyan" />
              <span>Test Push</span>
            </Button>
            <Link to="/settings">
              <Button variant="ghost" size="sm" className="text-xs flex items-center gap-1.5">
                <Settings className="h-3 w-3" />
                <span>Configure</span>
              </Button>
            </Link>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-3">
            <NotificationItemSkeleton />
            <NotificationItemSkeleton />
            <NotificationItemSkeleton />
          </div>
        ) : notifications.length === 0 ? (
          <EmptyState
            title="Clean Slate"
            description="You have no notifications or activity log items at the moment."
            icon={<Bell className="h-8 w-8 text-text-muted" />}
          />
        ) : (
          <div className="flex flex-col gap-3">
            {notifications.map((notif) => {
              const isPending = notif.status === "pending";

              return (
                <div
                  key={notif.id}
                  className="glass-elevated border border-white/10 rounded-2xl p-4 md:p-5 flex items-start gap-4 transition-all hover:border-white/15"
                >
                  <div className="p-2.5 bg-accent-cyan/10 rounded-xl text-accent-cyan shrink-0 mt-0.5">
                    <UserPlus className="h-5 w-5" />
                  </div>

                  <div className="flex-1 flex flex-col md:flex-row md:items-center justify-between gap-3 text-left">
                    <div>
                      {notif.type === "join_request" ? (
                        <>
                          <h4 className="text-sm font-bold text-text-primary">
                            Join Request: {notif.applicantName}
                          </h4>
                          <p className="text-xs text-text-secondary mt-1">
                            Wants to join <span className="font-semibold text-text-primary">"{notif.groupName}"</span> as a <span className="capitalize font-semibold text-accent-cyan">{notif.requestedRole}</span>.
                          </p>
                        </>
                      ) : notif.type === "join_request_approved" ? (
                        <>
                          <h4 className="text-sm font-bold text-text-primary">
                            Request Approved 🎉
                          </h4>
                          <p className="text-xs text-text-secondary mt-1">
                            Your request to join group <span className="font-semibold text-text-primary">"{notif.groupName}"</span> has been approved!
                          </p>
                        </>
                      ) : (
                        <>
                          <h4 className="text-sm font-bold text-text-primary">
                            Request Declined
                          </h4>
                          <p className="text-xs text-text-secondary mt-1">
                            Your request to join group <span className="font-semibold text-text-primary">"{notif.groupName}"</span> was declined.
                          </p>
                        </>
                      )}
                    </div>

                    {/* Actions */}
                    {notif.type === "join_request" && (
                      <div className="flex gap-2 shrink-0 self-end md:self-center">
                        {isPending ? (
                          <>
                            <Button
                              onClick={() => handleDecline(notif)}
                              variant="ghost"
                              className="px-3 py-1.5 h-8 text-xs text-danger hover:bg-danger/5 border border-white/5"
                              isLoading={processingId === `${notif.id}_decline`}
                              disabled={processingId !== null}
                            >
                              <X className="h-3.5 w-3.5 mr-1" /> Decline
                            </Button>
                            <Button
                              onClick={() => handleApprove(notif)}
                              variant="gradient"
                              className="px-3 py-1.5 h-8 text-xs"
                              isLoading={processingId === `${notif.id}_approve`}
                              disabled={processingId !== null}
                            >
                              <Check className="h-3.5 w-3.5 mr-1" /> Approve
                            </Button>
                          </>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-text-muted">
                            {notif.status === "approved" ? (
                              <>
                                <CheckCircle className="h-3.5 w-3.5 text-success" /> Approved
                              </>
                            ) : (
                              <>
                                <XCircle className="h-3.5 w-3.5 text-danger" /> Declined
                              </>
                            )}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PageContainer>
  );
};

export default NotificationsPage;

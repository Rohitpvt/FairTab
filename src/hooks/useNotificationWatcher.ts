import { useEffect, useRef } from "react";
import { auth, db } from "../infrastructure/firebase/firebase";
import { groupService } from "../infrastructure/firebase/groupService";
import { expenseService } from "../infrastructure/firebase/expenseService";
import { budgetService } from "../infrastructure/firebase/budgetService";
import { settlementService } from "../infrastructure/firebase/settlementService";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { webNotificationService } from "../infrastructure/notifications/webNotificationService";
import type { ExpenseDocument, SettlementDocument, BudgetDocument } from "@fairtab/domain";

/**
 * Realtime hook that listens for important financial events (new expenses,
 * budget overruns, debt settlements, and group notices) and dispatches
 * rich phone screen notifications.
 */
export function useNotificationWatcher() {
  const isInitializedRef = useRef(false);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    if (startTimeRef.current === 0) {
      startTimeRef.current = Date.now();
    }
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    const prefs = webNotificationService.getPreferences();
    if (!prefs.enabled) return;

    // Track active group unsubs
    const groupUnsubs: (() => void)[] = [];

    // 1. Listen to active groups
    const unsubGroups = groupService.watchUserGroups((groups) => {
      // Clear previous group listeners
      groupUnsubs.forEach((unsub) => unsub());
      groupUnsubs.length = 0;

      const activeGroups = groups.filter((g) => g.status === "active");

      activeGroups.forEach((g) => {
        const groupId = g.groupId;
        const groupName = g.groupName;

        // A. Listen for new expenses
        if (prefs.expenses) {
          const unsubExpenses = expenseService.watchExpenses(groupId, (expenses: ExpenseDocument[]) => {
            if (!isInitializedRef.current) return;

            expenses.forEach((exp) => {
              const expTime = exp.createdAt?.seconds
                ? exp.createdAt.seconds * 1000
                : typeof exp.createdAt === "string"
                ? new Date(exp.createdAt).getTime()
                : 0;

              // Only notify if created after session start
              if (expTime < startTimeRef.current - 10000) return;

              const eventId = `expense_${exp.id}`;
              if (webNotificationService.hasBeenNotified(eventId)) return;

              // Check if user is part of the split or payer
              const userSplit = exp.splits?.find((s) => s.memberId === currentUser.uid);
              const isPayer = exp.payers?.some((p) => p.memberId === currentUser.uid);

              if (userSplit && !isPayer) {
                const totalFormatted = (exp.amountMinor / 100).toFixed(2);
                const shareFormatted = (userSplit.amountMinor / 100).toFixed(2);
                const currency = exp.currency || "USD";
                webNotificationService.sendNotification(`💸 New Expense in ${groupName}`, {
                  body: `A member added "${exp.title}" (${currency} ${totalFormatted}). Your share: ${currency} ${shareFormatted}.`,
                  tag: eventId,
                  data: { url: window.location.origin + `#/groups/${groupId}` },
                });
                webNotificationService.markAsNotified(eventId);
              }
            });
          });
          groupUnsubs.push(unsubExpenses);
        }

        // B. Listen for budget overruns & threshold warnings
        if (prefs.budgets) {
          const unsubBudgets = budgetService.watchBudgets(groupId, (budgets: BudgetDocument[]) => {
            if (!isInitializedRef.current) return;

            budgets.forEach((b) => {
              if (b.period !== "monthly") return;
              const currentMonth = new Date().toISOString().slice(0, 7);
              const limitMinor = b.amountMinor;
              if (limitMinor <= 0) return;

              const eventId = `budget_${groupId}_${b.name || b.category || "overall"}_${currentMonth}`;
              if (webNotificationService.hasBeenNotified(eventId)) return;

              const limitFormatted = (limitMinor / 100).toFixed(2);
              const currency = b.currency || "USD";

              webNotificationService.sendNotification(`⚠️ Budget Configured in ${groupName}`, {
                body: `${b.name || b.category || "Monthly"} budget is active at ${currency} ${limitFormatted}.`,
                tag: eventId,
                data: { url: window.location.origin + `#/budgets` },
              });
              webNotificationService.markAsNotified(eventId);
            });
          });
          groupUnsubs.push(unsubBudgets);
        }

        // C. Listen for settlements
        if (prefs.settlements) {
          const unsubSettlements = settlementService.watchSettlements(
            groupId,
            (settlements: SettlementDocument[]) => {
              if (!isInitializedRef.current) return;

              settlements.forEach((settle) => {
                const settleTime = settle.createdAt?.seconds
                  ? settle.createdAt.seconds * 1000
                  : typeof settle.createdAt === "string"
                  ? new Date(settle.createdAt).getTime()
                  : 0;

                if (settleTime < startTimeRef.current - 10000) return;

                const eventId = `settlement_${settle.id}`;
                if (webNotificationService.hasBeenNotified(eventId)) return;

                const isPayer = settle.payerId === currentUser.uid;
                const isReceiver = settle.receiverId === currentUser.uid;

                if (isPayer || isReceiver) {
                  const amountFormatted = (settle.amountMinor / 100).toFixed(2);
                  const currency = settle.currency || "USD";
                  const title = isReceiver
                    ? `✅ Debt Cleared in ${groupName}`
                    : `✅ Settlement Recorded in ${groupName}`;

                  const body = isReceiver
                    ? `A settlement payment of ${currency} ${amountFormatted} was recorded to you.`
                    : `Your payment of ${currency} ${amountFormatted} in ${groupName} was recorded.`;

                  webNotificationService.sendNotification(title, {
                    body,
                    tag: eventId,
                    data: { url: window.location.origin + `#/settlements` },
                  });
                  webNotificationService.markAsNotified(eventId);
                }
              });
            }
          );
          groupUnsubs.push(unsubSettlements);
        }
      });

      // Mark initialized after first load
      setTimeout(() => {
        isInitializedRef.current = true;
      }, 2000);
    });

    // 2. Direct user notifications collection
    const notifQuery = query(
      collection(db, `users/${currentUser.uid}/notifications`),
      orderBy("createdAt", "desc"),
      limit(5)
    );

    const unsubUserNotifs = onSnapshot(notifQuery, (snapshot) => {
      if (!isInitializedRef.current) return;

      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const data = change.doc.data();
          const eventId = `direct_${change.doc.id}`;
          if (webNotificationService.hasBeenNotified(eventId)) return;

          if (data.type === "join_request") {
            webNotificationService.sendNotification(`👥 Join Request: ${data.groupName || "Group"}`, {
              body: `${data.applicantName || "Someone"} requested to join ${data.groupName}.`,
              tag: eventId,
              data: { url: window.location.origin + `#/notifications` },
            });
            webNotificationService.markAsNotified(eventId);
          } else if (data.type === "join_request_approved") {
            webNotificationService.sendNotification(`🎉 Group Invitation Approved`, {
              body: `Your request to join ${data.groupName} was approved!`,
              tag: eventId,
              data: { url: window.location.origin + `#/groups/${data.groupId}` },
            });
            webNotificationService.markAsNotified(eventId);
          }
        }
      });
    });

    return () => {
      unsubGroups();
      groupUnsubs.forEach((unsub) => unsub());
      unsubUserNotifs();
    };
  }, []);
}

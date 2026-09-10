/* eslint-disable @typescript-eslint/no-explicit-any */
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "../infrastructure/firebase/firebase";

export interface ExportDataResult {
  userProfile: any;
  exportedAt: string;
  groups: Array<{
    group: any;
    members: any[];
    expenses: any[];
    settlements: any[];
    budgets: any[];
    recurringTemplates: any[];
    recurringOccurrences: any[];
  }>;
}

// Escapes CSV cell values to avoid syntax errors
function escapeCsvValue(val: any): string {
  if (val === null || val === undefined) return "";
  let str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    str = str.replace(/"/g, '""');
    return `"${str}"`;
  }
  return str;
}

// Converts a list of objects to CSV string
function convertToCsv(headers: string[], rows: any[][]): string {
  const headerLine = headers.join(",");
  const rowLines = rows.map((r) => r.map(escapeCsvValue).join(","));
  return [headerLine, ...rowLines].join("\n");
}

// Formats a Firestore timestamp to a readable local string
function formatTimestamp(ts: any): string {
  if (!ts) return "";
  if (ts.seconds) return new Date(ts.seconds * 1000).toISOString();
  if (ts instanceof Date) return ts.toISOString();
  return String(ts);
}

// Triggers a file download in the browser
export function triggerDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Fetches the backup data structure for a single group
export async function fetchGroupExportData(groupId: string): Promise<ExportDataResult["groups"][0]> {
  const groupDocRef = doc(db, "groups", groupId);
  const groupDocSnap = await getDoc(groupDocRef);
  if (!groupDocSnap.exists()) {
    throw new Error("Group document not found.");
  }
  const group = { id: groupDocSnap.id, ...groupDocSnap.data() };

  // Fetch members
  const membersSnap = await getDocs(collection(db, "groups", groupId, "members"));
  const members = membersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Fetch expenses
  const expensesSnap = await getDocs(collection(db, "groups", groupId, "expenses"));
  const expenses = expensesSnap.docs.map((d) => {
    const data: Record<string, any> = { id: d.id, ...d.data() };
    delete data.payloadHash;
    delete data.latestOperationId;
    return data;
  });

  // Fetch settlements
  const settlementsSnap = await getDocs(collection(db, "groups", groupId, "settlements"));
  const settlements = settlementsSnap.docs.map((d) => {
    const data: Record<string, any> = { id: d.id, ...d.data() };
    delete data.payloadHash;
    delete data.latestOperationId;
    return data;
  });

  // Fetch budgets (gracefully ignore if none or empty)
  let budgets: any[];
  try {
    const budgetsSnap = await getDocs(collection(db, "groups", groupId, "budgets"));
    budgets = budgetsSnap.docs.map((d) => {
      const data: Record<string, any> = { id: d.id, ...d.data() };
      delete data.payloadHash;
      delete data.latestOperationId;
      return data;
    });
  } catch {
    budgets = [];
  }

  // Fetch recurring templates (gracefully ignore if none or empty)
  const recurringTemplates: any[] = [];
  const recurringOccurrences: any[] = [];
  try {
    const templatesSnap = await getDocs(collection(db, "groups", groupId, "recurringTemplates"));
    for (const tempDoc of templatesSnap.docs) {
      const templateId = tempDoc.id;
      const templateData = { id: templateId, ...tempDoc.data() };
      recurringTemplates.push(templateData);

      try {
        const occurrencesSnap = await getDocs(
          collection(db, "groups", groupId, "recurringTemplates", templateId, "occurrences")
        );
        occurrencesSnap.docs.forEach((occDoc) => {
          recurringOccurrences.push({ id: occDoc.id, ...occDoc.data() });
        });
      } catch {
        // occurrences may not exist
      }
    }
  } catch {
    // recurringTemplates may not exist
  }

  return {
    group,
    members,
    expenses,
    settlements,
    budgets,
    recurringTemplates,
    recurringOccurrences,
  };
}

// Fetches the full backup data structure for all groups of the current user
export async function fetchUserExportData(uid: string): Promise<ExportDataResult> {
  const userDocSnap = await getDoc(doc(db, "users", uid));
  const userProfile = userDocSnap.exists() ? { uid, ...userDocSnap.data() } : {};

  // Read user's groups index securely
  const userGroupsSnap = await getDocs(collection(db, `userGroupIndex/${uid}/groups`));
  const groupIds = userGroupsSnap.docs
    .filter((d) => {
      const st = d.data().status;
      return st !== "deleted" && st !== "left";
    })
    .map((d) => d.data().groupId || d.id);

  const groupsData: ExportDataResult["groups"] = [];

  for (const groupId of groupIds) {
    try {
      const groupData = await fetchGroupExportData(groupId);
      groupsData.push(groupData);
    } catch (e) {
      console.warn(`Failed to export data for group ${groupId}:`, e);
    }
  }

  return {
    userProfile,
    exportedAt: new Date().toISOString(),
    groups: groupsData,
  };
}

// Converts JSON backup result into three distinct normalized CSV sheets
export function generateCsvLedger(data: ExportDataResult): {
  expensesCsv: string;
  sharesCsv: string;
  settlementsCsv: string;
} {
  // 1. Expenses CSV
  const expenseHeaders = [
    "Expense ID",
    "Group ID",
    "Group Name",
    "Date",
    "Category",
    "Title",
    "Created By",
    "Total Amount Minor",
    "Currency",
    "Status",
  ];
  const expenseRows: any[][] = [];

  // 2. Shares CSV
  const shareHeaders = [
    "Expense ID",
    "Group ID",
    "Member ID",
    "Member Name",
    "Share Amount Minor",
    "Split Method",
  ];
  const shareRows: any[][] = [];

  // 3. Settlements CSV
  const settlementHeaders = [
    "Settlement ID",
    "Group ID",
    "Group Name",
    "Date",
    "Payer ID",
    "Payer Name",
    "Payee ID",
    "Payee Name",
    "Amount Minor",
    "Currency",
    "Status",
  ];
  const settlementRows: any[][] = [];

  data.groups.forEach(({ group, members, expenses, settlements }) => {
    const memberNameMap: Record<string, string> = {};
    members.forEach((m) => {
      memberNameMap[m.id] = m.displayName || "Unknown Member";
    });

    expenses.forEach((exp) => {
      expenseRows.push([
        exp.id,
        group.id,
        group.name,
        formatTimestamp(exp.date),
        exp.category,
        exp.title,
        exp.createdBy,
        exp.amountMinor,
        exp.currency,
        exp.status,
      ]);

      // Split shares
      const splits: any[] = exp.splits || [];
      splits.forEach((s) => {
        shareRows.push([
          exp.id,
          group.id,
          s.memberId,
          memberNameMap[s.memberId] || s.memberId,
          s.amountMinor,
          exp.splitMethod,
        ]);
      });
    });

    settlements.forEach((set) => {
      const payeeId = set.receiverId || set.payeeId;
      settlementRows.push([
        set.id,
        group.id,
        group.name,
        formatTimestamp(set.createdAt),
        set.payerId,
        memberNameMap[set.payerId] || set.payerId,
        payeeId,
        memberNameMap[payeeId] || payeeId,
        set.amountMinor,
        set.currency,
        set.status,
      ]);
    });
  });

  return {
    expensesCsv: convertToCsv(expenseHeaders, expenseRows),
    sharesCsv: convertToCsv(shareHeaders, shareRows),
    settlementsCsv: convertToCsv(settlementHeaders, settlementRows),
  };
}

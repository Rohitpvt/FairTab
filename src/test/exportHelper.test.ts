import { describe, test, expect } from "vitest";
import { generateCsvLedger } from "../utils/exportHelper";
import type { ExportDataResult } from "../utils/exportHelper";

describe("Remediation: Settlement CSV Export Regression Tests", () => {
  test("generates settlements CSV with canonical createdAt timestamp formatted correctly", () => {
    // Construct dummy ExportDataResult containing a settlement document with createdAt
    const mockData: ExportDataResult = {
      userProfile: { uid: "user-1", displayName: "Test User" },
      exportedAt: new Date().toISOString(),
      groups: [
        {
          group: { id: "group-1", name: "Family Group" },
          members: [
            { id: "member-alice", displayName: "Alice" },
            { id: "member-bob", displayName: "Bob" },
          ],
          expenses: [],
          settlements: [
            {
              id: "settle-1",
              groupId: "group-1",
              payerId: "member-alice",
              payeeId: "member-bob", // Note payeeId maps in current CSV code
              amountMinor: 5000,
              currency: "USD",
              status: "active",
              createdAt: { seconds: 1774828800 }, // 2026-03-30 ISO string in output
            },
          ],
          budgets: [],
          recurringTemplates: [],
          recurringOccurrences: [],
        },
      ],
    };

    const { settlementsCsv } = generateCsvLedger(mockData);

    // Verify date is present
    const rows = settlementsCsv.split("\n");
    expect(rows[0]).toBe("Settlement ID,Group ID,Group Name,Date,Payer ID,Payer Name,Payee ID,Payee Name,Amount Minor,Currency,Status");
    
    // Check if the expected formatted timestamp appears
    const expectedIsoStr = new Date(1774828800 * 1000).toISOString();
    expect(rows[1]).toContain(expectedIsoStr);
  });
});

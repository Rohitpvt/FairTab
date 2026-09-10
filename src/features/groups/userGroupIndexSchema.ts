export interface UserGroupIndexDocument {
  groupId: string;
  groupName: string;
  role: "owner" | "admin" | "member" | "viewer";
  status: "active" | "archived" | "left" | "removed";
  settlementStrategy?: "minimum_transactions" | "preserve_relationships";
  latestActivityAt: unknown; // Firestore timestamp
  updatedAt: unknown; // Firestore timestamp
}

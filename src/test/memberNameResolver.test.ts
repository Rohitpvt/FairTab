import { describe, test, expect } from "vitest";
import { resolveMemberName } from "../hooks/useMemberNameResolver";
import type { GroupMemberDocument } from "../features/groups/memberSchema";

describe("useMemberNameResolver unit tests", () => {
  const currentUid = "current-user-uid";
  const otherUid = "other-user-uid";

  const currentUserMember: GroupMemberDocument = {
    id: currentUid,
    groupId: "group-1",
    kind: "account",
    userId: currentUid,
    displayName: "Stale Cache Name",
    displayNameLower: "stale cache name",
    role: "owner",
    status: "active",
    createdAt: null,
    createdBy: "system",
    updatedAt: null,
    updatedBy: "system",
    version: 1,
    schemaVersion: 1,
  };

  const otherUserMember: GroupMemberDocument = {
    id: otherUid,
    groupId: "group-1",
    kind: "account",
    userId: otherUid,
    displayName: "Bob",
    displayNameLower: "bob",
    role: "member",
    status: "active",
    createdAt: null,
    createdBy: "system",
    updatedAt: null,
    updatedBy: "system",
    version: 1,
    schemaVersion: 1,
  };

  const placeholderMember: GroupMemberDocument = {
    id: "placeholder-id",
    groupId: "group-1",
    kind: "placeholder",
    displayName: "Offline Friend",
    displayNameLower: "offline friend",
    role: "member",
    status: "active",
    createdAt: null,
    createdBy: "system",
    updatedAt: null,
    updatedBy: "system",
    version: 1,
    schemaVersion: 1,
  };

  test("resolves current user name from authoritative profile when loaded", () => {
    const resolved = resolveMemberName(currentUserMember, currentUid, "Live Profile Name");
    expect(resolved).toBe("Live Profile Name");
  });

  test("falls back to membership display name for current user if profile displayName is not loaded", () => {
    const resolved = resolveMemberName(currentUserMember, currentUid, undefined);
    expect(resolved).toBe("Stale Cache Name");
  });

  test("resolves other users using membership display name directly", () => {
    const resolved = resolveMemberName(otherUserMember, currentUid, "Live Profile Name");
    expect(resolved).toBe("Bob");
  });

  test("resolves placeholders using membership display name directly", () => {
    const resolved = resolveMemberName(placeholderMember, currentUid, "Live Profile Name");
    expect(resolved).toBe("Offline Friend");
  });

  test("falls back to userId/Unknown if displayName is blank", () => {
    const missingNameMember = { ...otherUserMember, displayName: "" };
    const resolved = resolveMemberName(missingNameMember, currentUid, "Live Profile Name");
    expect(resolved).toBe(otherUid);
  });
});

import { describe, test, expect } from "vitest";
import {
  canEditSettings,
  canArchiveGroup,
  canInviteMember,
  canAddPlaceholder,
  canLeaveGroup,
  canRemoveMember,
  canChangeRole,
} from "../features/groups/permissions";

describe("Role-Based Permission Matrix Tests", () => {
  test("canEditSettings rules", () => {
    expect(canEditSettings("owner")).toBe(true);
    expect(canEditSettings("admin")).toBe(true);
    expect(canEditSettings("member")).toBe(false);
    expect(canEditSettings("viewer")).toBe(false);
  });

  test("canArchiveGroup rules", () => {
    expect(canArchiveGroup("owner")).toBe(true);
    expect(canArchiveGroup("admin")).toBe(false);
    expect(canArchiveGroup("member")).toBe(false);
    expect(canArchiveGroup("viewer")).toBe(false);
  });

  test("canInviteMember rules", () => {
    expect(canInviteMember("owner")).toBe(true);
    expect(canInviteMember("admin")).toBe(true);
    expect(canInviteMember("member")).toBe(false);
    expect(canInviteMember("viewer")).toBe(false);
  });

  test("canAddPlaceholder rules", () => {
    expect(canAddPlaceholder("owner")).toBe(true);
    expect(canAddPlaceholder("admin")).toBe(true);
    expect(canAddPlaceholder("member")).toBe(false);
    expect(canAddPlaceholder("viewer")).toBe(false);
  });

  test("canLeaveGroup rules", () => {
    expect(canLeaveGroup("owner")).toBe(false); // Owner cannot leave
    expect(canLeaveGroup("admin")).toBe(true);
    expect(canLeaveGroup("member")).toBe(true);
    expect(canLeaveGroup("viewer")).toBe(true);
  });

  describe("canRemoveMember checks", () => {
    test("owner removing others", () => {
      expect(canRemoveMember("owner", "owner")).toBe(false); // cannot remove self
      expect(canRemoveMember("owner", "admin")).toBe(true);
      expect(canRemoveMember("owner", "member")).toBe(true);
      expect(canRemoveMember("owner", "viewer")).toBe(true);
    });

    test("admin removing others", () => {
      expect(canRemoveMember("admin", "owner")).toBe(false); // admin cannot remove owner
      expect(canRemoveMember("admin", "admin")).toBe(false); // admin cannot remove admin
      expect(canRemoveMember("admin", "member")).toBe(true); // admin can remove member
      expect(canRemoveMember("admin", "viewer")).toBe(true); // admin can remove viewer
    });

    test("member/viewer removing others", () => {
      expect(canRemoveMember("member", "member")).toBe(false);
      expect(canRemoveMember("viewer", "viewer")).toBe(false);
    });
  });

  describe("canChangeRole checks", () => {
    test("cannot change own role", () => {
      expect(canChangeRole("owner", "owner", "admin", true)).toBe(false);
      expect(canChangeRole("admin", "admin", "member", true)).toBe(false);
    });

    test("cannot demote owner", () => {
      expect(canChangeRole("owner", "owner", "admin", false)).toBe(false);
      expect(canChangeRole("admin", "owner", "member", false)).toBe(false);
    });

    test("cannot promote anyone to owner (ownership transfer deferred)", () => {
      expect(canChangeRole("owner", "admin", "owner", false)).toBe(false);
      expect(canChangeRole("admin", "member", "owner", false)).toBe(false);
    });

    test("owner modifying roles", () => {
      expect(canChangeRole("owner", "admin", "member", false)).toBe(true);
      expect(canChangeRole("owner", "admin", "viewer", false)).toBe(true);
      expect(canChangeRole("owner", "member", "admin", false)).toBe(true);
      expect(canChangeRole("owner", "viewer", "admin", false)).toBe(true);
    });

    test("admin modifying roles", () => {
      // Admin can change member ↔ viewer
      expect(canChangeRole("admin", "member", "viewer", false)).toBe(true);
      expect(canChangeRole("admin", "viewer", "member", false)).toBe(true);

      // Admin cannot promote anyone to admin
      expect(canChangeRole("admin", "member", "admin", false)).toBe(false);

      // Admin cannot modify other admin roles
      expect(canChangeRole("admin", "admin", "member", false)).toBe(false);
    });

    test("member/viewer cannot modify roles", () => {
      expect(canChangeRole("member", "viewer", "member", false)).toBe(false);
      expect(canChangeRole("viewer", "member", "viewer", false)).toBe(false);
    });
  });
});

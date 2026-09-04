import {
  collection,
  doc,
  writeBatch,
  serverTimestamp,
  increment,
  getDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";
import { db, auth } from "./firebase";
import type { GroupDocument, GroupFormData } from "../../features/groups/groupSchema";
import type { GroupMemberDocument } from "../../features/groups/memberSchema";
import type { UserGroupIndexDocument } from "../../features/groups/userGroupIndexSchema";
import type { ActivityDocument } from "../../features/groups/activitySchema";

// Safe error helper to preserve the cause
function wrapError(message: string, cause: unknown): Error {
  return new Error(message, { cause });
}

export const groupService = {
  /**
   * Atomic group creation: group, owner member, owner userGroupIndex, activity.
   */
  async createGroup(data: GroupFormData): Promise<string> {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("Authentication required to create a group.");

    // Retrieve canonical displayName from user profile document
    const userDocRef = doc(db, "users", currentUser.uid);
    const userSnap = await getDoc(userDocRef);
    const userProfile = userSnap.data();
    const displayName = userProfile?.displayName || currentUser.displayName || "Unknown User";

    const groupRef = doc(collection(db, "groups"));
    const groupId = groupRef.id;

    const memberRef = doc(db, `groups/${groupId}/members`, currentUser.uid);
    const indexRef = doc(db, `userGroupIndex/${currentUser.uid}/groups`, groupId);
    const activityRef = doc(collection(db, `groups/${groupId}/activities`));

    const nameLower = data.name.toLowerCase();

    const groupPayload: GroupDocument = {
      id: groupId,
      name: data.name,
      nameLower,
      description: data.description || "",
      type: data.type,
      baseCurrency: data.baseCurrency,
      ownerUserId: currentUser.uid,
      memberUserIds: [currentUser.uid],
      activeMemberCount: 1,
      simplifyDebts: data.simplifyDebts,
      settlementStrategy: data.settlementStrategy,
      status: "active",
      latestActivityAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      createdBy: currentUser.uid,
      updatedAt: serverTimestamp(),
      updatedBy: currentUser.uid,
      version: 1,
      schemaVersion: 1,
      initialActivityId: activityRef.id,
    };

    const memberPayload: GroupMemberDocument = {
      id: currentUser.uid,
      groupId,
      kind: "account",
      userId: currentUser.uid,
      displayName,
      displayNameLower: displayName.toLowerCase(),
      avatarURL: currentUser.photoURL || "",
      role: "owner",
      status: "active",
      joinedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      createdBy: currentUser.uid,
      updatedAt: serverTimestamp(),
      updatedBy: currentUser.uid,
      version: 1,
      schemaVersion: 1,
    };

    const indexPayload: UserGroupIndexDocument = {
      groupId,
      groupName: data.name,
      role: "owner",
      status: "active",
      latestActivityAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const activityPayload: ActivityDocument = {
      id: activityRef.id,
      groupId,
      type: "group_created",
      actorUserId: currentUser.uid,
      entityType: "group",
      entityId: groupId,
      summary: `Group "${data.name}" created by ${displayName}.`,
      createdAt: serverTimestamp(),
    };

    const batch = writeBatch(db);
    batch.set(groupRef, groupPayload);
    batch.set(memberRef, memberPayload);
    batch.set(indexRef, indexPayload);
    batch.set(activityRef, activityPayload);

    try {
      await batch.commit();
      return groupId;
    } catch (error: unknown) {
      throw wrapError("Failed to create group atomically.", error);
    }
  },

  /**
   * Update permitted group settings. Updates current user index if name changes.
   */
  async updateGroup(groupId: string, data: Partial<GroupFormData>, currentVersion: number): Promise<void> {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("Authentication required.");

    const groupRef = doc(db, "groups", groupId);
    const activityRef = doc(collection(db, `groups/${groupId}/activities`));
    const indexRef = doc(db, `userGroupIndex/${currentUser.uid}/groups`, groupId);

    const updates: Record<string, unknown> = {
      ...data,
      updatedAt: serverTimestamp(),
      updatedBy: currentUser.uid,
      version: currentVersion + 1,
    };

    if (data.name) {
      updates.nameLower = data.name.toLowerCase();
    }

    const activityPayload: ActivityDocument = {
      id: activityRef.id,
      groupId,
      type: "group_updated",
      actorUserId: currentUser.uid,
      entityType: "group",
      entityId: groupId,
      summary: `Group settings updated.`,
      createdAt: serverTimestamp(),
    };

    const batch = writeBatch(db);
    batch.update(groupRef, updates);
    batch.set(activityRef, activityPayload);

    if (data.name) {
      batch.update(indexRef, {
        groupName: data.name,
        updatedAt: serverTimestamp(),
      });
    }

    try {
      await batch.commit();
    } catch (error: unknown) {
      throw wrapError("Failed to update group.", error);
    }
  },

  /**
   * Group archiving. Sets group and current user index to archived.
   */
  async archiveGroup(groupId: string, currentVersion: number): Promise<void> {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("Authentication required.");

    const groupRef = doc(db, "groups", groupId);
    const indexRef = doc(db, `userGroupIndex/${currentUser.uid}/groups`, groupId);
    const activityRef = doc(collection(db, `groups/${groupId}/activities`));

    const activityPayload: ActivityDocument = {
      id: activityRef.id,
      groupId,
      type: "group_archived",
      actorUserId: currentUser.uid,
      entityType: "group",
      entityId: groupId,
      summary: `Group archived.`,
      createdAt: serverTimestamp(),
    };

    const batch = writeBatch(db);
    batch.update(groupRef, {
      status: "archived",
      updatedAt: serverTimestamp(),
      updatedBy: currentUser.uid,
      version: currentVersion + 1,
    });
    batch.update(indexRef, {
      status: "archived",
      updatedAt: serverTimestamp(),
    });
    batch.set(activityRef, activityPayload);

    try {
      await batch.commit();
    } catch (error: unknown) {
      throw wrapError("Failed to archive group.", error);
    }
  },

  /**
   * Add a placeholder member to the group (activeMemberCount increments by 1).
   */
  async addPlaceholderMember(groupId: string, displayName: string, groupVersion: number): Promise<string> {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("Authentication required.");

    const groupRef = doc(db, "groups", groupId);
    const memberRef = doc(collection(db, `groups/${groupId}/members`));
    const activityRef = doc(collection(db, `groups/${groupId}/activities`));

    const memberPayload: GroupMemberDocument = {
      id: memberRef.id,
      groupId,
      kind: "placeholder",
      displayName,
      displayNameLower: displayName.toLowerCase(),
      role: "member",
      status: "active",
      createdAt: serverTimestamp(),
      createdBy: currentUser.uid,
      updatedAt: serverTimestamp(),
      updatedBy: currentUser.uid,
      version: 1,
      schemaVersion: 1,
    };

    const activityPayload: ActivityDocument = {
      id: activityRef.id,
      groupId,
      type: "placeholder_added",
      actorUserId: currentUser.uid,
      entityType: "member",
      entityId: memberRef.id,
      summary: `Placeholder member "${displayName}" added.`,
      createdAt: serverTimestamp(),
    };

    const batch = writeBatch(db);
    batch.set(memberRef, memberPayload);
    batch.update(groupRef, {
      activeMemberCount: increment(1),
      updatedAt: serverTimestamp(),
      updatedBy: currentUser.uid,
      version: groupVersion + 1,
    });
    batch.set(activityRef, activityPayload);

    try {
      await batch.commit();
      return memberRef.id;
    } catch (error: unknown) {
      throw wrapError("Failed to add placeholder member.", error);
    }
  },

  /**
   * Remove a placeholder member from the group.
   */
  async removePlaceholderMember(groupId: string, memberId: string, displayName: string, groupVersion: number): Promise<void> {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("Authentication required.");

    const groupRef = doc(db, "groups", groupId);
    const memberRef = doc(db, `groups/${groupId}/members`, memberId);
    const activityRef = doc(collection(db, `groups/${groupId}/activities`));

    const activityPayload: ActivityDocument = {
      id: activityRef.id,
      groupId,
      type: "member_removed",
      actorUserId: currentUser.uid,
      entityType: "member",
      entityId: memberId,
      summary: `Placeholder member "${displayName}" removed.`,
      createdAt: serverTimestamp(),
    };

    const batch = writeBatch(db);
    batch.update(memberRef, {
      status: "removed",
      updatedAt: serverTimestamp(),
      updatedBy: currentUser.uid,
    });
    batch.update(groupRef, {
      activeMemberCount: increment(-1),
      updatedAt: serverTimestamp(),
      updatedBy: currentUser.uid,
      version: groupVersion + 1,
    });
    batch.set(activityRef, activityPayload);

    try {
      await batch.commit();
    } catch (error: unknown) {
      throw wrapError("Failed to remove placeholder member.", error);
    }
  },

  /**
   * Remove an account-backed member.
   */
  async removeAccountMember(
    groupId: string,
    memberId: string,
    displayName: string,
    activeMemberUserIds: string[],
    groupVersion: number
  ): Promise<void> {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("Authentication required.");

    const groupRef = doc(db, "groups", groupId);
    const memberRef = doc(db, `groups/${groupId}/members`, memberId);
    const indexRef = doc(db, `userGroupIndex/${memberId}/groups`, groupId);
    const activityRef = doc(collection(db, `groups/${groupId}/activities`));

    const updatedUserIds = activeMemberUserIds.filter((uid) => uid !== memberId);

    const activityPayload: ActivityDocument = {
      id: activityRef.id,
      groupId,
      type: "member_removed",
      actorUserId: currentUser.uid,
      entityType: "member",
      entityId: memberId,
      summary: `Member "${displayName}" removed.`,
      createdAt: serverTimestamp(),
    };

    const batch = writeBatch(db);
    batch.update(memberRef, {
      status: "removed",
      updatedAt: serverTimestamp(),
      updatedBy: currentUser.uid,
      activityId: activityRef.id,
    });
    batch.update(indexRef, {
      status: "removed",
      updatedAt: serverTimestamp(),
    });
    batch.update(groupRef, {
      activeMemberCount: increment(-1),
      memberUserIds: updatedUserIds,
      updatedAt: serverTimestamp(),
      updatedBy: currentUser.uid,
      version: groupVersion + 1,
    });
    batch.set(activityRef, activityPayload);

    try {
      await batch.commit();
    } catch (error: unknown) {
      throw wrapError("Failed to remove account member.", error);
    }
  },

  /**
   * Leave a group.
   */
  async leaveGroup(groupId: string, activeMemberUserIds: string[], groupVersion: number): Promise<void> {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("Authentication required.");

    const groupRef = doc(db, "groups", groupId);
    const memberRef = doc(db, `groups/${groupId}/members`, currentUser.uid);
    const indexRef = doc(db, `userGroupIndex/${currentUser.uid}/groups`, groupId);
    const activityRef = doc(collection(db, `groups/${groupId}/activities`));

    const updatedUserIds = activeMemberUserIds.filter((uid) => uid !== currentUser.uid);

    const activityPayload: ActivityDocument = {
      id: activityRef.id,
      groupId,
      type: "member_left",
      actorUserId: currentUser.uid,
      entityType: "member",
      entityId: currentUser.uid,
      summary: `${currentUser.displayName || "A user"} left the group.`,
      createdAt: serverTimestamp(),
    };

    const batch = writeBatch(db);
    batch.update(memberRef, {
      status: "left",
      updatedAt: serverTimestamp(),
      updatedBy: currentUser.uid,
      activityId: activityRef.id,
    });
    batch.update(indexRef, {
      status: "left",
      updatedAt: serverTimestamp(),
    });
    batch.update(groupRef, {
      activeMemberCount: increment(-1),
      memberUserIds: updatedUserIds,
      updatedAt: serverTimestamp(),
      updatedBy: currentUser.uid,
      version: groupVersion + 1,
    });
    batch.set(activityRef, activityPayload);

    try {
      await batch.commit();
    } catch (error: unknown) {
      throw wrapError("Failed to leave group.", error);
    }
  },

  /**
   * Update a member's role.
   */
  async updateMemberRole(
    groupId: string,
    memberId: string,
    displayName: string,
    newRole: "admin" | "member" | "viewer"
  ): Promise<void> {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("Authentication required.");

    const memberRef = doc(db, `groups/${groupId}/members`, memberId);
    const indexRef = doc(db, `userGroupIndex/${memberId}/groups`, groupId);
    const activityRef = doc(collection(db, `groups/${groupId}/activities`));

    const activityPayload: ActivityDocument = {
      id: activityRef.id,
      groupId,
      type: "role_changed",
      actorUserId: currentUser.uid,
      entityType: "member",
      entityId: memberId,
      summary: `Role of "${displayName}" updated to ${newRole}.`,
      createdAt: serverTimestamp(),
    };

    const groupRef = doc(db, "groups", groupId);

    const batch = writeBatch(db);
    batch.update(memberRef, {
      role: newRole,
      updatedAt: serverTimestamp(),
      updatedBy: currentUser.uid,
      activityId: activityRef.id,
    });
    batch.update(indexRef, {
      role: newRole,
      updatedAt: serverTimestamp(),
    });
    batch.update(groupRef, {
      updatedAt: serverTimestamp(),
      updatedBy: currentUser.uid,
      version: increment(1),
    });
    batch.set(activityRef, activityPayload);

    try {
      await batch.commit();
    } catch (error: unknown) {
      throw wrapError("Failed to update member role.", error);
    }
  },

  /**
   * Watch groups for the active user index
   */
  watchUserGroups(callback: (groups: UserGroupIndexDocument[]) => void) {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      callback([]);
      return () => {};
    }

    const q = query(
      collection(db, `userGroupIndex/${currentUser.uid}/groups`),
      where("status", "in", ["active", "archived"])
    );

    // Track active sub-listeners to clean them up on unsubscribe
    const repairListeners: Record<string, () => void> = {};

    const unsubscribeIndex = onSnapshot(q, (snapshot) => {
      const groups: UserGroupIndexDocument[] = [];
      const currentGroupIds = new Set<string>();

      snapshot.forEach((d) => {
        const indexData = d.data() as UserGroupIndexDocument;
        groups.push(indexData);

        const groupId = indexData.groupId;
        currentGroupIds.add(groupId);

        // Set up foreground index repair listener for this group if not already running
        if (!repairListeners[groupId]) {
          const groupRef = doc(db, "groups", groupId);
          const memberRef = doc(db, `groups/${groupId}/members`, currentUser.uid);

          let lastGroupStatus = indexData.status;
          let lastMemberRole = indexData.role;
          let lastMemberStatus = indexData.status;
          let lastGroupName = indexData.groupName;

          const runRepair = () => {
            let targetStatus: "active" | "archived" | "removed" | "left" = "active";
            if (lastMemberStatus === "removed" || lastMemberStatus === "left") {
              targetStatus = lastMemberStatus as "removed" | "left";
            } else if (lastGroupStatus === "archived") {
              targetStatus = "archived";
            }

            const targetRole = lastMemberRole;
            const targetGroupName = lastGroupName;

            // Only execute write if a change is detected (avoids write loops)
            if (
              indexData.status !== targetStatus ||
              indexData.role !== targetRole ||
              indexData.groupName !== targetGroupName
            ) {
              const indexDocRef = doc(db, `userGroupIndex/${currentUser.uid}/groups`, groupId);
              updateDoc(indexDocRef, {
                status: targetStatus,
                role: targetRole,
                groupName: targetGroupName,
                updatedAt: serverTimestamp(),
              }).catch(() => {
                // Ignore silent errors if permissions are in the middle of changing
              });
            }
          };

          const unsubGroup = onSnapshot(
            groupRef,
            (gSnap) => {
              if (gSnap.exists()) {
                const gData = gSnap.data();
                lastGroupStatus = gData.status;
                lastGroupName = gData.name;
                runRepair();
              }
            },
            () => {
              // Permission denied or group not found. If permission is denied, it means we might have been removed.
              // We rely on the member doc listener below which is always readable to confirm if we were removed.
            }
          );

          const unsubMember = onSnapshot(
            memberRef,
            (mSnap) => {
              if (mSnap.exists()) {
                const mData = mSnap.data();
                lastMemberStatus = mData.status;
                lastMemberRole = mData.role;
                runRepair();
              } else {
                // If member doc doesn't exist, they are not a member (or removed)
                lastMemberStatus = "removed";
                runRepair();
              }
            },
            () => {}
          );

          repairListeners[groupId] = () => {
            unsubGroup();
            unsubMember();
          };
        }
      });

      // Clean up listeners for groups that are no longer in our index
      Object.keys(repairListeners).forEach((groupId) => {
        if (!currentGroupIds.has(groupId)) {
          repairListeners[groupId]();
          delete repairListeners[groupId];
        }
      });

      callback(groups);
    }, (error) => {
      console.error("Failed to watch user groups index:", error);
    });

    return () => {
      unsubscribeIndex();
      Object.values(repairListeners).forEach((unsub) => unsub());
    };
  },

  /**
   * Watch a single group document
   */
  watchGroup(groupId: string, callback: (group: GroupDocument | null, fromCache: boolean, hasPendingWrites: boolean) => void) {
    return onSnapshot(
      doc(db, "groups", groupId),
      { includeMetadataChanges: true },
      (snapshot) => {
        if (!snapshot.exists()) {
          callback(null, false, false);
          return;
        }
        callback(
          snapshot.data() as GroupDocument,
          snapshot.metadata.fromCache,
          snapshot.metadata.hasPendingWrites
        );
      },
      (error) => {
        console.error(`Failed to watch group ${groupId}:`, error);
      }
    );
  },

  /**
   * Watch members of a group
   */
  watchMembers(groupId: string, callback: (members: GroupMemberDocument[]) => void) {
    return onSnapshot(
      query(collection(db, `groups/${groupId}/members`), where("status", "==", "active")),
      (snapshot) => {
        const members: GroupMemberDocument[] = [];
        snapshot.forEach((d) => {
          members.push(d.data() as GroupMemberDocument);
        });
        callback(members);
      },
      (error) => {
        console.error(`Failed to watch members of group ${groupId}:`, error);
      }
    );
  },

  /**
   * Watch group activities
   */
  watchActivities(groupId: string, callback: (activities: ActivityDocument[]) => void) {
    return onSnapshot(
      collection(db, `groups/${groupId}/activities`),
      (snapshot) => {
        const activities: ActivityDocument[] = [];
        snapshot.forEach((d) => {
          activities.push(d.data() as ActivityDocument);
        });
        activities.sort((a, b) => {
          const aTime = (a.createdAt as { seconds?: number })?.seconds || 0;
          const bTime = (b.createdAt as { seconds?: number })?.seconds || 0;
          return bTime - aTime; // Most recent first
        });
        callback(activities);
      },
      (error) => {
        console.error(`Failed to watch activities of group ${groupId}:`, error);
      }
    );
  },

  async deleteGroup(data: unknown): Promise<unknown> {
    const { fairtabApi } = await import("../api/fairtabApi");
    return fairtabApi.groups.delete(data);
  },

  async transferOwnership(groupId: string, newOwnerMemberId: string): Promise<unknown> {
    const { fairtabApi } = await import("../api/fairtabApi");
    return fairtabApi.groups.transferOwnership({ groupId, newOwnerMemberId });
  },

  /**
   * Fetch all active/archived groups owned by a given user
   */
  async fetchOwnedGroups(userId: string): Promise<GroupDocument[]> {
    const groupsRef = collection(db, "groups");
    const q = query(
      groupsRef,
      where("ownerUserId", "==", userId),
      where("status", "in", ["active", "archived"])
    );
    const snap = await getDocs(q);
    const results: GroupDocument[] = [];
    snap.forEach((doc) => {
      results.push(doc.data() as GroupDocument);
    });
    return results;
  },

  /**
   * Fetch active members of a group
   */
  async fetchGroupMembers(groupId: string): Promise<GroupMemberDocument[]> {
    const membersRef = collection(db, `groups/${groupId}/members`);
    const q = query(membersRef, where("status", "==", "active"));
    const snap = await getDocs(q);
    const members: GroupMemberDocument[] = [];
    snap.forEach((doc) => {
      members.push(doc.data() as GroupMemberDocument);
    });
    return members;
  },
};

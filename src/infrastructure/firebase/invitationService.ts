import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  increment,
  query,
  where,
  onSnapshot,
  getDoc,
  updateDoc,
  writeBatch,
  arrayUnion,
} from "firebase/firestore";
import { db, auth } from "./firebase";
import type { InvitationDocument, InvitationFormData } from "../../features/invitations/invitationSchema";
import type { GroupMemberDocument } from "../../features/groups/memberSchema";
import type { UserGroupIndexDocument } from "../../features/groups/userGroupIndexSchema";
import type { ActivityDocument } from "../../features/groups/activitySchema";

function wrapError(message: string, cause: unknown): Error {
  return new Error(message, { cause });
}

export const invitationService = {
  /**
   * Create a pending invitation with a 7-day expiration.
   */
  async createInvitation(groupId: string, groupName: string, data: InvitationFormData): Promise<string> {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("Authentication required.");

    const inviteRef = doc(collection(db, "invitations"));
    const inviteId = inviteRef.id;

    // Set 7 days expiration
    const expiresAtDate = new Date();
    expiresAtDate.setDate(expiresAtDate.getDate() + 7);

    const payload: InvitationDocument = {
      id: inviteId,
      groupId,
      groupName,
      invitedEmailLower: data.email.toLowerCase(),
      invitedBy: currentUser.uid,
      proposedRole: data.proposedRole,
      status: "pending",
      createdAt: serverTimestamp(),
      expiresAt: expiresAtDate,
    };

    const activityRef = doc(collection(db, `groups/${groupId}/activities`));
    const activityPayload: ActivityDocument = {
      id: activityRef.id,
      groupId,
      type: "member_invited",
      actorUserId: currentUser.uid,
      entityType: "member",
      entityId: inviteId,
      summary: `Invitation created for ${data.email} as ${data.proposedRole}.`,
      createdAt: serverTimestamp(),
    };

    const batch = writeBatch(db);
    batch.set(inviteRef, payload);
    batch.set(activityRef, activityPayload);

    try {
      await batch.commit();
      return inviteId;
    } catch (error: unknown) {
      throw wrapError("Failed to create invitation.", error);
    }
  },

  /**
   * Fetch invitation details
   */
  async getInvitation(invitationId: string): Promise<InvitationDocument> {
    const ref = doc(db, "invitations", invitationId);
    try {
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        throw new Error("Invitation not found.");
      }
      return snap.data() as InvitationDocument;
    } catch (error: unknown) {
      throw wrapError("Failed to fetch invitation details.", error);
    }
  },

  /**
   * Revoke an invitation (Owner or Admin).
   */
  async revokeInvitation(_groupId: string, invitationId: string): Promise<void> {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("Authentication required.");

    const inviteRef = doc(db, "invitations", invitationId);
    try {
      await updateDoc(inviteRef, {
        status: "revoked",
      });
    } catch (error: unknown) {
      throw wrapError("Failed to revoke invitation.", error);
    }
  },

  /**
   * Decline an invitation.
   */
  async declineInvitation(invitationId: string): Promise<void> {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("Authentication required.");

    const inviteRef = doc(db, "invitations", invitationId);
    try {
      await updateDoc(inviteRef, {
        status: "declined",
      });
    } catch (error: unknown) {
      throw wrapError("Failed to decline invitation.", error);
    }
  },

  /**
   * Atomic invitation acceptance transaction.
   */
  async acceptInvitation(invitationId: string): Promise<void> {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("Authentication required to accept invitation.");

    const inviteRef = doc(db, "invitations", invitationId);

    try {
      await runTransaction(db, async (transaction) => {
        // 1. Read invitation
        const inviteSnap = await transaction.get(inviteRef);
        if (!inviteSnap.exists()) {
          throw new Error("Invitation does not exist.");
        }
        const invite = inviteSnap.data() as InvitationDocument;

        if (invite.status !== "pending") {
          throw new Error(`Invitation is no longer pending (currently ${invite.status}).`);
        }

        // Validate expiration
        const expiresAtTs = invite.expiresAt as { toDate?: () => Date; seconds?: number } | null | undefined;
        const expiresAtTime = expiresAtTs?.toDate
          ? expiresAtTs.toDate().getTime()
          : (expiresAtTs?.seconds || 0) * 1000;
        if (Date.now() > expiresAtTime) {
          throw new Error("Invitation has expired.");
        }

        // Validate email targeting (invitations must match authenticated email or userId)
        if (invite.invitedUserId && invite.invitedUserId !== currentUser.uid) {
          throw new Error("Invitation was targeted to a different user ID.");
        }

        if (invite.invitedEmailLower) {
          const authEmail = currentUser.email?.toLowerCase();
          if (authEmail !== invite.invitedEmailLower) {
            throw new Error("Invitation was targeted to a different email address.");
          }
          if (!currentUser.emailVerified) {
            throw new Error("Email address must be verified to accept this invitation.");
          }
        }

        // 2. Prepare member reference and check if already an active member
        const memberRef = doc(db, `groups/${invite.groupId}/members`, currentUser.uid);
        const memberSnap = await transaction.get(memberRef);
        if (memberSnap.exists() && memberSnap.data().status === "active") {
          throw new Error("You are already an active member of this group.");
        }

        // 3. Prepare remaining references & retrieve canonical displayName
        const userRef = doc(db, "users", currentUser.uid);
        const userSnap = await transaction.get(userRef);
        const userProfile = userSnap.data();
        const displayName = userProfile?.displayName || currentUser.displayName || "Unknown User";

        const indexRef = doc(db, `userGroupIndex/${currentUser.uid}/groups`, invite.groupId);
        const activityRef = doc(collection(db, `groups/${invite.groupId}/activities`));
        const groupRef = doc(db, "groups", invite.groupId);

        // 4. Create payloads
        const memberPayload: GroupMemberDocument = {
          id: currentUser.uid,
          groupId: invite.groupId,
          kind: "account",
          userId: currentUser.uid,
          displayName,
          displayNameLower: displayName.toLowerCase(),
          avatarURL: currentUser.photoURL || "",
          role: invite.proposedRole,
          status: "active",
          joinedViaInvitationId: invitationId,
          joinedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          createdBy: currentUser.uid,
          updatedAt: serverTimestamp(),
          updatedBy: currentUser.uid,
          version: 1,
          schemaVersion: 1,
        };

        const indexPayload: UserGroupIndexDocument = {
          groupId: invite.groupId,
          groupName: invite.groupName,
          role: invite.proposedRole,
          status: "active",
          latestActivityAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        const activityPayload: ActivityDocument = {
          id: activityRef.id,
          groupId: invite.groupId,
          type: "member_joined",
          actorUserId: currentUser.uid,
          entityType: "member",
          entityId: currentUser.uid,
          summary: `${displayName} joined the group.`,
          createdAt: serverTimestamp(),
        };

        // 5. Commit writes
        transaction.update(inviteRef, {
          status: "accepted",
          acceptedAt: serverTimestamp(),
          acceptedBy: currentUser.uid,
          acceptedActivityId: activityRef.id,
        });

        transaction.set(memberRef, memberPayload);
        transaction.set(indexRef, indexPayload);
        transaction.set(activityRef, activityPayload);

        // Update group fields
        transaction.update(groupRef, {
          memberUserIds: arrayUnion(currentUser.uid),
          activeMemberCount: increment(1),
          updatedAt: serverTimestamp(),
          updatedBy: currentUser.uid,
          version: increment(1),
        });
      });
    } catch (error: unknown) {
      throw wrapError("Transaction failed: Invitation acceptance aborted.", error);
    }
  },

  /**
   * Watch incoming invitations targeting this user's verified email or UID
   */
  watchReceivedInvitations(callback: (invites: InvitationDocument[]) => void) {
    const currentUser = auth.currentUser;
    if (!currentUser || !currentUser.email || !currentUser.emailVerified) {
      callback([]);
      return () => {};
    }

    const q = query(
      collection(db, "invitations"),
      where("invitedEmailLower", "==", currentUser.email.toLowerCase()),
      where("status", "==", "pending")
    );

    return onSnapshot(q, (snapshot) => {
      const invites: InvitationDocument[] = [];
      snapshot.forEach((d) => {
        invites.push(d.data() as InvitationDocument);
      });
      callback(invites);
    }, (error) => {
      console.error("Failed to watch received invitations:", error);
    });
  }
};

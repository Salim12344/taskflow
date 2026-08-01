import { connectDB } from "@/lib/db";
import Group from "@/models/Group";
import GroupMember from "@/models/GroupMember";
import Task from "@/models/Task";
import Organization from "@/models/Organization";

/** A soft-deleted group's projects/tasks stop being reachable, not just hidden from lists — fetch through this, not Group.findById. */
export async function getActiveGroup(groupId: string) {
  await connectDB();
  return Group.findOne({ _id: groupId, deletedAt: null });
}

/** Admin either via groupMembers role, or as the owner of the group's org. */
export async function isGroupAdmin(groupId: string, userId: string, orgId: string | null) {
  await connectDB();
  if (orgId) {
    const org = await Organization.findById(orgId);
    if (org && org.ownerId.toString() === userId) return true;
  }
  const member = await GroupMember.findOne({ groupId, userId });
  return member?.role === "admin";
}

/**
 * The org (if any) this user is allowed to create new groups under — either because
 * they own it, or because the owner granted them "group creator" permission
 * (the "head of department" role: can create and admin their own group, nothing org-wide).
 */
export async function getCreatableOrg(userId: string) {
  await connectDB();
  const owned = await Organization.findOne({ ownerId: userId });
  if (owned) return owned;
  return Organization.findOne({ groupCreators: userId });
}

/** Member either via groupMembers row, or as the (implicit-admin) owner of the group's org. */
export async function isGroupMember(groupId: string, userId: string, orgId: string | null = null) {
  await connectDB();
  if (orgId) {
    const org = await Organization.findById(orgId);
    if (org && org.ownerId.toString() === userId) return true;
  }
  const member = await GroupMember.findOne({ groupId, userId });
  return !!member;
}

/** Tasks can only be assigned to regular members — admins (including the group's own admins) are never assignable. */
export async function isAssignableMember(groupId: string, userId: string) {
  await connectDB();
  const member = await GroupMember.findOne({ groupId, userId });
  return member?.role === "member";
}

/** All group IDs this user belongs to — explicit membership, plus every group under an org they own. */
export async function groupIdsFor(userId: string) {
  await connectDB();
  const explicit = await GroupMember.find({ userId }, "groupId");
  const groupIds = new Set(explicit.map((g) => g.groupId.toString()));

  const ownedOrgs = await Organization.find({ ownerId: userId }, "_id");
  if (ownedOrgs.length) {
    const orgGroups = await Group.find({ orgId: { $in: ownedOrgs.map((o) => o._id) }, deletedAt: null }, "_id");
    orgGroups.forEach((g) => groupIds.add(g._id.toString()));
  }
  return groupIds;
}

/** DMs may only start between people who share at least one group (spec: no general "message anyone" search). */
export async function shareAGroup(userIdA: string, userIdB: string) {
  const groupsA = await groupIdsFor(userIdA);
  const groupsB = await groupIdsFor(userIdB);
  return [...groupsA].some((id) => groupsB.has(id));
}

export async function countAdmins(groupId: string) {
  await connectDB();
  return GroupMember.countDocuments({ groupId, role: "admin" });
}

/**
 * Would the group still have at least one admin if `userId` stopped being one?
 * Accounts for the org owner's implicit admin rights, not just explicit GroupMember rows —
 * countAdmins() alone under-counts a group whose owner never explicitly joined as a member.
 */
export async function hasAnotherAdmin(groupId: string, orgId: string | null, userId: string) {
  await connectDB();
  const otherExplicitAdmins = await GroupMember.countDocuments({ groupId, role: "admin", userId: { $ne: userId } });
  if (otherExplicitAdmins > 0) return true;
  if (orgId) {
    const org = await Organization.findById(orgId);
    if (org && org.ownerId.toString() !== userId) return true;
  }
  return false;
}

/** True if this user is the owner of the org that owns this group (not just an admin — the actual owner). */
export async function isOrgOwnerOfGroup(orgId: string | null, userId: string) {
  await connectDB();
  if (!orgId) return false;
  const org = await Organization.findById(orgId);
  return !!org && org.ownerId.toString() === userId;
}

/**
 * Task management belongs to whoever assigned the task (or, once accepted, the admin it was
 * delegated to) — other admins lose those rights on it. The org owner keeps a permanent
 * emergency override on every task regardless, since they can never truly be locked out of
 * their own org.
 */
export async function canManageTask(
  reviewerId: string | null,
  orgId: string | null,
  userId: string,
  fallback: boolean
) {
  if (await isOrgOwnerOfGroup(orgId, userId)) return true;
  if (!reviewerId) return fallback;
  return reviewerId === userId;
}

export async function countAssignedTasks(groupId: string, userId: string, projectIds: string[]) {
  await connectDB();
  return Task.countDocuments({
    projectId: { $in: projectIds },
    assignedTo: userId,
    deletedAt: null,
    status: { $ne: "done" },
  });
}

export async function countPendingReviewTasks(projectIds: string[]) {
  await connectDB();
  return Task.countDocuments({
    projectId: { $in: projectIds },
    status: "pending_review",
    deletedAt: null,
  });
}

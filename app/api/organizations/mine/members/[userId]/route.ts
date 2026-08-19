import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db";
import Organization from "@/models/Organization";
import Group from "@/models/Group";
import GroupMember from "@/models/GroupMember";
import Project from "@/models/Project";
import Task from "@/models/Task";
import User from "@/models/User";
import { notifyMany } from "@/lib/notify";
import { hasAnotherAdmin } from "@/lib/permissions";

const ORG_PERMISSIONS = ["view_all_tasks", "org_override", "approve_signups", "create_groups"];

async function orgGroupIds(orgId: string) {
  const groups = await Group.find({ orgId, deletedAt: null }, "_id name");
  return groups;
}

async function orgProjectIds(groupIds: string[]) {
  const projects = await Project.find({ groupId: { $in: groupIds } }, "_id");
  return projects.map((p) => p._id.toString());
}

/** Same shape as the per-group version, just scoped to every group under the org at once. */
async function unassignActiveTasksOrgWide(groups: { _id: mongoose.Types.ObjectId; name: string }[], userId: string) {
  const groupIds = groups.map((g) => g._id.toString());
  const projectIds = await orgProjectIds(groupIds);
  const tasks = await Task.find({ projectId: { $in: projectIds }, assignedTo: userId, deletedAt: null, status: { $ne: "done" } });
  if (tasks.length === 0) return 0;

  await Task.updateMany({ _id: { $in: tasks.map((t) => t._id) } }, { $set: { assignedTo: null } });

  // One notification per task, scoped to that task's own group's admins, deep-linking straight
  // to the task instead of a single batched "N unassigned" notice with nowhere specific to land.
  const projectToGroup = new Map((await Project.find({ _id: { $in: projectIds } }, "_id groupId")).map((p) => [p._id.toString(), p.groupId.toString()]));
  const removedUser = await User.findById(userId, "name");
  for (const task of tasks) {
    const groupId = projectToGroup.get(task.projectId.toString());
    if (!groupId) continue;
    const admins = await GroupMember.find({ groupId, role: "admin" });
    await notifyMany(
      admins.map((a) => a.userId.toString()),
      "tasks_unassigned",
      `"${task.title}" was unassigned from ${removedUser?.name ?? "a member"} — needs reassigning`,
      { payload: { groupId, taskId: task._id, unassignedFromUserId: userId } }
    );
  }
  return tasks.length;
}

async function clearDelegationsOrgWide(groupIds: string[], userId: string) {
  const projectIds = await orgProjectIds(groupIds);
  await Task.updateMany({ projectId: { $in: projectIds }, reviewerId: userId, deletedAt: null }, { $set: { reviewerId: null } });
  await Task.updateMany(
    { projectId: { $in: projectIds }, deletedAt: null, $or: [{ "pendingReviewDelegation.toUserId": userId }, { "pendingReviewDelegation.fromUserId": userId }] },
    { $set: { pendingReviewDelegation: null } }
  );
}

async function loadOrgOwned(session: { user: { id: string } }) {
  await connectDB();
  return Organization.findOne({ ownerId: session.user.id });
}

/** "Belongs to this org" covers key-joiners (orgId set) and anyone added to one of the org's
 * groups the old way via invite link/email, who never had orgId touched at all. */
async function loadOrgMember(org: { _id: mongoose.Types.ObjectId }, userId: string, projection?: string) {
  const groups = await Group.find({ orgId: org._id, deletedAt: null }, "_id");
  const groupIds = groups.map((g) => g._id.toString());
  const isInAGroup = await GroupMember.exists({ groupId: { $in: groupIds }, userId });
  const isKeyJoiner = await User.exists({ _id: userId, orgId: org._id, signupStatus: "approved" });
  if (!isInAGroup && !isKeyJoiner) return null;
  return User.findById(userId, projection);
}

export async function GET(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId } = await params;
  const org = await loadOrgOwned(session);
  if (!org) return NextResponse.json({ error: "You don't own an organization" }, { status: 404 });

  const target = await loadOrgMember(org, userId, "name email createdAt orgStatus orgStatusReason orgPermissions");
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const groups = await orgGroupIds(org._id.toString());
  const groupIds = groups.map((g) => g._id.toString());
  const memberships = await GroupMember.find({ groupId: { $in: groupIds }, userId }, "groupId role");
  const groupInfo = memberships.map((m) => ({
    _id: m.groupId.toString(),
    name: groups.find((g) => g._id.toString() === m.groupId.toString())?.name ?? "Unknown",
    role: m.role,
  }));

  const projectIds = await orgProjectIds(groupIds);
  const activeTaskCount = await Task.countDocuments({ projectId: { $in: projectIds }, assignedTo: userId, deletedAt: null, status: { $ne: "done" } });
  const pendingApprovalCount = await Task.countDocuments({ projectId: { $in: projectIds }, reviewerId: userId, deletedAt: null, status: "pending_review" });
  const completedTaskCount = await Task.countDocuments({ projectId: { $in: projectIds }, assignedTo: userId, deletedAt: null, status: "done" });

  return NextResponse.json({ user: target, groups: groupInfo, activeTaskCount, pendingApprovalCount, completedTaskCount });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId } = await params;
  const body = await req.json();
  const org = await loadOrgOwned(session);
  if (!org) return NextResponse.json({ error: "You don't own an organization" }, { status: 404 });

  const target = await loadOrgMember(org, userId);
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if ("orgPermissions" in body) {
    const perms = body.orgPermissions;
    if (!Array.isArray(perms) || !perms.every((p) => ORG_PERMISSIONS.includes(p))) {
      return NextResponse.json({ error: "Invalid orgPermissions" }, { status: 400 });
    }
    if (perms.length > 0) {
      const groupIds = (await orgGroupIds(org._id.toString())).map((g) => g._id.toString());
      const isAdminSomewhere = await GroupMember.exists({ groupId: { $in: groupIds }, userId, role: "admin" });
      if (!isAdminSomewhere) {
        return NextResponse.json({ error: "Extra abilities can only be granted to someone who admins a group" }, { status: 400 });
      }
    }
    target.orgPermissions = perms;
  }

  if ("orgStatus" in body) {
    const status = body.orgStatus;
    if (!["active", "suspended", "banned"].includes(status)) {
      return NextResponse.json({ error: "Invalid orgStatus" }, { status: 400 });
    }
    const wasBlocked = target.orgStatus !== "active";
    target.orgStatus = status;
    target.orgStatusReason = status === "active" ? null : (body.reason ?? null);

    // Ban blocks re-signup independent of this User record — keep the org's list authoritative,
    // adding/removing the email as the status crosses in/out of "banned".
    if (status === "banned" && !org.bannedEmails?.includes(target.email)) {
      org.bannedEmails = [...(org.bannedEmails ?? []), target.email];
      await org.save();
    } else if (status !== "banned" && org.bannedEmails?.includes(target.email)) {
      org.bannedEmails = org.bannedEmails.filter((e: string) => e !== target.email);
      await org.save();
    }

    if (!wasBlocked && status !== "active") {
      // Suspending or banning freezes the account but leaves group membership intact (unlike
      // full org removal) — still, work stuck under a frozen account is as stranded as if
      // they'd left, so unassign/reassign the same way.
      const groups = await orgGroupIds(org._id.toString());
      await unassignActiveTasksOrgWide(groups, userId);
      await clearDelegationsOrgWide(groups.map((g) => g._id.toString()), userId);
    }
  }

  await target.save();
  return NextResponse.json({ user: target });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId } = await params;
  const org = await loadOrgOwned(session);
  if (!org) return NextResponse.json({ error: "You don't own an organization" }, { status: 404 });

  const target = await loadOrgMember(org, userId);
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const groups = await orgGroupIds(org._id.toString());
  const groupIds = groups.map((g) => g._id.toString());
  const memberships = await GroupMember.find({ groupId: { $in: groupIds }, userId });

  // Same admin-count guard as removing them from a single group, just checked per group they
  // admin — pulling them from the org must not silently zero out any group's admins.
  const dbSession = await mongoose.startSession();
  try {
    await dbSession.withTransaction(async () => {
      for (const m of memberships) {
        if (m.role === "admin" && !(await hasAnotherAdmin(m.groupId.toString(), org._id.toString(), userId, dbSession))) {
          const name = groups.find((g) => g._id.toString() === m.groupId.toString())?.name ?? "a group";
          throw new Error(`NO_OTHER_ADMIN:${name}`);
        }
      }
      await GroupMember.deleteMany({ groupId: { $in: groupIds }, userId }).session(dbSession);
      await User.updateOne({ _id: userId }, { $set: { orgId: null } }).session(dbSession);
    });
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("NO_OTHER_ADMIN:")) {
      const groupName = e.message.split(":")[1];
      return NextResponse.json(
        { error: `Promote another admin in "${groupName}" before removing this person — it would be left with none.` },
        { status: 409 }
      );
    }
    throw e;
  } finally {
    await dbSession.endSession();
  }

  await unassignActiveTasksOrgWide(groups, userId);
  await clearDelegationsOrgWide(groupIds, userId);

  return NextResponse.json({ ok: true });
}

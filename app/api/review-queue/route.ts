import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db";
import Group from "@/models/Group";
import GroupMember from "@/models/GroupMember";
import Organization from "@/models/Organization";
import Project from "@/models/Project";
import Task from "@/models/Task";
import { groupIdsFor } from "@/lib/permissions";

const VALID_STATUSES = ["todo", "in_progress", "pending_review", "done"];

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const statusParam = req.nextUrl.searchParams.get("status");
  const status = VALID_STATUSES.includes(statusParam ?? "") ? statusParam! : "pending_review";

  await connectDB();
  const userId = session.user.id;

  const adminMemberships = await GroupMember.find({ userId, role: "admin" });
  const adminGroupIds = new Set(adminMemberships.map((m) => m.groupId.toString()));

  // Org owners are admins on every group under their org, even ones they weren't added to directly.
  const ownedOrgs = await Organization.find({ ownerId: userId });
  if (ownedOrgs.length) {
    const orgGroups = await Group.find({ orgId: { $in: ownedOrgs.map((o) => o._id) }, deletedAt: null });
    orgGroups.forEach((g) => adminGroupIds.add(g._id.toString()));
  }

  // Not an admin anywhere: this page has nothing to review, so it becomes "my tasks" instead
  // of an admin queue that's permanently empty for the majority of users.
  const isAdminAnywhere = adminGroupIds.size > 0;
  const groupIds = isAdminAnywhere ? [...adminGroupIds] : [...(await groupIdsFor(userId))];
  const groups = await Group.find({ _id: { $in: groupIds }, deletedAt: null });

  const sections = [];
  for (const group of groups) {
    const projects = await Project.find({ groupId: group._id }, "_id name");
    const projectMap = new Map(projects.map((p) => [p._id.toString(), p.name]));
    const tasks = await Task.find({
      projectId: { $in: projects.map((p) => p._id) },
      status,
      deletedAt: null,
      ...(isAdminAnywhere ? {} : { assignedTo: userId }),
    }).sort(status === "pending_review" ? { submittedAt: 1 } : { createdAt: -1 });

    if (tasks.length === 0) continue;

    sections.push({
      groupId: group._id,
      groupName: group.name,
      tasks: tasks.map((t) => ({
        taskId: t._id,
        title: t.title,
        projectName: projectMap.get(t.projectId.toString()),
        assignedTo: t.assignedTo,
        submittedAt: t.submittedAt,
      })),
    });
  }

  return NextResponse.json({ sections, mine: !isAdminAnywhere });
}

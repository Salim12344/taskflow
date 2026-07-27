import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { notify } from "@/lib/notify";
import { isGroupAdmin } from "@/lib/permissions";
import { loadTaskContext } from "@/lib/task-context";

export async function POST(req: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { taskId } = await params;
  const { toUserId } = await req.json();
  if (!toUserId) return NextResponse.json({ error: "toUserId is required" }, { status: 400 });

  const ctx = await loadTaskContext(taskId);
  if (!ctx?.project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { task, project, group } = ctx;
  const groupId = project.groupId.toString();
  const orgId = group.orgId?.toString() ?? null;

  if (task.status === "done") {
    return NextResponse.json({ error: "This task is already done" }, { status: 400 });
  }
  if (!(await isGroupAdmin(groupId, session.user.id, orgId))) {
    return NextResponse.json({ error: "Only an admin can delegate review" }, { status: 403 });
  }
  if (toUserId === session.user.id) {
    return NextResponse.json({ error: "You can't delegate a task to yourself" }, { status: 400 });
  }
  if (!(await isGroupAdmin(groupId, toUserId, orgId))) {
    return NextResponse.json({ error: "You can only delegate review to another admin of this group" }, { status: 400 });
  }

  task.pendingReviewDelegation = { toUserId, fromUserId: session.user.id, createdAt: new Date() };
  await task.save();

  await notify(
    toUserId,
    "review_delegation_requested",
    `${session.user.name} wants to hand off "${task.title}" to you`,
    { payload: { taskId: task._id, fromUserId: session.user.id } }
  );

  return NextResponse.json({ task }, { status: 201 });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { taskId } = await params;
  const ctx = await loadTaskContext(taskId);
  if (!ctx?.project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { task, project, group } = ctx;

  if (!(await isGroupAdmin(project.groupId.toString(), session.user.id, group.orgId?.toString() ?? null))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!task.pendingReviewDelegation) {
    return NextResponse.json({ error: "No pending delegation to cancel" }, { status: 404 });
  }

  task.pendingReviewDelegation = null;
  await task.save();

  return NextResponse.json({ task });
}

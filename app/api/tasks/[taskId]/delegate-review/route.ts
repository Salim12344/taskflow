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
  const reviewerId = task.reviewerId?.toString() ?? null;
  // A creator who's since left the group (or been demoted) shouldn't retain a standing right to
  // hand tasks off — the fallback only holds while they're still actually an admin.
  const isCreator =
    task.createdBy.toString() === session.user.id && (await isGroupAdmin(groupId, session.user.id, orgId));
  // Deliberately narrower than canManageTask: handing a task off reassigns who's accountable
  // for it going forward, so it's exclusive to the creator or current delegate — even the org
  // owner's emergency override doesn't extend to reshuffling management, only acting on it.
  const canDelegate = reviewerId ? reviewerId === session.user.id : isCreator;
  if (!canDelegate) {
    return NextResponse.json({ error: "Only this task's current manager can hand it off" }, { status: 403 });
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

  if (!task.pendingReviewDelegation) {
    return NextResponse.json({ error: "No pending delegation to cancel" }, { status: 404 });
  }
  const isRequester = task.pendingReviewDelegation.fromUserId.toString() === session.user.id;
  // A demoted/removed admin shouldn't still be able to cancel an offer they no longer have
  // standing to have sent — withdraw it instead of letting them act on it.
  if (isRequester && !(await isGroupAdmin(project.groupId.toString(), session.user.id, group?.orgId?.toString() ?? null))) {
    task.pendingReviewDelegation = null;
    await task.save();
    return NextResponse.json({ error: "You're no longer an admin of this group — the offer has been withdrawn" }, { status: 403 });
  }
  if (!isRequester) {
    return NextResponse.json({ error: "Only the admin who sent this hand-off can cancel it" }, { status: 403 });
  }

  task.pendingReviewDelegation = null;
  await task.save();

  return NextResponse.json({ task });
}

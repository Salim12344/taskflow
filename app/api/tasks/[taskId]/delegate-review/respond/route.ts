import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { notify } from "@/lib/notify";
import { loadTaskContext } from "@/lib/task-context";
import { isGroupAdmin } from "@/lib/permissions";

export async function POST(req: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { taskId } = await params;
  const { accept } = await req.json();

  const ctx = await loadTaskContext(taskId);
  if (!ctx?.project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { task, project, group } = ctx;

  const delegation = task.pendingReviewDelegation;
  if (!delegation || delegation.toUserId.toString() !== session.user.id) {
    return NextResponse.json({ error: "No pending delegation request for you on this task" }, { status: 404 });
  }

  // Closes a narrow race: if the responder was demoted/removed after the offer was sent but
  // before they acted on it, they can no longer accept management they don't have rights to.
  if (accept && !(await isGroupAdmin(project.groupId.toString(), session.user.id, group?.orgId?.toString() ?? null))) {
    task.pendingReviewDelegation = null;
    await task.save();
    return NextResponse.json({ error: "You're no longer an admin of this group — the offer has been withdrawn" }, { status: 403 });
  }

  task.pendingReviewDelegation = null;
  if (accept) {
    task.reviewerId = delegation.toUserId;
  }
  await task.save();

  await notify(
    delegation.fromUserId.toString(),
    accept ? "review_delegation_accepted" : "review_delegation_declined",
    accept ? `${session.user.name} accepted "${task.title}"` : `${session.user.name} declined "${task.title}"`,
    { payload: { taskId: task._id } }
  );

  return NextResponse.json({ task });
}

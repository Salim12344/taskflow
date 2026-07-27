import { NextResponse } from "next/server";
import { auth } from "@/auth";
import TaskChatMessage from "@/models/TaskChatMessage";
import { isGroupAdmin, isGroupMember, canManageTask } from "@/lib/permissions";
import { loadTaskContext } from "@/lib/task-context";

/**
 * Private to the assignee and whoever currently manages the task (the creator, or the
 * delegated manager once one's accepted) — but any group admin can read along, just not post.
 * Spec: "Private thread scoped only to the task's assignee and assigner."
 */
async function loadChatContext(taskId: string, userId: string) {
  const ctx = await loadTaskContext(taskId);
  if (!ctx?.project) return null;
  const { task, project, group } = ctx;
  const groupId = project.groupId.toString();
  const orgId = group.orgId?.toString() ?? null;

  const isMember = await isGroupMember(groupId, userId);
  if (!isMember) return null;

  const admin = await isGroupAdmin(groupId, userId, orgId);
  const isAssignee = task.assignedTo?.toString() === userId;
  const isManager = await canManageTask(task.reviewerId?.toString() ?? null, orgId, userId, task.createdBy.toString() === userId);
  const canRead = admin || isAssignee;
  const canWrite = isAssignee || (admin && isManager);

  return { task, canRead, canWrite, isAssignee, isManager };
}

export async function GET(_req: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { taskId } = await params;
  const ctx = await loadChatContext(taskId, session.user.id);
  if (!ctx) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!ctx.canRead) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const messages = await TaskChatMessage.find({ taskId }).sort({ createdAt: 1 });

  // Only the two active participants' unread state matters — a passively-viewing admin
  // reading along doesn't clear anyone else's unread badge.
  if (ctx.canWrite) {
    await TaskChatMessage.updateMany(
      { taskId, senderId: { $ne: session.user.id }, readAt: null },
      { $set: { readAt: new Date() } }
    );
  }

  return NextResponse.json({ messages, canWrite: ctx.canWrite });
}

export async function POST(req: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { taskId } = await params;
  const { text } = await req.json();
  if (!text?.trim()) return NextResponse.json({ error: "text is required" }, { status: 400 });

  const ctx = await loadChatContext(taskId, session.user.id);
  if (!ctx) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!ctx.canWrite) {
    return NextResponse.json({ error: "Only the assignee and the task's manager can post here" }, { status: 403 });
  }

  const message = await TaskChatMessage.create({ taskId, senderId: session.user.id, text: text.trim() });

  return NextResponse.json({ message }, { status: 201 });
}

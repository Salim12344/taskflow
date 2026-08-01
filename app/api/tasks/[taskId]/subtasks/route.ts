import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db";
import Project from "@/models/Project";
import Task from "@/models/Task";
import { getActiveGroup, canManageTask } from "@/lib/permissions";
import { saveTaskOrConflict } from "@/lib/task-save";

export async function PATCH(req: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { taskId } = await params;
  const { index, done } = await req.json();

  await connectDB();
  const task = await Task.findOne({ _id: taskId, deletedAt: null });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!task.subtasks[index]) return NextResponse.json({ error: "Invalid subtask index" }, { status: 400 });

  const project = await Project.findById(task.projectId);
  const group = project ? await getActiveGroup(project.groupId.toString()) : null;
  if (!project || !group) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAssignee = task.assignedTo?.toString() === session.user.id;
  const isCreator = task.createdBy.toString() === session.user.id;
  const orgId = group.orgId?.toString() ?? null;
  const isManager = await canManageTask(task.reviewerId?.toString() ?? null, orgId, session.user.id, isCreator);

  if (!isAssignee && !isManager) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  task.subtasks[index].done = !!done;
  const conflict = await saveTaskOrConflict(task);
  if (conflict) return conflict;

  return NextResponse.json({ task });
}

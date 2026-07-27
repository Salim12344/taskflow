import Group from "@/models/Group";
import Project from "@/models/Project";
import Task from "@/models/Task";
import { connectDB } from "@/lib/db";

/** A soft-deleted group takes its projects/tasks down with it — not just hidden from lists. */
export async function loadTaskContext(taskId: string) {
  await connectDB();
  const task = await Task.findOne({ _id: taskId, deletedAt: null });
  if (!task) return null;
  const project = await Project.findById(task.projectId);
  if (!project) return { task, project: null, group: null };
  const group = await Group.findOne({ _id: project.groupId, deletedAt: null });
  if (!group) return { task, project: null, group: null };
  return { task, project, group };
}

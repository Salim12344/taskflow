import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db";
import Group from "@/models/Group";
import Project from "@/models/Project";
import Task from "@/models/Task";
import GroupMessage from "@/models/GroupMessage";
import { groupIdsFor } from "@/lib/permissions";

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ tasks: [], messages: [] });

  await connectDB();
  const groupIds = [...(await groupIdsFor(session.user.id))];
  if (groupIds.length === 0) return NextResponse.json({ tasks: [], messages: [] });

  const pattern = new RegExp(escapeRegex(q), "i");
  const groups = await Group.find({ _id: { $in: groupIds }, deletedAt: null }, "name");
  const groupNameById = new Map(groups.map((g) => [g._id.toString(), g.name]));
  const projects = await Project.find({ groupId: { $in: groupIds } }, "name groupId");
  const projectIds = projects.map((p) => p._id);
  const projectById = new Map(projects.map((p) => [p._id.toString(), p]));

  const [tasks, messages] = await Promise.all([
    Task.find({ projectId: { $in: projectIds }, deletedAt: null, title: pattern }).sort({ createdAt: -1 }).limit(20),
    GroupMessage.find({ groupId: { $in: groupIds }, text: pattern }).sort({ createdAt: -1 }).limit(20).populate("senderId", "name"),
  ]);

  return NextResponse.json({
    tasks: tasks.map((t) => {
      const project = projectById.get(t.projectId.toString());
      return {
        taskId: t._id,
        title: t.title,
        projectName: project?.name ?? "",
        groupName: groupNameById.get(project?.groupId?.toString() ?? "") ?? "",
      };
    }),
    messages: messages.map((m) => ({
      messageId: m._id,
      groupId: m.groupId,
      groupName: groupNameById.get(m.groupId.toString()) ?? "",
      text: m.text,
      senderName: (m.senderId as unknown as { name: string } | null)?.name ?? "Unknown",
      createdAt: m.createdAt,
    })),
  });
}

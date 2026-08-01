import mongoose from "mongoose";
import { NextResponse } from "next/server";

/** Returns a 409 response if `task.save()` lost a race with a concurrent edit, otherwise null. */
export async function saveTaskOrConflict(task: { save: () => Promise<unknown> }) {
  try {
    await task.save();
    return null;
  } catch (e) {
    if (e instanceof mongoose.Error.VersionError) {
      return NextResponse.json(
        { error: "This task was just changed by someone else — reload and try again." },
        { status: 409 }
      );
    }
    throw e;
  }
}

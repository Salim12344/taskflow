import mongoose from "mongoose";
import dns from "dns";

// ponytail: Node's resolver occasionally can't reach whatever local/link-local DNS
// server it inherited on Windows dev machines, causing SRV lookup timeouts against
// Atlas even though the OS resolver works fine. Pointing it at public DNS fixes it.
if (process.platform === "win32") {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
}

const MONGODB_URI = process.env.MONGODB_URI;

declare global {
  var _mongooseConn: Promise<typeof mongoose> | undefined;
}

export function connectDB() {
  if (!MONGODB_URI) throw new Error("MONGODB_URI is not set");
  if (!global._mongooseConn) {
    global._mongooseConn = mongoose.connect(MONGODB_URI);
  }
  return global._mongooseConn;
}

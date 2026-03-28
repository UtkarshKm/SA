import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

let shutdownHookRegistered = false;

export async function connectDatabase() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("Missing MONGODB_URI. Add it to your environment or .env file.");
  }

  mongoose.connection.on("connected", () => {
    console.log(`[mongo] connected to ${mongoose.connection.name || "database"}`);
  });

  mongoose.connection.on("error", (error) => {
    console.error("[mongo:error]", error);
  });

  await mongoose.connect(uri);

  if (!shutdownHookRegistered) {
    shutdownHookRegistered = true;
    for (const signal of ["SIGINT", "SIGTERM"]) {
      process.on(signal, async () => {
        await disconnectDatabase();
        process.exit(0);
      });
    }
  }
}

export async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    console.log("[mongo] disconnected");
  }
}

import dotenv from "dotenv";
import mongoose from "mongoose";
import { MongoClient } from "mongodb";

dotenv.config();

let shutdownHookRegistered = false;
let nativeConnected = false;

function getMongoUri() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("Missing MONGODB_URI. Add it to your environment or .env file.");
  }

  return uri;
}

const mongoUri = getMongoUri();
const mongoClient = new MongoClient(mongoUri);
const mongoDatabase = mongoClient.db();

export async function connectDatabase() {
  mongoose.connection.on("connected", () => {
    console.log(`[mongo:mongoose] connected to ${mongoose.connection.name || "database"}`);
  });

  mongoose.connection.on("error", (error) => {
    console.error("[mongo:mongoose:error]", error);
  });

  await mongoose.connect(mongoUri);

  if (!nativeConnected) {
    await mongoClient.connect();
    nativeConnected = true;
  }

  console.log(`[mongo:native] connected to ${mongoDatabase.databaseName || "database"}`);

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

export function getMongoClient() {
  return mongoClient;
}

export function getMongoDb() {
  return mongoDatabase;
}

export async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    console.log("[mongo:mongoose] disconnected");
  }

  if (nativeConnected) {
    await mongoClient.close();
    nativeConnected = false;
    console.log("[mongo:native] disconnected");
  }
}

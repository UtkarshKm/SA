import mongoose from "mongoose";
import { RunModel } from "../models/run.js";

function mapRun(document) {
  if (!document) {
    return null;
  }

  const id = String(document._id);
  const { _id, __v, ...rest } = document;
  return {
    id,
    ...rest
  };
}

export async function createRun(run) {
  const created = await RunModel.create(run);
  return mapRun(created.toObject());
}

export async function listRunsByUser(userId) {
  const runs = await RunModel.find(
    { userId },
    {
      rows: 0,
      __v: 0
    }
  )
    .sort({ createdAt: -1 })
    .lean();

  return runs.map(mapRun);
}

export async function getRunByIdForUser(id, userId) {
  if (!mongoose.isValidObjectId(id)) {
    return null;
  }

  const run = await RunModel.findOne({ _id: id, userId }).lean();
  return mapRun(run);
}

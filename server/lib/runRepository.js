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

export async function listRuns() {
  const runs = await RunModel.find(
    {},
    {
      rows: 0,
      __v: 0
    }
  )
    .sort({ createdAt: -1 })
    .lean();

  return runs.map(mapRun);
}

export async function getRunById(id) {
  if (!mongoose.isValidObjectId(id)) {
    return null;
  }

  const run = await RunModel.findById(id).lean();
  return mapRun(run);
}

import mongoose from "mongoose";
import { RunModel } from "../models/run.js";

const SUMMARY_DEFAULT = {
  sentimentCounts: { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0 },
  topAspects: [],
  aspectCoverage: 0
};

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

function isValidRunId(id) {
  return mongoose.isValidObjectId(id);
}

function buildProgressEvent(stage, message, percent) {
  return {
    stage,
    message,
    percent,
    createdAt: new Date()
  };
}

export async function createQueuedRun(run) {
  const created = await RunModel.create({
    ...run,
    status: "queued",
    validRowCount: 0,
    removedCount: 0,
    modelMode: "pending",
    modelName: "pending",
    progressPercent: 0,
    progressStage: "queued",
    progressMessage: "Run queued.",
    errorMessage: "",
    cancelRequested: false,
    processingStartedAt: null,
    processingCompletedAt: null,
    lastProcessedAt: null,
    progressEvents: [buildProgressEvent("queued", "Run queued.", 0)],
    summary: SUMMARY_DEFAULT,
    rows: []
  });

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
  if (!isValidRunId(id)) {
    return null;
  }

  const run = await RunModel.findOne({ _id: id, userId }).lean();
  return mapRun(run);
}

export async function getRunMetadataByIdForUser(id, userId) {
  if (!isValidRunId(id)) {
    return null;
  }

  const run = await RunModel.findOne(
    { _id: id, userId },
    {
      rows: 0,
      summary: 0,
      __v: 0
    }
  ).lean();

  return mapRun(run);
}

export async function getRunJobState(id, userId) {
  if (!isValidRunId(id)) {
    return null;
  }

  const run = await RunModel.findOne(
    { _id: id, userId },
    {
      _id: 1,
      status: 1,
      cancelRequested: 1,
      progressPercent: 1,
      progressStage: 1,
      progressMessage: 1,
      processingStartedAt: 1,
      processingCompletedAt: 1,
      lastProcessedAt: 1
    }
  ).lean();

  return mapRun(run);
}

export async function updateRunProgress(id, userId, { status, stage, message, percent, ...rest }) {
  if (!isValidRunId(id)) {
    return null;
  }

  const update = {
    ...rest,
    status,
    progressStage: stage,
    progressMessage: message,
    progressPercent: percent
  };

  const run = await RunModel.findOneAndUpdate(
    { _id: id, userId },
    {
      $set: update,
      $push: {
        progressEvents: buildProgressEvent(stage, message, percent)
      }
    },
    {
      new: true,
      projection: { __v: 0 }
    }
  ).lean();

  return mapRun(run);
}

export async function markRunCompleted(id, userId, payload) {
  if (!isValidRunId(id)) {
    return null;
  }

  const completedAt = new Date();
  const run = await RunModel.findOneAndUpdate(
    { _id: id, userId },
    {
      $set: {
        ...payload,
        status: "completed",
        progressPercent: 100,
        progressStage: "completed",
        progressMessage: "Results saved.",
        errorMessage: "",
        cancelRequested: false,
        processingCompletedAt: completedAt,
        lastProcessedAt: completedAt
      },
      $push: {
        progressEvents: buildProgressEvent("completed", "Results saved.", 100)
      }
    },
    {
      new: true,
      projection: { __v: 0 }
    }
  ).lean();

  return mapRun(run);
}

export async function markRunFailed(id, userId, errorMessage) {
  if (!isValidRunId(id)) {
    return null;
  }

  const completedAt = new Date();
  const run = await RunModel.findOneAndUpdate(
    { _id: id, userId },
    {
      $set: {
        status: "failed",
        progressStage: "failed",
        progressMessage: "Run failed.",
        errorMessage,
        cancelRequested: false,
        processingCompletedAt: completedAt,
        lastProcessedAt: completedAt
      },
      $push: {
        progressEvents: buildProgressEvent("failed", errorMessage || "Run failed.", 100)
      }
    },
    {
      new: true,
      projection: { __v: 0 }
    }
  ).lean();

  return mapRun(run);
}

export async function markRunCanceled(id, userId, message = "Run canceled before completion.") {
  if (!isValidRunId(id)) {
    return null;
  }

  const completedAt = new Date();
  const existing = await RunModel.findOne(
    { _id: id, userId },
    { progressPercent: 1 }
  ).lean();

  if (!existing) {
    return null;
  }

  const run = await RunModel.findOneAndUpdate(
    { _id: id, userId },
    {
      $set: {
        status: "canceled",
        progressStage: "canceled",
        progressMessage: message,
        errorMessage: "",
        cancelRequested: false,
        processingCompletedAt: completedAt,
        lastProcessedAt: completedAt,
        progressPercent: Math.max(existing.progressPercent || 0, 0)
      },
      $push: {
        progressEvents: buildProgressEvent("canceled", message, Math.max(existing.progressPercent || 0, 0))
      }
    },
    {
      new: true,
      projection: { __v: 0 }
    }
  ).lean();

  return mapRun(run);
}

export async function requestRunCancel(id, userId) {
  if (!isValidRunId(id)) {
    return null;
  }

  const run = await RunModel.findOneAndUpdate(
    {
      _id: id,
      userId,
      status: { $in: ["queued", "processing"] }
    },
    {
      $set: {
        cancelRequested: true,
        progressMessage: "Cancel requested. Waiting for the current step to stop safely."
      },
      $push: {
        progressEvents: buildProgressEvent(
          "cancel requested",
          "Cancel requested. Waiting for the current step to stop safely.",
          0
        )
      }
    },
    {
      new: true,
      projection: { __v: 0 }
    }
  ).lean();

  return mapRun(run);
}

export async function markActiveRunsInterrupted() {
  const activeRuns = await RunModel.find(
    {
      status: { $in: ["queued", "processing"] }
    },
    {
      _id: 1,
      progressPercent: 1
    }
  ).lean();

  if (activeRuns.length === 0) {
    return 0;
  }

  const completedAt = new Date();
  const interruptionMessage =
    "Run interrupted by a server restart before processing could finish. Please retry the upload.";

  const operations = activeRuns.map((run) => ({
    updateOne: {
      filter: { _id: run._id, status: { $in: ["queued", "processing"] } },
      update: {
        $set: {
          status: "failed",
          progressStage: "failed",
          progressMessage: "Run interrupted by a server restart.",
          errorMessage: interruptionMessage,
          cancelRequested: false,
          processingCompletedAt: completedAt,
          lastProcessedAt: completedAt,
          progressPercent: Math.max(run.progressPercent || 0, 0)
        },
        $push: {
          progressEvents: buildProgressEvent(
            "failed",
            interruptionMessage,
            Math.max(run.progressPercent || 0, 0)
          )
        }
      }
    }
  }));

  const result = await RunModel.bulkWrite(operations, { ordered: false });
  return result.modifiedCount || 0;
}

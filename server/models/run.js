import mongoose from "mongoose";

const rowSchema = new mongoose.Schema(
  {
    sourceRow: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    original_text: {
      type: String,
      required: true
    },
    clean_text: {
      type: String,
      required: true
    },
    predicted_label: {
      type: String,
      required: true,
      enum: ["POSITIVE", "NEUTRAL", "NEGATIVE"]
    },
    confidence: {
      type: Number,
      required: true
    },
    aspects: {
      type: [String],
      default: []
    },
    aspect_count: {
      type: Number,
      required: true
    }
  },
  { _id: false }
);

const summarySchema = new mongoose.Schema(
  {
    sentimentCounts: {
      POSITIVE: { type: Number, default: 0 },
      NEUTRAL: { type: Number, default: 0 },
      NEGATIVE: { type: Number, default: 0 }
    },
    topAspects: {
      type: [
        new mongoose.Schema(
          {
            name: String,
            count: Number
          },
          { _id: false }
        )
      ],
      default: []
    },
    aspectCoverage: {
      type: Number,
      default: 0
    }
  },
  { _id: false }
);

const progressEventSchema = new mongoose.Schema(
  {
    stage: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    percent: { type: Number, required: true, min: 0, max: 100 },
    createdAt: { type: Date, required: true, default: Date.now }
  },
  { _id: false }
);

const runSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, trim: true, index: true },
    filename: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true, index: true },
    textColumn: { type: String, required: true, trim: true },
    detectedTextColumn: { type: String, default: "", trim: true },
    columns: { type: [String], default: [] },
    status: {
      type: String,
      required: true,
      trim: true,
      enum: ["queued", "processing", "completed", "failed", "canceled"]
    },
    rowCount: { type: Number, required: true, default: 0 },
    validRowCount: { type: Number, required: true, default: 0 },
    removedCount: { type: Number, required: true, default: 0 },
    modelMode: { type: String, required: true, trim: true, default: "pending" },
    modelName: { type: String, required: true, trim: true, default: "pending" },
    progressPercent: { type: Number, required: true, default: 0, min: 0, max: 100 },
    progressStage: { type: String, required: true, trim: true, default: "queued" },
    progressMessage: { type: String, required: true, trim: true, default: "Run queued." },
    errorMessage: { type: String, default: "", trim: true },
    cancelRequested: { type: Boolean, default: false },
    processingStartedAt: { type: Date, default: null },
    processingCompletedAt: { type: Date, default: null },
    lastProcessedAt: { type: Date, default: null },
    progressEvents: { type: [progressEventSchema], default: [] },
    summary: {
      type: summarySchema,
      required: true,
      default: () => ({
        sentimentCounts: { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0 },
        topAspects: [],
        aspectCoverage: 0
      })
    },
    rows: { type: [rowSchema], default: [] }
  },
  {
    timestamps: true
  }
);

runSchema.index({ userId: 1, createdAt: -1 });

export const RunModel = mongoose.models.Run || mongoose.model("Run", runSchema);

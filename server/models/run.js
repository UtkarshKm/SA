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

const runSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true, index: true },
    textColumn: { type: String, required: true, trim: true },
    detectedTextColumn: { type: String, default: "", trim: true },
    columns: { type: [String], default: [] },
    status: { type: String, required: true, trim: true },
    rowCount: { type: Number, required: true },
    validRowCount: { type: Number, required: true },
    removedCount: { type: Number, required: true },
    modelMode: { type: String, required: true, trim: true },
    modelName: { type: String, required: true, trim: true },
    summary: { type: summarySchema, required: true },
    rows: { type: [rowSchema], default: [] }
  },
  {
    timestamps: true
  }
);

runSchema.index({ createdAt: -1 });

export const RunModel = mongoose.models.Run || mongoose.model("Run", runSchema);

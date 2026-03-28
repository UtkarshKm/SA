const POSITIVE_WORDS = new Set([
  "amazing",
  "awesome",
  "best",
  "comfortable",
  "delightful",
  "excellent",
  "fantastic",
  "good",
  "great",
  "happy",
  "impressed",
  "love",
  "nice",
  "perfect",
  "recommend",
  "satisfied",
  "soft",
  "stylish",
  "wonderful"
]);

const NEGATIVE_WORDS = new Set([
  "awful",
  "bad",
  "broken",
  "cheap",
  "delay",
  "disappointed",
  "hate",
  "horrible",
  "issue",
  "late",
  "poor",
  "refund",
  "return",
  "slow",
  "terrible",
  "uncomfortable",
  "waste",
  "worst"
]);

function normalizeModelLabel(label, score) {
  const upper = String(label || "").toUpperCase();

  if (upper.includes("POSITIVE") || upper.includes("POS") || upper === "LABEL_2") {
    return score < 0.55 ? "NEUTRAL" : "POSITIVE";
  }

  if (upper.includes("NEGATIVE") || upper.includes("NEG") || upper === "LABEL_0") {
    return score < 0.55 ? "NEUTRAL" : "NEGATIVE";
  }

  if (upper.includes("NEUTRAL") || upper.includes("NEU") || upper === "LABEL_1") {
    return "NEUTRAL";
  }

  return "NEUTRAL";
}

function fallbackSentiment(text) {
  const tokens = String(text || "").split(/\s+/).filter(Boolean);
  let positive = 0;
  let negative = 0;

  for (const token of tokens) {
    if (POSITIVE_WORDS.has(token)) {
      positive += 1;
    }

    if (NEGATIVE_WORDS.has(token)) {
      negative += 1;
    }
  }

  if (positive === negative) {
    return { label: "NEUTRAL", confidence: 0.51, source: "fallback" };
  }

  const total = Math.max(positive + negative, 1);
  const confidence = Math.min(0.99, Math.max(0.55, Math.abs(positive - negative) / total));

  return {
    label: positive > negative ? "POSITIVE" : "NEGATIVE",
    confidence: Number(confidence.toFixed(3)),
    source: "fallback"
  };
}

export class SentimentAnalyzer {
  constructor() {
    this.modelName = "Xenova/distilbert-base-uncased-finetuned-sst-2-english";
    this.pipelinePromise = null;
    this.mode = "fallback";
  }

  async getPipeline() {
    if (this.pipelinePromise) {
      return this.pipelinePromise;
    }

    this.pipelinePromise = (async () => {
      try {
        const transformers = await import("@huggingface/transformers");
        const pipe = await transformers.pipeline("sentiment-analysis", this.modelName);
        this.mode = "transformers";
        return pipe;
      } catch {
        this.mode = "fallback";
        return null;
      }
    })();

    return this.pipelinePromise;
  }

  async analyze(texts) {
    const pipe = await this.getPipeline();

    if (!pipe) {
      return texts.map((text) => fallbackSentiment(text));
    }

    const outputs = [];
    const batchSize = 8;

    for (let index = 0; index < texts.length; index += batchSize) {
      const batch = texts.slice(index, index + batchSize);
      const result = await pipe(batch, { topk: 1 });
      const normalizedBatch = Array.isArray(result) ? result : [result];

      for (const entry of normalizedBatch) {
        const item = Array.isArray(entry) ? entry[0] : entry;
        const confidence = Number((item?.score ?? 0.5).toFixed(3));

        outputs.push({
          label: normalizeModelLabel(item?.label, confidence),
          confidence,
          source: "transformers"
        });
      }
    }

    return outputs;
  }
}

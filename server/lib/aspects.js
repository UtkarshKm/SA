export const CATEGORY_ASPECTS = {
  ELECTRONICS: ["battery", "camera", "display", "performance", "build quality", "price"],
  CLOTHING: ["fit", "quality", "style", "comfort", "price"],
  FOOD: ["taste", "freshness", "quality", "packaging", "price", "delivery"],
  SKINCARE: ["effectiveness", "texture", "fragrance", "skin reaction", "packaging", "price"],
  RESTAURANTS: ["food quality", "service", "ambiance", "price", "wait time"],
  BOOKS: ["plot", "characters", "writing style", "ending", "price"],
  HOTELS: ["room", "location", "service", "amenities", "price"],
  APPLIANCES: ["performance", "durability", "noise", "ease of use", "price"],
  FURNITURE: ["quality", "comfort", "assembly", "design", "price"],
  TOYS: ["quality", "safety", "entertainment", "educational", "price"]
};

export function resolveCategory(category) {
  const normalized = String(category || "CLOTHING").toUpperCase();
  return CATEGORY_ASPECTS[normalized] ? normalized : "CLOTHING";
}

export function extractAspects(text, category) {
  const resolvedCategory = resolveCategory(category);
  const aspects = CATEGORY_ASPECTS[resolvedCategory];
  const haystack = String(text || "").toLowerCase();

  return aspects.filter((aspect) => {
    const escaped = aspect.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escaped}\\b`, "i").test(haystack);
  });
}

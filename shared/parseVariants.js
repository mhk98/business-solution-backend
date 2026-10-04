// size/color are trimmed in place: variants are matched by `${size}__${color}`
// everywhere (merge/subtract/guards/reconciler), and a stray space — e.g. a
// hand-edited "Black " — made a variant unmatchable (stock showed 0 and
// movements skipped it). The same array/objects are returned so callers that
// mutate the result keep working.
const trimVariant = (variant) => {
  if (!variant || typeof variant !== "object") return variant;
  if (typeof variant.size === "string") variant.size = variant.size.trim();
  if (typeof variant.color === "string") variant.color = variant.color.trim();
  return variant;
};

const parseVariants = (variants) => {
  if (!variants) return [];

  if (Array.isArray(variants)) {
    variants.forEach(trimVariant);
    return variants;
  }

  if (typeof variants === "string") {
    try {
      const parsed = JSON.parse(variants);
      return parseVariants(parsed);
    } catch (error) {
      return [];
    }
  }

  return [];
};

module.exports = parseVariants;

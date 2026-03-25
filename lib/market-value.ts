export type SneakerCondition =
  | "deadstock"
  | "new"
  | "new_with_box"
  | "used"
  | "pre_owned"
  | "vnds"
  | "unknown";

export type SneakerRecord = {
  id: string;
  brand: string | null;
  model: string | null;
  official_product_name: string | null;
  common_nickname: string | null;
  colorway: string | null;
  sku: string | null;
  size: string | null;
  condition: string | null;
};

export type EbayComp = {
  listingId: string;
  title: string;
  price: number;
  shipping: number;
  totalPrice: number;
  condition?: string | null;
  itemWebUrl?: string | null;
  imageUrl?: string | null;
};

export type ValuationResult = {
  low: number | null;
  mid: number | null;
  high: number | null;
  compCount: number;
  confidence: "low" | "medium" | "high";
  basis: "used" | "new";
  acceptedComps: EbayComp[];
  rejectedComps: Array<EbayComp & { reason: string }>;
};

const NEGATIVE_TITLE_PATTERNS = [
  /\blot\b/i,
  /\bbox only\b/i,
  /\breplacement box\b/i,
  /\blaces only\b/i,
  /\blace only\b/i,
  /\bcustom\b/i,
  /\breplica\b/i,
  /\binspired\b/i,
  /\bbootleg\b/i,
  /\bfake\b/i,
  /\bgs\b/i,
  /\bgrade school\b/i,
  /\bps\b/i,
  /\bpreschool\b/i,
  /\btd\b/i,
  /\btoddler\b/i,
  /\binfant\b/i,
  /\bfor parts\b/i,
  /\bparts only\b/i,
  /\bdamaged\b/i,
  /\bbeater\b/i,
];

function normalizeCondition(condition: string | null): SneakerCondition {
  if (!condition) return "unknown";

  const c = condition.trim().toLowerCase();

  if (["deadstock", "ds"].includes(c)) return "deadstock";
  if (["new", "brand new"].includes(c)) return "new";
  if (["new with box", "nwb", "new in box"].includes(c)) return "new_with_box";
  if (["used", "worn"].includes(c)) return "used";
  if (["pre-owned", "pre owned"].includes(c)) return "pre_owned";
  if (["vnds", "very near deadstock"].includes(c)) return "vnds";

  return "unknown";
}

export function getMarketBasis(condition: string | null): "used" | "new" {
  const normalized = normalizeCondition(condition);

  if (
    normalized === "deadstock" ||
    normalized === "new" ||
    normalized === "new_with_box"
  ) {
    return "new";
  }

  return "used";
}

function titleHasNegativePattern(title: string): boolean {
  return NEGATIVE_TITLE_PATTERNS.some((pattern) => pattern.test(title));
}

function titleIncludesValue(title: string, value: string | null): boolean {
  if (!value) return false;
  return title.toLowerCase().includes(value.toLowerCase());
}

function scoreComp(sneaker: SneakerRecord, comp: EbayComp): number {
  let score = 0;
  const title = comp.title.toLowerCase();

  if (sneaker.sku && title.includes(sneaker.sku.toLowerCase())) score += 100;
  if (sneaker.brand && title.includes(sneaker.brand.toLowerCase())) score += 20;
  if (sneaker.model && title.includes(sneaker.model.toLowerCase())) score += 25;
  if (
    sneaker.official_product_name &&
    title.includes(sneaker.official_product_name.toLowerCase())
  ) {
    score += 20;
  }
  if (
    sneaker.common_nickname &&
    title.includes(sneaker.common_nickname.toLowerCase())
  ) {
    score += 15;
  }
  if (sneaker.colorway && title.includes(sneaker.colorway.toLowerCase())) {
    score += 20;
  }

  if (titleHasNegativePattern(comp.title)) score -= 200;

  return score;
}

function filterAndScoreComps(
  sneaker: SneakerRecord,
  comps: EbayComp[]
): {
  accepted: EbayComp[];
  rejected: Array<EbayComp & { reason: string }>;
} {
  const accepted: EbayComp[] = [];
  const rejected: Array<EbayComp & { reason: string }> = [];

  for (const comp of comps) {
    if (titleHasNegativePattern(comp.title)) {
      rejected.push({ ...comp, reason: "negative_title_pattern" });
      continue;
    }

    const score = scoreComp(sneaker, comp);

    // Require either exact SKU match or strong title match
    const strongMatch =
      score >= 60 ||
      (sneaker.sku
        ? comp.title.toLowerCase().includes(sneaker.sku.toLowerCase())
        : false);

    if (!strongMatch) {
      rejected.push({ ...comp, reason: "weak_match" });
      continue;
    }

    accepted.push(comp);
  }

  return { accepted, rejected };
}

function removeOutliers(comps: EbayComp[]): EbayComp[] {
  if (comps.length < 4) return comps;

  const sorted = [...comps].sort((a, b) => a.totalPrice - b.totalPrice);
  const prices = sorted.map((c) => c.totalPrice);

  const q1 = prices[Math.floor((prices.length - 1) * 0.25)];
  const q3 = prices[Math.floor((prices.length - 1) * 0.75)];
  const iqr = q3 - q1;

  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;

  return sorted.filter(
    (c) => c.totalPrice >= lowerBound && c.totalPrice <= upperBound
  );
}

function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  const index = (sortedValues.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) return sortedValues[lower];

  const weight = index - lower;
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

export function estimateMarketValue(
  sneaker: SneakerRecord,
  comps: EbayComp[]
): ValuationResult {
  const basis = getMarketBasis(sneaker.condition);
  const { accepted, rejected } = filterAndScoreComps(sneaker, comps);
  const cleaned = removeOutliers(accepted);

  if (cleaned.length === 0) {
    return {
      low: null,
      mid: null,
      high: null,
      compCount: 0,
      confidence: "low",
      basis,
      acceptedComps: [],
      rejectedComps: rejected,
    };
  }

  const prices = cleaned.map((c) => c.totalPrice).sort((a, b) => a - b);

  const low = Math.round(percentile(prices, 0.25));
  const mid = Math.round(percentile(prices, 0.5));
  const high = Math.round(percentile(prices, 0.75));

  let confidence: "low" | "medium" | "high" = "low";
  if (cleaned.length >= 3) confidence = "medium";
  if (cleaned.length >= 6) confidence = "high";

  return {
    low,
    mid,
    high,
    compCount: cleaned.length,
    confidence,
    basis,
    acceptedComps: cleaned,
    rejectedComps: rejected,
  };
}